'use server';

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/authz';
import { compareAuditToPrimary, drawGroupedSample } from '@/lib/verification/auditSample';

/**
 * The Audit Cell: an independent re-check of already-published verifications.
 *
 * Three rules carry the design.
 *
 * The sample is drawn unassigned and deterministically, so nobody can steer which schools
 * get audited or who audits them; claiming is first come.
 *
 * The re-verification is blind: the primary verifier's findings are simply absent from every
 * response until the auditor submits, at which point they appear for reconciliation. Hidden
 * server-side, not collapsed client-side, for the same reason the reveal gate is.
 *
 * The reconciliation verdict is a human signature. The counts computed at submission inform
 * it; they do not make it. "Proven contradiction" in the terms of reference is something a
 * person asserts and answers for.
 */

async function auditActor() {
  return requireRole('AUDIT_CELL', 'SSSA_ADMIN');
}

/**
 * The caller's profile, created on first claim. The profile exists so AuditCase can point at
 * a verifier record; certification is left NOT_STARTED deliberately, which keeps this profile
 * unassignable for desk batches and field cohorts, both of which check certification.
 */
async function myAuditProfileId(createIfMissing: boolean): Promise<string | null> {
  const actor = await auditActor();
  if (!actor) return null;
  const existing = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (existing) return existing.id;
  if (!createIfMissing) return null;
  const created = await prisma.verifierProfile.create({
    data: {
      userId: actor.userId,
      cell: 'FIELD',
      workforceSource: 'EMPANELLED',
      pseudonym: `AUD-${randomBytes(4).toString('hex').toUpperCase()}`,
    },
    select: { id: true },
  });
  return created.id;
}

export type AuditQueueRow = {
  caseId: string;
  schoolName: string;
  schoolUdise: string;
  districtName: string;
  sampledAt: string;
  mine: boolean;
  submittedAt: string | null;
  reconciledAt: string | null;
  contradicted: boolean | null;
  findingCount: number;
  contradictionCount: number;
};

export type AuditOverview = {
  unclaimed: AuditQueueRow[];
  mine: AuditQueueRow[];
  /** Published, field-visited, not yet sampled: the pool the next build draws from. */
  candidateCount: number;
  samplePercentage: number;
  sampleBasis: string;
};

export async function getAuditOverview(): Promise<AuditOverview | null> {
  const actor = await auditActor();
  if (!actor) return null;
  const myProfile = await myAuditProfileId(false);

  const [cases, candidateCount, config] = await Promise.all([
    prisma.auditCase.findMany({
      include: {
        run: {
          select: { school: { select: { nameEn: true, udise: true, district: { select: { nameEn: true } } } } },
        },
      },
      orderBy: { sampledAt: 'asc' },
      take: 300,
    }),
    prisma.assessmentCycleRun.count({
      where: {
        state: 'PUBLISHED',
        auditCase: null,
        fieldVisits: { some: { signedOffAt: { not: null } } },
      },
    }),
    prisma.programmeConfig.findUnique({
      where: { id: 'current' },
      select: { auditSamplePercentage: true, auditSampleBasis: true },
    }),
  ]);

  const toRow = (c: (typeof cases)[number]): AuditQueueRow => ({
    caseId: c.id,
    schoolName: c.run.school.nameEn,
    schoolUdise: c.run.school.udise,
    districtName: c.run.school.district.nameEn,
    sampledAt: c.sampledAt.toISOString(),
    mine: c.auditorProfileId !== null && c.auditorProfileId === myProfile,
    submittedAt: c.submittedAt?.toISOString() ?? null,
    reconciledAt: c.reconciledAt?.toISOString() ?? null,
    contradicted: c.contradicted,
    findingCount: c.findingCount,
    contradictionCount: c.contradictionCount,
  });

  return {
    unclaimed: cases.filter((c) => c.auditorProfileId === null).map(toRow),
    mine: cases.filter((c) => c.auditorProfileId !== null && c.auditorProfileId === myProfile).map(toRow),
    candidateCount,
    samplePercentage: config?.auditSamplePercentage ?? 3,
    sampleBasis: config?.auditSampleBasis ?? 'PER_DISTRICT',
  };
}

/**
 * Draw the sample. Deterministic per cycle and district, so running it twice adds nothing
 * new and the draw can be re-derived later to prove it was not steered.
 */
