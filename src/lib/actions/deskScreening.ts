'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { DeskDecision } from '@prisma/client';
import { requireRole, requireVerifier } from '@/lib/authz';
import { maskSchool, type MaskedSchool } from '@/lib/verification/masking';
import {
  computeRisk,
  rationaleRequired,
  readyToScore,
  type IndicatorVerdict,
  type Rubric,
} from '@/lib/verification/riskScore';
import { transitionRun } from '@/lib/verification/stateMachine';

/**
 * Desk screening: the Online Verifier's half of the pipeline.
 *
 * Two rules run through everything here.
 *
 * The verifier never learns which school they are looking at. Every query in this file selects
 * only `udise` and `category` from the school and immediately reduces them through maskSchool,
 * so the name is not fetched rather than fetched and then withheld. A name that never enters the
 * response cannot leak through a serialisation, a log line or a React devtools panel.
 *
 * The score stays hidden until the last decision is in. The brief asks for this so the number
 * cannot anchor the judgements still to be made, and it is enforced on the server rather than by
 * not rendering it: `getDeskCase` returns no score at all while any manual indicator is
 * undecided, so there is nothing in the payload for a curious verifier to read.
 */

export type DeskCaseIndicator = {
  parameterId: string;
  code: string;
  titleEn: string;
  titleHi: string;
  domainCode: string;
  domainTitleEn: string;
  /** What the school claimed, and the framework's text for that level. */
  claimedLevel: number | null;
  claimedLabelEn: string | null;
  /** AUTO indicators arrive decided and read-only. */
  isAuto: boolean;
  autoOutcome: string | null;
  autoExternalValue: string | null;
  autoSource: string | null;
  autoReadAt: string | null;
  /** The verifier's own decision, when they have made one. */
  decision: DeskDecision | null;
  rationale: string | null;
  escalated: boolean;
  evidenceCount: number;
};

export type DeskCase = {
  runId: string;
  school: MaskedSchool;
  indicators: DeskCaseIndicator[];
  manualCount: number;
  manualDecided: number;
  /** Null until every manual indicator has a decision. Deliberately absent, not hidden. */
  score: { value: number; band: string; aboveThreshold: boolean; basisUsed: string; basisFallbackReason: string | null } | null;
  remainingDecisions: number;
  frozen: boolean;
};

async function activeRubric(): Promise<Rubric | null> {
  const r = await prisma.riskRubric.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
  if (!r) return null;
  return {
    version: r.version,
    weights: r.weights as Rubric['weights'],
    thresholdBasis: r.thresholdBasis,
    thresholdValue: r.thresholdValue,
    minimumAutoIndicatorsForBasis: r.minimumAutoIndicatorsForBasis,
  };
}

async function myProfileId(): Promise<string | null> {
  const actor = await requireVerifier();
  if (!actor) return null;
  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, certification: true, deEmpanelledAt: true },
  });
  if (!profile) return null;
  // Certification is a hard gate, per the terms of reference: empanelment is activated only
  // after it is cleared. An uncertified or de-empanelled verifier holds no queue.
  if (profile.certification !== 'CERTIFIED' || profile.deEmpanelledAt) return null;
  return profile.id;
}

export type DeskQueueRow = {
  runId: string;
  maskedCode: string;
  category: string;
  /** Manual indicators still needing a decision. */
  remaining: number;
  total: number;
  automatedMismatches: number;
  /** Days left against the turnaround window, negative when overdue. */
  daysLeft: number | null;
  escalated: boolean;
};

/** The verifier's own batch, and nothing else. */
export async function getDeskQueue(): Promise<DeskQueueRow[]> {
  const profileId = await myProfileId();
  if (!profileId) return [];

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { videoWalkthroughTurnaroundDays: true },
  });
  const turnaroundDays = config?.videoWalkthroughTurnaroundDays ?? 7;

  const runs = await prisma.assessmentCycleRun.findMany({
    where: { deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' },
    select: {
      id: true,
      enteredStateAt: true,
      // Only the two fields the mask needs. The name is not selected.
      school: { select: { udise: true, category: true } },
      autoChecks: { select: { outcome: true } },
      deskDecisions: { select: { parameterId: true, escalated: true } },
    },
    orderBy: { enteredStateAt: 'asc' },
  });

  const rows: DeskQueueRow[] = [];
  for (const run of runs) {
    const manual = await prisma.parameter.count({
      where: { checkMethod: 'MANUAL', isActive: true },
    });
    const decided = run.deskDecisions.length;
    const due = new Date(run.enteredStateAt.getTime() + turnaroundDays * 86_400_000);
    rows.push({
      runId: run.id,
      ...maskSchool(run.school),
      remaining: Math.max(0, manual - decided),
      total: manual,
      automatedMismatches: run.autoChecks.filter((a) => a.outcome === 'MISMATCH').length,
      daysLeft: Math.ceil((due.getTime() - Date.now()) / 86_400_000),
      escalated: run.deskDecisions.some((d) => d.escalated),
    });
  }
  return rows;
}

