'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/authz';
import type { DeskDecision, QualityVerdict, VerifierCell } from '@prisma/client';
import { seededPick } from '@/lib/verification/auditSample';
import {
  evaluateDeEmpanelment,
  type DeEmpanelEvaluation,
} from '@/lib/verification/deEmpanelment';
import { driftReport, type DriftReport } from '@/lib/verification/drift';
import { transitionRun } from '@/lib/verification/stateMachine';

/**
 * The supervisor's remit: their own cell's verifiers, per the roles table in the brief.
 *
 * School identity is not masked here. masking.ts states the reason: a supervisor handling an
 * escalation has to be able to identify the school to act on it, and the audit trail records
 * that they did. The anonymity promise is between Online Verifiers and schools, not between
 * the oversight chain and schools.
 */

async function supervisorScope() {
  const actor = await requireRole('SUPERVISOR', 'SSSA_ADMIN');
  if (!actor) return null;
  if (actor.role === 'SSSA_ADMIN') {
    return { actor, cells: ['ONLINE', 'FIELD'] as VerifierCell[] };
  }
  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { cell: true },
  });
  // A supervisor account without a profile is a configuration gap, not a security event:
  // nothing below exposes more than verifier work records, so showing both cells keeps the
  // portal usable until the profile is set up, and the gap is visible on the roster itself.
  return { actor, cells: profile ? [profile.cell] : (['ONLINE', 'FIELD'] as VerifierCell[]) };
}

/** Roles whose work a supervisor reviews. Supervisors and auditors have profiles too, and a
 *  roster that listed them would grade the graders. */
const SUBJECT_ROLES = ['VERIFIER', 'ONLINE_VERIFIER', 'ONGROUND_VERIFIER'];

export type RosterRow = {
  profileId: string;
  name: string;
  cell: VerifierCell;
  workforceSource: string;
  certification: string;
  deEmpanelledAt: string | null;
  /** Desk cases now open (online cell) or visits awaiting sign-off (field cell). */
  openCount: number;
  /** Desk cases routed onwards, or visits signed off. */
  completedCount: number;
  /** Mean days from entering desk screening to routing, over recent completed cases. */
  avgTurnaroundDays: number | null;
  escalationsOpen: number;
  qualityFlags: number;
};

export type SupervisorOverview = {
  cells: VerifierCell[];
  roster: RosterRow[];
  unassignedDeskCases: number;
  escalationsOpen: number;
  discrepancyCases: number;
};