export async function buildAuditSample(): Promise<{ success: boolean; created: number; error?: string }> {
  const actor = await auditActor();
  if (!actor) return { success: false, created: 0, error: 'Not authorised.' };

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { auditSamplePercentage: true, auditSampleBasis: true },
  });
  const percentage = config?.auditSamplePercentage ?? 3;
  const basis = config?.auditSampleBasis ?? 'PER_DISTRICT';

  const candidates = await prisma.assessmentCycleRun.findMany({
    where: {
      state: 'PUBLISHED',
      auditCase: null,
      fieldVisits: { some: { signedOffAt: { not: null } } },
    },
    select: { id: true, cycleId: true, school: { select: { districtCode: true } } },
  });
  if (candidates.length === 0) return { success: true, created: 0 };

  const groups = new Map<string, string[]>();
  for (const c of candidates) {
    const key = basis === 'PER_DISTRICT' ? `${c.cycleId}:${c.school.districtCode}` : `${c.cycleId}:STATE`;
    const list = groups.get(key) ?? [];
    list.push(c.id);
    groups.set(key, list);
  }

  const drawn = drawGroupedSample('audit', groups, percentage);
  const runIds = [...drawn.values()].flat();
  if (runIds.length === 0) return { success: true, created: 0 };

  const result = await prisma.auditCase.createMany({
    data: runIds.map((runId) => ({ runId })),
    skipDuplicates: true,
  });

  revalidatePath('/app/audit');
  return { success: true, created: result.count };
}

export async function claimAuditCase(caseId: string): Promise<{ success: boolean; error?: string }> {
  const profileId = await myAuditProfileId(true);
  if (!profileId) return { success: false, error: 'Not authorised.' };

  // updateMany so two auditors claiming at once cannot both win: the second matches nothing.
  const result = await prisma.auditCase.updateMany({
    where: { id: caseId, auditorProfileId: null },
    data: { auditorProfileId: profileId },
  });
  if (result.count === 0) return { success: false, error: 'This case is already claimed.' };

  revalidatePath('/app/audit');
  return { success: true };
}

export type AuditIndicator = {
  parameterId: string;
  code: string;
  titleEn: string;
  titleHi: string;
  domainTitleEn: string;
  claimedLevel: number | null;
  levels: { order: number; labelEn: string; labelHi: string }[];
  myLevel: number | null;
  myNote: string | null;
  /** Present only after submission. The blind. */
  primaryLevel: number | null;
  primaryNote: string | null;
  primaryPhotoBlobUrl: string | null;
};

export type AuditCaseDetail = {
  caseId: string;
  schoolName: string;
  schoolUdise: string;
  blockName: string;
  districtName: string;
  submittedAt: string | null;
  reconciledAt: string | null;
  contradicted: boolean | null;
  reconciliationNote: string | null;
  findingCount: number;
  contradictionCount: number;
  indicators: AuditIndicator[];
};