/** One case, with the school masked and the score withheld until the work is done. */
export async function getDeskCase(runId: string): Promise<DeskCase | null> {
  const profileId = await myProfileId();
  if (!profileId) return null;

  const run = await prisma.assessmentCycleRun.findFirst({
    // Scoped to the caller's own batch. A run belonging to another verifier is not found
    // rather than refused, so the queue cannot be enumerated by trying ids.
    where: { id: runId, deskAssigneeProfileId: profileId },
    select: {
      id: true,
      cycleId: true,
      schoolUdise: true,
      school: { select: { udise: true, category: true } },
    },
  });
  if (!run) return null;

  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
    include: {
      responses: {
        include: {
          parameter: {
            include: {
              options: { orderBy: { order: 'asc' } },
              subDomain: { include: { domain: true } },
            },
          },
        },
      },
    },
  });
  if (!submission) return null;

  const [autoChecks, decisions, evidenceLinks] = await Promise.all([
    prisma.autoCheckResult.findMany({ where: { runId: run.id } }),
    prisma.deskScreeningDecision.findMany({ where: { runId: run.id } }),
    prisma.evidenceLink.findMany({
      where: { kind: 'SELF_RESPONSE', saSubmissionId: submission.id },
      select: { parameterId: true },
    }),
  ]);

  const autoBy = new Map(autoChecks.map((a) => [a.parameterId, a]));
  const decisionBy = new Map(decisions.map((d) => [d.parameterId, d]));
  const evidenceBy = new Map<string, number>();
  for (const l of evidenceLinks) {
    if (l.parameterId) evidenceBy.set(l.parameterId, (evidenceBy.get(l.parameterId) ?? 0) + 1);
  }

  const indicators: DeskCaseIndicator[] = submission.responses.map((r) => {
    const p = r.parameter;
    const claimed = p.options.find((o) => o.key === r.selectedOptionKey);
    const a = autoBy.get(p.id);
    const d = decisionBy.get(p.id);
    return {
      parameterId: p.id,
      code: p.code,
      titleEn: p.titleEn,
      titleHi: p.titleHi,
      domainCode: p.subDomain.domain.code,
      domainTitleEn: p.subDomain.domain.titleEn,
      claimedLevel: claimed?.order ?? null,
      claimedLabelEn: claimed?.labelEn ?? null,
      isAuto: p.checkMethod === 'AUTO',
      autoOutcome: a?.outcome ?? null,
      autoExternalValue: a?.externalValue ?? null,
      autoSource: a?.source ?? null,
      autoReadAt: a?.sourceReadAt?.toISOString() ?? null,
      decision: d?.decision ?? null,
      rationale: d?.rationale ?? null,
      escalated: d?.escalated ?? false,
      evidenceCount: evidenceBy.get(p.id) ?? 0,
    };
  });

  const manualCount = indicators.filter((i) => !i.isAuto).length;
  const manualDecided = indicators.filter((i) => !i.isAuto && i.decision !== null).length;
  const { ready, remaining } = readyToScore(manualCount, manualDecided);
  const frozen = indicators.some((i) => i.escalated);

  let score: DeskCase['score'] = null;
  if (ready) {
    const rubric = await activeRubric();
    if (rubric) {
      const verdicts: IndicatorVerdict[] = indicators.map((i) => ({
        parameterCode: i.code,
        domainCode: i.domainCode,
        ...(i.isAuto
          ? { autoOutcome: (i.autoOutcome ?? undefined) as IndicatorVerdict['autoOutcome'] }
          : { deskDecision: i.decision ?? undefined }),
      }));
      const r = computeRisk(
        { verdicts, applicableCount: indicators.length, escalated: frozen },
        rubric,
      );
      score = {
        value: r.score,
        band: r.band,
        aboveThreshold: r.aboveThreshold,
        basisUsed: r.basisUsed,
        basisFallbackReason: r.basisFallbackReason,
      };
    }
  }

  return {
    runId: run.id,
    school: maskSchool(run.school),
    indicators,
    manualCount,
    manualDecided,
    score,
    remainingDecisions: remaining,
    frozen,
  };
}