export async function getSupervisorOverview(): Promise<SupervisorOverview | null> {
  const scope = await supervisorScope();
  if (!scope) return null;

  const profiles = await prisma.verifierProfile.findMany({
    where: { cell: { in: scope.cells }, user: { role: { in: SUBJECT_ROLES } } },
    select: {
      id: true,
      cell: true,
      workforceSource: true,
      certification: true,
      deEmpanelledAt: true,
      user: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const profileIds = profiles.map((p) => p.id);

  const [openDesk, movedOnDesk, recentCompleted, visits, escalations, qualityFlags, unassigned, discrepancyCases] =
    await Promise.all([
      prisma.assessmentCycleRun.groupBy({
        by: ['deskAssigneeProfileId'],
        where: { deskAssigneeProfileId: { in: profileIds }, state: 'DESK_SCREENING' },
        _count: { _all: true },
      }),
      prisma.assessmentCycleRun.groupBy({
        by: ['deskAssigneeProfileId'],
        where: { deskAssigneeProfileId: { in: profileIds }, state: { not: 'DESK_SCREENING' } },
        _count: { _all: true },
      }),
      // Turnaround over the most recent completed desk cases, bounded so the overview stays
      // one cheap page at state volume rather than a table scan.
      prisma.assessmentCycleRun.findMany({
        where: { deskAssigneeProfileId: { in: profileIds }, state: { not: 'DESK_SCREENING' } },
        select: { id: true, deskAssigneeProfileId: true },
        orderBy: { enteredStateAt: 'desc' },
        take: 300,
      }),
      prisma.fieldVisit.findMany({
        where: { profileId: { in: profileIds }, recusedAt: null },
        select: { profileId: true, revealAt: true, signedOffAt: true },
        orderBy: { notifiedDate: 'desc' },
        take: 2000,
      }),
      prisma.deskScreeningDecision.groupBy({
        by: ['profileId'],
        where: { profileId: { in: profileIds }, escalated: true },
        _count: { _all: true },
      }),
      prisma.qualityCheck.groupBy({
        by: ['subjectProfileId'],
        where: { subjectProfileId: { in: profileIds }, verdict: 'FLAGGED' },
        _count: { _all: true },
      }),
      prisma.assessmentCycleRun.count({
        where: { state: 'DESK_SCREENING', deskAssigneeProfileId: null },
      }),
      prisma.assessmentCycleRun.count({
        where: { state: { in: ['DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'] } },
      }),
    ]);

  const transitions = await prisma.cycleTransition.findMany({
    where: {
      runId: { in: recentCompleted.map((r) => r.id) },
      toState: { in: ['DESK_SCREENING', 'VIDEO_WALKTHROUGH', 'CENSUS_QUEUE'] },
    },
    select: { runId: true, toState: true, createdAt: true },
  });
  const inAt = new Map<string, number>();
  const outAt = new Map<string, number>();
  for (const t of transitions) {
    if (t.toState === 'DESK_SCREENING') inAt.set(t.runId, t.createdAt.getTime());
    else outAt.set(t.runId, t.createdAt.getTime());
  }
  const daysByProfile = new Map<string, number[]>();
  for (const r of recentCompleted) {
    const a = inAt.get(r.id);
    const b = outAt.get(r.id);
    if (!r.deskAssigneeProfileId || a === undefined || b === undefined || b < a) continue;
    const list = daysByProfile.get(r.deskAssigneeProfileId) ?? [];
    list.push((b - a) / 86_400_000);
    daysByProfile.set(r.deskAssigneeProfileId, list);
  }

  const countBy = <T extends { _count: { _all: number } }>(
    rows: T[],
    key: (row: T) => string | null,
  ) => new Map(rows.map((r) => [key(r) ?? '', r._count._all]));

  const openDeskBy = countBy(openDesk, (r) => r.deskAssigneeProfileId);
  const movedBy = countBy(movedOnDesk, (r) => r.deskAssigneeProfileId);
  const escalationsBy = countBy(escalations, (r) => r.profileId);
  const flagsBy = countBy(qualityFlags, (r) => r.subjectProfileId);

  const visitsBy = new Map<string, { open: number; done: number; days: number[] }>();
  for (const v of visits) {
    const entry = visitsBy.get(v.profileId) ?? { open: 0, done: 0, days: [] };
    if (v.signedOffAt) {
      entry.done += 1;
      entry.days.push((v.signedOffAt.getTime() - v.revealAt.getTime()) / 86_400_000);
    } else {
      entry.open += 1;
    }
    visitsBy.set(v.profileId, entry);
  }

  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

  const roster: RosterRow[] = profiles.map((p) => {
    const field = visitsBy.get(p.id);
    const deskDays = daysByProfile.get(p.id) ?? [];
    return {
      profileId: p.id,
      name: p.user.name ?? p.user.username,
      cell: p.cell,
      workforceSource: p.workforceSource,
      certification: p.certification,
      deEmpanelledAt: p.deEmpanelledAt?.toISOString() ?? null,
      openCount: p.cell === 'ONLINE' ? (openDeskBy.get(p.id) ?? 0) : (field?.open ?? 0),
      completedCount: p.cell === 'ONLINE' ? (movedBy.get(p.id) ?? 0) : (field?.done ?? 0),
      avgTurnaroundDays: p.cell === 'ONLINE' ? mean(deskDays) : mean(field?.days ?? []),
      escalationsOpen: escalationsBy.get(p.id) ?? 0,
      qualityFlags: flagsBy.get(p.id) ?? 0,
    };
  });

  return {
    cells: scope.cells,
    roster,
    unassignedDeskCases: unassigned,
    escalationsOpen: [...escalationsBy.values()].reduce((s, n) => s + n, 0),
    discrepancyCases,
  };
}

/**
 * Hand the oldest unassigned desk cases to one verifier. Oldest first, because the queue's
 * fairness to schools is measured in waiting time, not in which supervisor pressed the button.
 */
export async function allocateNextDeskCases(
  profileId: string,
  count: number,
): Promise<{ success: boolean; allocated: number; error?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, allocated: 0, error: 'Not authorised.' };
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return { success: false, allocated: 0, error: 'Allocate between 1 and 200 cases at a time.' };
  }

  const target = await prisma.verifierProfile.findUnique({
    where: { id: profileId },
    select: { cell: true, certification: true, deEmpanelledAt: true },
  });
  if (!target) return { success: false, allocated: 0, error: 'Verifier not found.' };
  if (target.cell !== 'ONLINE') {
    return { success: false, allocated: 0, error: 'Desk cases go to the online cell.' };
  }
  if (target.certification !== 'CERTIFIED' || target.deEmpanelledAt) {
    return { success: false, allocated: 0, error: 'This verifier is not certified for assignment.' };
  }

  const runs = await prisma.assessmentCycleRun.findMany({
    where: { state: 'DESK_SCREENING', deskAssigneeProfileId: null },
    select: { id: true },
    orderBy: { enteredStateAt: 'asc' },
    take: count,
  });
  const result = await prisma.assessmentCycleRun.updateMany({
    // Re-checked in the update so two supervisors allocating at once cannot hand the same
    // case to two verifiers: whoever writes second matches nothing.
    where: { id: { in: runs.map((r) => r.id) }, deskAssigneeProfileId: null },
    data: { deskAssigneeProfileId: profileId },
  });

  revalidatePath('/app/supervisor');
  revalidatePath('/app/verifier/desk');
  return { success: true, allocated: result.count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalations
// ─────────────────────────────────────────────────────────────────────────────

export type EscalationRow = {
  runId: string;
  parameterId: string;
  parameterCode: string;
  parameterTitle: string;
  schoolName: string;
  schoolUdise: string;
  districtName: string;
  verifierName: string;
  rationale: string | null;
  escalatedAt: string | null;
  claimedLevel: number | null;
  levels: { order: number; labelEn: string }[];
};

export async function getEscalationInbox(): Promise<EscalationRow[]> {
  const scope = await supervisorScope();
  if (!scope) return [];

  const rows = await prisma.deskScreeningDecision.findMany({
    where: { escalated: true },
    include: {
      parameter: { include: { options: { orderBy: { order: 'asc' } } } },
      profile: { include: { user: { select: { name: true, username: true } } } },
      run: {
        select: {
          cycleId: true,
          schoolUdise: true,
          school: { select: { nameEn: true, udise: true, district: { select: { nameEn: true } } } },
        },
      },
    },
    orderBy: { escalatedAt: 'asc' },
    take: 200,
  });

  // Prisma treats an empty OR as matching nothing, but an empty inbox should not query at all.
  const claims = rows.length === 0 ? [] : await prisma.selfAssessmentResponse.findMany({
    where: {
      OR: rows.map((r) => ({
        parameterId: r.parameterId,
        submission: { cycleId: r.run.cycleId, schoolUdise: r.run.schoolUdise },
      })),
    },
    select: { parameterId: true, selectedOptionKey: true, submission: { select: { schoolUdise: true } } },
  });
  const claimBy = new Map(claims.map((c) => [`${c.submission.schoolUdise}:${c.parameterId}`, c.selectedOptionKey]));

  return rows.map((r) => {
    const claimedKey = claimBy.get(`${r.run.schoolUdise}:${r.parameterId}`);
    const claimed = r.parameter.options.find((o) => o.key === claimedKey);
    return {
      runId: r.runId,
      parameterId: r.parameterId,
      parameterCode: r.parameter.code,
      parameterTitle: r.parameter.titleEn,
      schoolName: r.run.school.nameEn,
      schoolUdise: r.run.school.udise,
      districtName: r.run.school.district.nameEn,
      verifierName: r.profile.user.name ?? r.profile.user.username,
      rationale: r.rationale,
      escalatedAt: r.escalatedAt?.toISOString() ?? null,
      claimedLevel: claimed?.order ?? null,
      levels: r.parameter.options.map((o) => ({ order: o.order, labelEn: o.labelEn })),
    };
  });
}

/**
 * Rule on an escalated indicator. The verifier's escalation rationale is kept and the ruling
 * appended under the supervisor's name, so the decision record shows who could not decide,
 * why, and who then did.
 */
export async function resolveEscalation(
  runId: string,
  parameterId: string,
  decision: DeskDecision,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, error: 'Not authorised.' };
  const trimmed = note.trim();
  if (!trimmed) return { success: false, error: 'A ruling needs a reason the verifier can read.' };

  const existing = await prisma.deskScreeningDecision.findUnique({
    where: { runId_parameterId: { runId, parameterId } },
    select: { escalated: true, rationale: true },
  });
  if (!existing || !existing.escalated) {
    return { success: false, error: 'This indicator is not escalated.' };
  }

  await prisma.deskScreeningDecision.update({
    where: { runId_parameterId: { runId, parameterId } },
    data: {
      decision,
      escalated: false,
      rationale: `${existing.rationale ?? ''}\n\nSupervisor ruling (${scope.actor.username}): ${trimmed}`.trim(),
    },
  });

  revalidatePath('/app/supervisor/escalations');
  revalidatePath(`/app/verifier/desk/${runId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality sampler
// ─────────────────────────────────────────────────────────────────────────────

export type QualitySampleCase = {
  runId: string;
  subjectProfileId: string;
  subjectName: string;
  cell: VerifierCell;
  schoolName: string;
  districtName: string;
  /** Online: decision mix. Field: findings against claims. */
  summary: string;
  rationales: string[];
  existingVerdict: QualityVerdict | null;
  existingNote: string | null;
};

/** The IST week key, so the sample changes on Monday and not mid-shift. */
function weekKeyIST(now: Date): string {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  const jan1 = Date.UTC(ist.getUTCFullYear(), 0, 1);
  const week = Math.floor((ist.getTime() - jan1) / (7 * 86_400_000));
  return `${ist.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const QUALITY_SAMPLE_SIZE = 5;

/**
 * The weekly quality sample: a deterministic draw over recently completed work, per cell.
 *
 * Seeded on the week so the same five cases stay up all week however often the page loads,
 * and drawn by keyed digest so a verifier cannot predict which of their cases their
 * supervisor will read, and a supervisor cannot fish for a colleague's best work.
 */
export async function getQualitySample(): Promise<QualitySampleCase[]> {
  const scope = await supervisorScope();
  if (!scope) return [];
  const week = weekKeyIST(new Date());
  const out: QualitySampleCase[] = [];

  if (scope.cells.includes('ONLINE')) {
    const completed = await prisma.assessmentCycleRun.findMany({
      where: { deskAssigneeProfileId: { not: null }, state: { notIn: ['DESK_SCREENING'] }, riskScores: { some: {} } },
      select: { id: true },
      orderBy: { enteredStateAt: 'desc' },
      take: 200,
    });
    const picked = seededPick(`quality:ONLINE:${week}`, completed.map((r) => r.id), QUALITY_SAMPLE_SIZE);
    for (const runId of picked) {
      const run = await prisma.assessmentCycleRun.findUnique({
        where: { id: runId },
        select: {
          deskAssigneeProfileId: true,
          school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
          deskAssignee: { select: { user: { select: { name: true, username: true } } } },
          deskDecisions: { select: { decision: true, rationale: true } },
        },
      });
      if (!run?.deskAssigneeProfileId || !run.deskAssignee) continue;
      const counts = new Map<string, number>();
      for (const d of run.deskDecisions) counts.set(d.decision, (counts.get(d.decision) ?? 0) + 1);
      const existing = await prisma.qualityCheck.findUnique({
        where: { runId_subjectProfileId: { runId, subjectProfileId: run.deskAssigneeProfileId } },
        select: { verdict: true, note: true },
      });
      out.push({
        runId,
        subjectProfileId: run.deskAssigneeProfileId,
        subjectName: run.deskAssignee.user.name ?? run.deskAssignee.user.username,
        cell: 'ONLINE',
        schoolName: run.school.nameEn,
        districtName: run.school.district.nameEn,
        summary: [...counts.entries()].map(([k, n]) => `${k.replaceAll('_', ' ').toLowerCase()}: ${n}`).join(', '),
        rationales: run.deskDecisions.filter((d) => d.rationale).slice(0, 8).map((d) => d.rationale!),
        existingVerdict: existing?.verdict ?? null,
        existingNote: existing?.note ?? null,
      });
    }
  }

  if (scope.cells.includes('FIELD')) {
    const signedOff = await prisma.fieldVisit.findMany({
      where: { signedOffAt: { not: null } },
      select: { id: true },
      orderBy: { signedOffAt: 'desc' },
      take: 200,
    });
    const picked = seededPick(`quality:FIELD:${week}`, signedOff.map((v) => v.id), QUALITY_SAMPLE_SIZE);
    for (const visitId of picked) {
      const visit = await prisma.fieldVisit.findUnique({
        where: { id: visitId },
        select: {
          runId: true,
          profileId: true,
          profile: { select: { user: { select: { name: true, username: true } } } },
          run: {
            select: {
              school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
              discrepancies: { select: { id: true } },
            },
          },
          findings: { select: { note: true, photoBlobUrl: true } },
        },
      });
      if (!visit) continue;
      const withPhoto = visit.findings.filter((f) => f.photoBlobUrl).length;
      const existing = await prisma.qualityCheck.findUnique({
        where: { runId_subjectProfileId: { runId: visit.runId, subjectProfileId: visit.profileId } },
        select: { verdict: true, note: true },
      });
      out.push({
        runId: visit.runId,
        subjectProfileId: visit.profileId,
        subjectName: visit.profile.user.name ?? visit.profile.user.username,
        cell: 'FIELD',
        schoolName: visit.run.school.nameEn,
        districtName: visit.run.school.district.nameEn,
        summary: `${visit.findings.length} indicators recorded, ${withPhoto} with photographs, ${visit.run.discrepancies.length} discrepancies raised`,
        rationales: visit.findings.filter((f) => f.note).slice(0, 8).map((f) => f.note!),
        existingVerdict: existing?.verdict ?? null,
        existingNote: existing?.note ?? null,
      });
    }
  }

  return out;
}

export async function recordQualityCheck(
  runId: string,
  subjectProfileId: string,
  verdict: QualityVerdict,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, error: 'Not authorised.' };
  const trimmed = note.trim();
  if (verdict !== 'SATISFACTORY' && !trimmed) {
    return { success: false, error: 'Say what needs coaching or why this is flagged.' };
  }
  await prisma.qualityCheck.upsert({
    where: { runId_subjectProfileId: { runId, subjectProfileId } },
    create: { runId, subjectProfileId, verdict, note: trimmed || null, byUserId: scope.actor.userId },
    update: { verdict, note: trimmed || null, byUserId: scope.actor.userId },
  });
  revalidatePath('/app/supervisor/quality');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// De-empanelment
// ─────────────────────────────────────────────────────────────────────────────

export type DeEmpanelmentCase = {
  profileId: string;
  name: string;
  cell: VerifierCell;
  deEmpanelledAt: string | null;
  deEmpanelledReason: string | null;
  evaluation: DeEmpanelEvaluation;
};

/**
 * Every empanelled verifier's audited record against both rules. Field cell only in
 * practice: the audit re-checks physical visits, so desk screeners have no audited cases
 * yet, and the screen says so rather than implying a clean record was earned.
 */
export async function getDeEmpanelmentCases(): Promise<DeEmpanelmentCase[]> {
  const scope = await supervisorScope();
  if (!scope) return [];

  const [config, profiles, reconciled] = await Promise.all([
    prisma.programmeConfig.findUnique({
      where: { id: 'current' },
      select: {
        deEmpanelContradictionRate: true,
        deEmpanelMinimumAuditedCases: true,
        deEmpanelAbsoluteCount: true,
      },
    }),
    prisma.verifierProfile.findMany({
      where: {
        cell: { in: scope.cells },
        workforceSource: 'EMPANELLED',
        user: { role: { in: SUBJECT_ROLES } },
      },
      select: {
        id: true,
        cell: true,
        deEmpanelledAt: true,
        deEmpanelledReason: true,
        user: { select: { name: true, username: true } },
      },
    }),
    prisma.auditCase.findMany({
      where: { reconciledAt: { not: null } },
      select: {
        contradicted: true,
        reconciledAt: true,
        run: {
          select: {
            fieldVisits: {
              where: { signedOffAt: { not: null } },
              select: { profileId: true },
              orderBy: { signedOffAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const rules = {
    contradictionRatePct: config?.deEmpanelContradictionRate ?? 20,
    minimumAuditedCases: config?.deEmpanelMinimumAuditedCases ?? 10,
    absoluteCount: config?.deEmpanelAbsoluteCount ?? 3,
  };

  const byProfile = new Map<string, { contradicted: boolean; decidedAt: Date }[]>();
  for (const c of reconciled) {
    const subject = c.run.fieldVisits[0]?.profileId;
    if (!subject || !c.reconciledAt) continue;
    const list = byProfile.get(subject) ?? [];
    list.push({ contradicted: c.contradicted === true, decidedAt: c.reconciledAt });
    byProfile.set(subject, list);
  }

  return profiles
    .map((p) => ({
      profileId: p.id,
      name: p.user.name ?? p.user.username,
      cell: p.cell,
      deEmpanelledAt: p.deEmpanelledAt?.toISOString() ?? null,
      deEmpanelledReason: p.deEmpanelledReason,
      evaluation: evaluateDeEmpanelment(byProfile.get(p.id) ?? [], rules),
    }))
    .sort((a, b) => Number(b.evaluation.recommended) - Number(a.evaluation.recommended));
}

/**
 * Confirm a removal. Beyond stamping the profile, open desk cases go back to the pool and
 * unstarted visits are recused so the next cohort build reassigns them; work already signed
 * off stays, because history is the thing de-empanelment must never rewrite.
 */
export async function confirmDeEmpanelment(
  profileId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, error: 'Not authorised.' };
  const trimmed = reason.trim();
  if (trimmed.length < 20) {
    return { success: false, error: 'Give the grounds in full. This ends an empanelment and is kept on record.' };
  }

  const profile = await prisma.verifierProfile.findUnique({
    where: { id: profileId },
    select: { workforceSource: true, deEmpanelledAt: true },
  });
  if (!profile) return { success: false, error: 'Verifier not found.' };
  if (profile.workforceSource !== 'EMPANELLED') {
    return { success: false, error: 'Serving staff are not empanelled, so there is no empanelment to end.' };
  }
  if (profile.deEmpanelledAt) return { success: false, error: 'Already de-empanelled.' };

  await prisma.$transaction([
    prisma.verifierProfile.update({
      where: { id: profileId },
      data: {
        deEmpanelledAt: new Date(),
        deEmpanelledReason: trimmed,
        deEmpanelledByUserId: scope.actor.userId,
      },
    }),
    prisma.assessmentCycleRun.updateMany({
      where: { deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' },
      data: { deskAssigneeProfileId: null },
    }),
    prisma.fieldVisit.updateMany({
      where: { profileId, signedOffAt: null, arrivedAt: null },
      data: { recusedAt: new Date() },
    }),
  ]);

  revalidatePath('/app/supervisor/de-empanelment');
  revalidatePath('/app/supervisor');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift monitor
// ─────────────────────────────────────────────────────────────────────────────

export async function getDriftReport(): Promise<DriftReport | null> {
  const scope = await supervisorScope();
  if (!scope) return null;
  const scores = await prisma.riskScore.findMany({
    select: { score: true, aboveThreshold: true, computedAt: true },
    orderBy: { computedAt: 'asc' },
    take: 20000,
  });
  return driftReport(scores);
}

// ─────────────────────────────────────────────────────────────────────────────
// Discrepancy review and the school response window
// ─────────────────────────────────────────────────────────────────────────────

export type DiscrepancyQueueRow = {
  runId: string;
  schoolName: string;
  schoolUdise: string;
  districtName: string;
  state: string;
  discrepancies: number;
  enteredStateAt: string;
  windowClosesAt: string | null;
  hasResponse: boolean;
};

async function responseWindowDays(): Promise<{ days: number; enabled: boolean }> {
  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { schoolResponseWindowDays: true, schoolResponseWindowEnabled: true },
  });
  return { days: config?.schoolResponseWindowDays ?? 7, enabled: config?.schoolResponseWindowEnabled ?? true };
}

/** The window closes this long after the run entered SCHOOL_RESPONSE_WINDOW. Derived from the
 *  transition timestamp rather than stored, so there is exactly one clock. */
function windowClosesAt(enteredStateAt: Date, days: number): Date {
  return new Date(enteredStateAt.getTime() + days * 86_400_000);
}

export async function getDiscrepancyQueue(): Promise<DiscrepancyQueueRow[]> {
  const scope = await supervisorScope();
  if (!scope) return [];
  const { days } = await responseWindowDays();

  const runs = await prisma.assessmentCycleRun.findMany({
    where: { state: { in: ['DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'] } },
    select: {
      id: true,
      state: true,
      enteredStateAt: true,
      school: { select: { nameEn: true, udise: true, district: { select: { nameEn: true } } } },
      discrepancies: { select: { id: true } },
      responses: { select: { id: true } },
    },
    orderBy: { enteredStateAt: 'asc' },
    take: 300,
  });

  return runs.map((r) => ({
    runId: r.id,
    schoolName: r.school.nameEn,
    schoolUdise: r.school.udise,
    districtName: r.school.district.nameEn,
    state: r.state,
    discrepancies: r.discrepancies.length,
    enteredStateAt: r.enteredStateAt.toISOString(),
    windowClosesAt:
      r.state === 'SCHOOL_RESPONSE_WINDOW' ? windowClosesAt(r.enteredStateAt, days).toISOString() : null,
    hasResponse: r.responses.length > 0,
  }));
}

export type DiscrepancyDetail = {
  runId: string;
  schoolName: string;
  schoolUdise: string;
  districtName: string;
  state: string;
  windowEnabled: boolean;
  windowClosesAt: string | null;
  windowOpen: boolean;
  response: { body: string; submittedAt: string } | null;
  items: {
    parameterId: string;
    code: string;
    title: string;
    claimedLevel: number;
    proposedLevel: number;
    basis: string;
    photoBlobUrl: string | null;
    decided: boolean;
    revisedLevel: number | null;
    levels: { order: number; labelEn: string }[];
  }[];
};

export async function getDiscrepancyCase(runId: string): Promise<DiscrepancyDetail | null> {
  const scope = await supervisorScope();
  if (!scope) return null;
  const { days, enabled } = await responseWindowDays();

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      state: true,
      enteredStateAt: true,
      school: { select: { nameEn: true, udise: true, district: { select: { nameEn: true } } } },
      discrepancies: {
        include: { parameter: { include: { options: { orderBy: { order: 'asc' } } } } },
        orderBy: { raisedAt: 'asc' },
      },
      responses: { orderBy: { submittedAt: 'desc' }, take: 1 },
      fieldVisits: {
        where: { signedOffAt: { not: null } },
        orderBy: { signedOffAt: 'desc' },
        take: 1,
        select: { findings: { select: { parameterId: true, photoBlobUrl: true } } },
      },
    },
  });
  if (!run || !['DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'].includes(run.state)) return null;

  const closesAt = run.state === 'SCHOOL_RESPONSE_WINDOW' ? windowClosesAt(run.enteredStateAt, days) : null;
  const photoBy = new Map(
    (run.fieldVisits[0]?.findings ?? []).map((f) => [f.parameterId, f.photoBlobUrl]),
  );
  const response = run.responses[0] ?? null;

  return {
    runId: run.id,
    schoolName: run.school.nameEn,
    schoolUdise: run.school.udise,
    districtName: run.school.district.nameEn,
    state: run.state,
    windowEnabled: enabled,
    windowClosesAt: closesAt?.toISOString() ?? null,
    windowOpen: closesAt !== null && closesAt.getTime() > Date.now() && !response,
    response: response ? { body: response.body, submittedAt: response.submittedAt.toISOString() } : null,
    items: run.discrepancies.map((d) => ({
      parameterId: d.parameterId,
      code: d.parameter.code,
      title: d.parameter.titleEn,
      claimedLevel: d.claimedLevel,
      proposedLevel: d.proposedLevel,
      basis: d.basis,
      photoBlobUrl: photoBy.get(d.parameterId) ?? null,
      decided: d.upheldAt !== null,
      revisedLevel: d.revisedLevel,
      levels: d.parameter.options.map((o) => ({ order: o.order, labelEn: o.labelEn })),
    })),
  };
}

/** Open the school's response window: the school sees the proposed corrections and may reply
 *  before anything is ruled or published. */
export async function openResponseWindow(runId: string): Promise<{ success: boolean; error?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, error: 'Not authorised.' };
  const { enabled } = await responseWindowDays();
  if (!enabled) return { success: false, error: 'The response window is switched off in configuration.' };

  const moved = await transitionRun(runId, 'SCHOOL_RESPONSE_WINDOW', { actorUserId: scope.actor.userId });
  if (!moved?.ok) {
    return { success: false, error: moved?.ok === false ? moved.reason : 'Run not found.' };
  }
  revalidatePath('/app/supervisor/discrepancies');
  return { success: true };
}

export type Ruling = { parameterId: string; action: 'UPHOLD' | 'REVISE'; revisedLevel?: number };

/**
 * The final ruling on a run's discrepancies, and the exit from review.
 *
 * Publication is refused while the school's window is still open with no response: the
 * window is the school's right of reply, and a ruling that lands before the reply makes the
 * window a decoration. Referral back to the field is allowed at any time, because sending
 * someone to look again cannot wrong the school.
 */
export async function ruleOnDiscrepancies(
  runId: string,
  rulings: Ruling[],
  referBack: boolean,
): Promise<{ success: boolean; error?: string; routedTo?: string }> {
  const scope = await supervisorScope();
  if (!scope) return { success: false, error: 'Not authorised.' };

  const detail = await getDiscrepancyCase(runId);
  if (!detail) return { success: false, error: 'Case not found.' };

  if (referBack) {
    if (detail.state !== 'SCHOOL_RESPONSE_WINDOW') {
      return {
        success: false,
        error: 'Referral for a re-visit happens from the response window state. Open the window first.',
      };
    }
    const moved = await transitionRun(runId, 'FIELD_COHORT', { actorUserId: scope.actor.userId });
    if (!moved?.ok) {
      return { success: false, error: moved?.ok === false ? moved.reason : 'Could not refer the case.' };
    }
    revalidatePath('/app/supervisor/discrepancies');
    return { success: true, routedTo: 'FIELD_COHORT' };
  }

  if (detail.state === 'DISCREPANCY_REVIEW' && detail.windowEnabled) {
    return {
      success: false,
      error: 'The response window is enabled, so the school must be offered it before publication.',
    };
  }
  if (detail.windowOpen) {
    return {
      success: false,
      error: 'The school\'s window is still open and it has not responded yet. Rule after it responds or after the window closes.',
    };
  }

  const byParameter = new Map(rulings.map((r) => [r.parameterId, r]));
  const missing = detail.items.filter((i) => !byParameter.has(i.parameterId));
  if (missing.length > 0) {
    return { success: false, error: `${missing.length} discrepanc${missing.length === 1 ? 'y' : 'ies'} still need a ruling.` };
  }
  for (const item of detail.items) {
    const ruling = byParameter.get(item.parameterId)!;
    if (ruling.action === 'REVISE') {
      const valid = item.levels.some((l) => l.order === ruling.revisedLevel);
      if (!valid) return { success: false, error: `Level ${ruling.revisedLevel} is not defined for ${item.code}.` };
    }
  }

  const now = new Date();
  await prisma.$transaction(
    detail.items.map((item) => {
      const ruling = byParameter.get(item.parameterId)!;
      return prisma.discrepancy.update({
        where: { runId_parameterId: { runId, parameterId: item.parameterId } },
        data: {
          upheldAt: now,
          revisedLevel: ruling.action === 'REVISE' ? ruling.revisedLevel : null,
          decidedByUserId: scope.actor.userId,
        },
      });
    }),
  );

  if (detail.response) {
    await prisma.schoolResponse.updateMany({
      where: { runId, decidedAt: null },
      data: {
        outcome: rulings.every((r) => r.action === 'UPHOLD') ? 'UPHELD' : 'REVISED',
        decidedByUserId: scope.actor.userId,
        decidedAt: now,
      },
    });
  }

  const moved = await transitionRun(runId, 'PUBLISHED', { actorUserId: scope.actor.userId });
  if (!moved?.ok) {
    return { success: false, error: moved?.ok === false ? moved.reason : 'Could not publish.' };
  }

  revalidatePath('/app/supervisor/discrepancies');
  return { success: true, routedTo: 'PUBLISHED' };
}