const codeOrder = (a: string, b: string) => {
  const as = a.split('.').map(Number);
  const bs = b.split('.').map(Number);
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const diff = (as[i] ?? 0) - (bs[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

async function myCase(caseId: string) {
  const profileId = await myAuditProfileId(false);
  if (!profileId) return null;
  const auditCase = await prisma.auditCase.findFirst({
    where: { id: caseId, auditorProfileId: profileId },
  });
  return auditCase ? { auditCase, profileId } : null;
}

export async function getAuditCaseDetail(caseId: string): Promise<AuditCaseDetail | null> {
  const mine = await myCase(caseId);
  if (!mine) return null;
  const { auditCase } = mine;

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: auditCase.runId },
    select: {
      cycleId: true,
      schoolUdise: true,
      school: {
        select: {
          udise: true,
          nameEn: true,
          block: { select: { nameEn: true } },
          district: { select: { nameEn: true } },
        },
      },
      fieldVisits: {
        where: { signedOffAt: { not: null } },
        orderBy: { signedOffAt: 'desc' },
        take: 1,
        select: { findings: { select: { parameterId: true, observedLevel: true, note: true, photoBlobUrl: true } } },
      },
    },
  });
  if (!run) return null;

  const [submission, myFindings] = await Promise.all([
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
      include: {
        responses: {
          include: {
            parameter: {
              include: { options: { orderBy: { order: 'asc' } }, subDomain: { include: { domain: true } } },
            },
          },
        },
      },
    }),
    prisma.auditFinding.findMany({ where: { auditCaseId: caseId } }),
  ]);

  // Same fallback as the field interface: a published non-submitter still has a framework's
  // worth of indicators to re-check.
  const parameters =
    submission && submission.responses.length > 0
      ? submission.responses.map((r) => ({ parameter: r.parameter, selectedKey: r.selectedOptionKey }))
      : (
          await prisma.parameter.findMany({
            include: { options: { orderBy: { order: 'asc' } }, subDomain: { include: { domain: true } } },
          })
        ).map((parameter) => ({ parameter, selectedKey: null as string | null }));

  const mineBy = new Map(myFindings.map((f) => [f.parameterId, f]));
  // The blind, enforced at the source: before submission the primary map is empty, so there
  // is no code path by which a primary finding reaches the response.
  const primaryBy = auditCase.submittedAt
    ? new Map((run.fieldVisits[0]?.findings ?? []).map((f) => [f.parameterId, f]))
    : new Map<string, { observedLevel: number; note: string | null; photoBlobUrl: string | null }>();

  const indicators: AuditIndicator[] = parameters
    .map(({ parameter: p, selectedKey }) => {
      const claimed = p.options.find((o) => o.key === selectedKey);
      const my = mineBy.get(p.id);
      const primary = primaryBy.get(p.id);
      return {
        parameterId: p.id,
        code: p.code,
        titleEn: p.titleEn,
        titleHi: p.titleHi,
        domainTitleEn: p.subDomain.domain.titleEn,
        claimedLevel: claimed?.order ?? null,
        levels: p.options.map((o) => ({ order: o.order, labelEn: o.labelEn, labelHi: o.labelHi })),
        myLevel: my?.observedLevel ?? null,
        myNote: my?.note ?? null,
        primaryLevel: primary?.observedLevel ?? null,
        primaryNote: primary?.note ?? null,
        primaryPhotoBlobUrl: primary?.photoBlobUrl ?? null,
      };
    })
    .sort((a, b) => codeOrder(a.code, b.code));

  return {
    caseId,
    schoolName: run.school.nameEn,
    schoolUdise: run.school.udise,
    blockName: run.school.block.nameEn,
    districtName: run.school.district.nameEn,
    submittedAt: auditCase.submittedAt?.toISOString() ?? null,
    reconciledAt: auditCase.reconciledAt?.toISOString() ?? null,
    contradicted: auditCase.contradicted,
    reconciliationNote: auditCase.reconciliationNote,
    findingCount: auditCase.findingCount,
    contradictionCount: auditCase.contradictionCount,
    indicators,
  };
}

export async function saveAuditFinding(
  caseId: string,
  parameterId: string,
  observedLevel: number,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const mine = await myCase(caseId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.auditCase.submittedAt) {
    return { success: false, error: 'This audit is submitted and can no longer be changed.' };
  }

  const param = await prisma.parameter.findUnique({
    where: { id: parameterId },
    select: { options: { select: { order: true } } },
  });
  if (!param) return { success: false, error: 'Indicator not found.' };
  if (!param.options.some((o) => o.order === observedLevel)) {
    return { success: false, error: `Level ${observedLevel} is not defined for this indicator.` };
  }

  await prisma.auditFinding.upsert({
    where: { auditCaseId_parameterId: { auditCaseId: caseId, parameterId } },
    create: { auditCaseId: caseId, parameterId, observedLevel, note: note.trim() || null },
    update: { observedLevel, note: note.trim() || null },
  });

  revalidatePath(`/app/audit/${caseId}`);
  return { success: true };
}

/**
 * Submit the blind re-verification. This is the moment the counts are computed and the
 * primary record becomes visible; nothing before it may read the primary findings.
 */