export async function saveDeskDecision(
  runId: string,
  parameterId: string,
  decision: DeskDecision,
  rationale: string,
): Promise<{ success: boolean; error?: string }> {
  const profileId = await myProfileId();
  if (!profileId) return { success: false, error: 'Not authorised.' };

  const run = await prisma.assessmentCycleRun.findFirst({
    where: { id: runId, deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' },
    select: { id: true },
  });
  if (!run) return { success: false, error: 'Case not found in your batch.' };

  const trimmed = rationale.trim();
  // Enforced here and not only in the form. The schema cannot express "required unless the
  // decision is EVIDENCE_SUPPORTS_LEVEL", and a decision recorded against a school without a
  // reason is the one thing an appeal cannot argue with.
  if (rationaleRequired(decision) && trimmed.length === 0) {
    return { success: false, error: 'A reason is required for this decision.' };
  }

  const param = await prisma.parameter.findUnique({
    where: { id: parameterId },
    select: { checkMethod: true },
  });
  if (!param) return { success: false, error: 'Indicator not found.' };
  // AUTO results are the system's, and the brief says they are read-only to the verifier. A
  // verifier who disagrees with a cross-match escalates instead.
  if (param.checkMethod === 'AUTO') {
    return { success: false, error: 'This indicator is checked automatically and cannot be decided here.' };
  }

  await prisma.deskScreeningDecision.upsert({
    where: { runId_parameterId: { runId, parameterId } },
    create: { runId, parameterId, profileId, decision, rationale: trimmed || null },
    update: { decision, rationale: trimmed || null, profileId },
  });

  revalidatePath(`/app/verifier/desk/${runId}`);
  return { success: true };
}

/**
 * Escalate one indicator, which freezes the whole case.
 *
 * Per-indicator rather than per-case so the supervisor sees which judgement could not be made,
 * and freezing the case rather than just flagging it because the brief is explicit: a verifier
 * who cannot apply the rubric should not go on to produce a score that implies they did.
 */
export async function escalateIndicator(
  runId: string,
  parameterId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const profileId = await myProfileId();
  if (!profileId) return { success: false, error: 'Not authorised.' };

  const trimmed = reason.trim();
  if (trimmed.length === 0) return { success: false, error: 'Say what cannot be resolved.' };

  const run = await prisma.assessmentCycleRun.findFirst({
    where: { id: runId, deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' },
    select: { id: true },
  });
  if (!run) return { success: false, error: 'Case not found in your batch.' };

  await prisma.deskScreeningDecision.upsert({
    where: { runId_parameterId: { runId, parameterId } },
    create: {
      runId,
      parameterId,
      profileId,
      // Recorded as insufficient rather than left null: an escalated indicator still needs a
      // decision value for the rubric, and "the evidence did not let me decide" is the honest
      // one. The escalated flag is what routes it.
      decision: 'EVIDENCE_INSUFFICIENT',
      rationale: trimmed,
      escalated: true,
      escalatedAt: new Date(),
    },
    update: { escalated: true, escalatedAt: new Date(), rationale: trimmed, profileId },
  });

  revalidatePath(`/app/verifier/desk/${runId}`);
  return { success: true };
}

/**
 * Finish the case: store the score against its rubric version and route the school.
 *
 * Above the threshold goes to a video walkthrough, below it to the census queue. That is the
 * only thing this score decides.
 */
export async function completeDeskScreening(
  runId: string,
): Promise<{ success: boolean; error?: string; routedTo?: string }> {
  const profileId = await myProfileId();
  if (!profileId) return { success: false, error: 'Not authorised.' };

  const actor = await requireVerifier();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const deskCase = await getDeskCase(runId);
  if (!deskCase) return { success: false, error: 'Case not found in your batch.' };

  if (deskCase.remainingDecisions > 0) {
    return {
      success: false,
      error: `${deskCase.remainingDecisions} indicator(s) still need a decision.`,
    };
  }
  if (deskCase.frozen) {
    return {
      success: false,
      error: 'This case is escalated and frozen until a supervisor resolves it.',
    };
  }
  if (!deskCase.score) return { success: false, error: 'No active risk rubric.' };

  const rubric = await prisma.riskRubric.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!rubric) return { success: false, error: 'No active risk rubric.' };

  await prisma.riskScore.create({
    data: {
      runId,
      rubricId: rubric.id,
      score: deskCase.score.value,
      band: deskCase.score.band,
      aboveThreshold: deskCase.score.aboveThreshold,
      autoCheckedCount: deskCase.indicators.filter(
        (i) => i.isAuto && (i.autoOutcome === 'MATCH' || i.autoOutcome === 'MISMATCH'),
      ).length,
      manualDecidedCount: deskCase.manualDecided,
      applicableCount: deskCase.indicators.length,
    },
  });

  const next = deskCase.score.aboveThreshold ? 'VIDEO_WALKTHROUGH' : 'CENSUS_QUEUE';
  const moved = await transitionRun(runId, next, { actorUserId: actor.userId });
  if (!moved?.ok) {
    return { success: false, error: moved?.ok === false ? moved.reason : 'Could not route the case.' };
  }

  revalidatePath('/app/verifier/desk');
  return { success: true, routedTo: next };
}

/** Batch allocation, for the Supervisor's roster screen in a later step. */
export async function allocateDeskCases(
  profileId: string,
  runIds: string[],
): Promise<{ success: boolean; allocated: number; error?: string }> {
  const actor = await requireRole('SUPERVISOR', 'SSSA_ADMIN');
  if (!actor) return { success: false, allocated: 0, error: 'Not authorised.' };

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

  const result = await prisma.assessmentCycleRun.updateMany({
    where: { id: { in: runIds }, state: 'DESK_SCREENING' },
    data: { deskAssigneeProfileId: profileId },
  });

  revalidatePath('/app/verifier/desk');
  return { success: true, allocated: result.count };
}