export async function submitAuditCase(caseId: string): Promise<{ success: boolean; error?: string }> {
  const mine = await myCase(caseId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.auditCase.submittedAt) return { success: false, error: 'Already submitted.' };

  const [myFindings, run] = await Promise.all([
    prisma.auditFinding.findMany({
      where: { auditCaseId: caseId },
      select: { parameterId: true, observedLevel: true },
    }),
    prisma.assessmentCycleRun.findUnique({
      where: { id: mine.auditCase.runId },
      select: {
        fieldVisits: {
          where: { signedOffAt: { not: null } },
          orderBy: { signedOffAt: 'desc' },
          take: 1,
          select: { findings: { select: { parameterId: true, observedLevel: true } } },
        },
      },
    }),
  ]);
  if (myFindings.length === 0) {
    return { success: false, error: 'Record at least one re-checked indicator before submitting.' };
  }

  const { findingCount, contradictionCount } = compareAuditToPrimary(
    new Map(myFindings.map((f) => [f.parameterId, f.observedLevel])),
    new Map((run?.fieldVisits[0]?.findings ?? []).map((f) => [f.parameterId, f.observedLevel])),
  );

  await prisma.auditCase.update({
    where: { id: caseId },
    data: { submittedAt: new Date(), findingCount, contradictionCount },
  });

  revalidatePath(`/app/audit/${caseId}`);
  return { success: true };
}

/**
 * The signed verdict. Requires grounds when the verdict is contradiction, because this row
 * is what the de-empanelment arithmetic consumes and what the verifier will be shown.
 */
export async function reconcileAuditCase(
  caseId: string,
  contradicted: boolean,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const mine = await myCase(caseId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (!mine.auditCase.submittedAt) {
    return { success: false, error: 'Submit the re-verification first.' };
  }
  if (mine.auditCase.reconciledAt) return { success: false, error: 'Already reconciled.' };

  const trimmed = note.trim();
  if (contradicted && trimmed.length < 20) {
    return {
      success: false,
      error: 'A contradiction verdict needs its grounds in full. It counts towards de-empanelment.',
    };
  }

  await prisma.auditCase.update({
    where: { id: caseId },
    data: { contradicted, reconciledAt: new Date(), reconciliationNote: trimmed || null },
  });

  revalidatePath(`/app/audit/${caseId}`);
  revalidatePath('/app/audit');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrity reports
// ─────────────────────────────────────────────────────────────────────────────

/** Any verification role may file one, including about a supervisor, which is why the terms
 *  of reference route these to the Audit Cell and not only up the line. */
export async function fileIntegrityReport(
  body: string,
  aboutUsername?: string,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireRole(
    'VERIFIER',
    'ONLINE_VERIFIER',
    'ONGROUND_VERIFIER',
    'SUPERVISOR',
    'AUDIT_CELL',
  );
  if (!actor) return { success: false, error: 'Not authorised.' };

  const trimmed = body.trim();
  if (trimmed.length < 20) {
    return { success: false, error: 'Describe what happened: who, where, and what was offered or demanded.' };
  }

  let aboutUserId: string | null = null;
  if (aboutUsername?.trim()) {
    const about = await prisma.user.findUnique({
      where: { username: aboutUsername.trim() },
      select: { id: true },
    });
    // An unknown username is kept as text in the body rather than failing the report:
    // the person reporting pressure should not need the directory to spell it exactly.
    aboutUserId = about?.id ?? null;
  }

  await prisma.integrityReport.create({
    data: { reportedByUserId: actor.userId, aboutUserId, body: trimmed },
  });
  return { success: true };
}

export type IntegrityReportRow = {
  id: string;
  body: string;
  reportedBy: string;
  about: string | null;
  createdAt: string;
  auditAcknowledgedAt: string | null;
};

export async function getIntegrityReports(): Promise<IntegrityReportRow[]> {
  const actor = await auditActor();
  if (!actor) return [];
  const rows = await prisma.integrityReport.findMany({
    include: {
      reportedBy: { select: { name: true, username: true } },
      about: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    reportedBy: r.reportedBy.name ?? r.reportedBy.username,
    about: r.about ? (r.about.name ?? r.about.username) : null,
    createdAt: r.createdAt.toISOString(),
    auditAcknowledgedAt: r.auditAcknowledgedAt?.toISOString() ?? null,
  }));
}

/** Audit Cell only, per the schema: deliberately not settable by a supervisor, who may be
 *  the subject of the report. */
export async function acknowledgeIntegrityReport(id: string): Promise<{ success: boolean; error?: string }> {
  const actor = await requireRole('AUDIT_CELL');
  if (!actor) return { success: false, error: 'Only the Audit Cell acknowledges these.' };
  await prisma.integrityReport.update({
    where: { id },
    data: { auditAcknowledgedAt: new Date() },
  });
  revalidatePath('/app/audit/integrity');
  return { success: true };
}
