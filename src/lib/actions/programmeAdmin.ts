'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireSssa } from '@/lib/authz';
import { transitionRun } from '@/lib/verification/stateMachine';
import type { RiskThresholdBasis } from '@prisma/client';

/**
 * SSSA PMU administration: the programme configuration with its audit trail, rubric
 * versioning, status reporting, and publication control. Build step 8.
 *
 * The brief's section 6 rule sits under all of it: every contested number is a stored
 * configuration, every change writes a ProgrammeConfigChange row with who and why, and the
 * screen has to say where the source documents disagree.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Programme configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The editable fields, declared. Validation reads this catalogue rather than trusting the
 * client, so a request naming any other column of ProgrammeConfig is refused by omission.
 */
const EDITABLE_FIELDS: Record<
  string,
  | { kind: 'int'; min: number; max: number; nullable?: boolean }
  | { kind: 'bool' }
  | { kind: 'enum'; values: readonly string[] }
> = {
  fieldCohortPercentage: { kind: 'int', min: 1, max: 100 },
  cohortBasis: { kind: 'enum', values: ['ANNUAL_INTAKE', 'ALL_SCHOOLS'] },
  revisitIntervalYears: { kind: 'int', min: 1, max: 10 },
  cycleSpanYears: { kind: 'int', min: 1, max: 5 },
  spotCheckMode: { kind: 'enum', values: ['FIXED_COUNT', 'PERCENTAGE'] },
  spotCheckFixedCount: { kind: 'int', min: 1, max: 100 },
  spotCheckPercentage: { kind: 'int', min: 1, max: 100 },
  spotCheckMinimum: { kind: 'int', min: 1, max: 50 },
  auditSamplePercentage: { kind: 'int', min: 1, max: 100 },
  auditSampleBasis: { kind: 'enum', values: ['PER_DISTRICT', 'STATEWIDE'] },
  deEmpanelContradictionRate: { kind: 'int', min: 1, max: 100 },
  deEmpanelMinimumAuditedCases: { kind: 'int', min: 1, max: 100 },
  deEmpanelAbsoluteCount: { kind: 'int', min: 1, max: 20 },
  submissionExtensionDays: { kind: 'int', min: 0, max: 90 },
  videoWalkthroughTurnaroundDays: { kind: 'int', min: 1, max: 60 },
  dayOfRevealHour: { kind: 'int', min: 5, max: 12 },
  schoolResponseWindowDays: { kind: 'int', min: 1, max: 60 },
  schoolResponseWindowEnabled: { kind: 'bool' },
  deskScreeningManualSampleSize: { kind: 'int', min: 1, max: 100, nullable: true },
};

export type ConfigChangeRow = {
  field: string;
  oldValue: string | null;
  newValue: string;
  actorName: string;
  reason: string | null;
  at: string;
};

export type RubricRow = {
  id: string;
  version: number;
  label: string;
  weights: Record<string, number>;
  thresholdBasis: string;
  thresholdValue: number;
  minimumAutoIndicatorsForBasis: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  scoreCount: number;
};

export type ProgrammeAdminData = {
  config: Record<string, string | number | boolean | null>;
  changes: ConfigChangeRow[];
  rubrics: RubricRow[];
};

export async function getProgrammeAdminData(): Promise<ProgrammeAdminData | null> {
  if (!(await requireSssa())) return null;

  const [config, changes, rubrics] = await Promise.all([
    prisma.programmeConfig.findUnique({ where: { id: 'current' } }),
    prisma.programmeConfigChange.findMany({
      include: { actor: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.riskRubric.findMany({
      include: {
        createdBy: { select: { name: true, username: true } },
        _count: { select: { scores: true } },
      },
      orderBy: { version: 'desc' },
    }),
  ]);
  if (!config) return null;

  const editable: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(EDITABLE_FIELDS)) {
    editable[key] = (config as unknown as Record<string, string | number | boolean | null>)[key] ?? null;
  }

  return {
    config: editable,
    changes: changes.map((c) => ({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      actorName: c.actor.name ?? c.actor.username,
      reason: c.reason,
      at: c.createdAt.toISOString(),
    })),
    rubrics: rubrics.map((r) => ({
      id: r.id,
      version: r.version,
      label: r.label,
      weights: r.weights as Record<string, number>,
      thresholdBasis: r.thresholdBasis,
      thresholdValue: r.thresholdValue,
      minimumAutoIndicatorsForBasis: r.minimumAutoIndicatorsForBasis,
      isActive: r.isActive,
      createdBy: r.createdBy.name ?? r.createdBy.username,
      createdAt: r.createdAt.toISOString(),
      scoreCount: r._count.scores,
    })),
  };
}

/**
 * Apply edits. Only fields in the catalogue, only values inside their bounds, and nothing
 * writes without a reason: a programme whose thresholds decide published accreditation
 * cannot have those thresholds change on an empty justification.
 */
export async function updateProgrammeConfig(
  updates: Record<string, string | number | boolean | null>,
  reason: string,
): Promise<{ success: boolean; changed: number; error?: string }> {
  const actor = await requireSssa();
  if (!actor) return { success: false, changed: 0, error: 'Not authorised.' };

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return { success: false, changed: 0, error: 'Give the reason for the change. It goes on the record.' };
  }

  const config = await prisma.programmeConfig.findUnique({ where: { id: 'current' } });
  if (!config) return { success: false, changed: 0, error: 'Configuration row missing.' };
  const current = config as unknown as Record<string, string | number | boolean | null>;

  const data: Record<string, string | number | boolean | null> = {};
  const changeRows: { field: string; oldValue: string | null; newValue: string }[] = [];

  for (const [field, raw] of Object.entries(updates)) {
    const spec = EDITABLE_FIELDS[field];
    if (!spec) return { success: false, changed: 0, error: `${field} is not an editable setting.` };

    let value: string | number | boolean | null;
    if (spec.kind === 'int') {
      if (raw === null || raw === '') {
        if (!spec.nullable) return { success: false, changed: 0, error: `${field} needs a value.` };
        value = null;
      } else {
        const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
        if (!Number.isInteger(n) || n < spec.min || n > spec.max) {
          return { success: false, changed: 0, error: `${field} must be a whole number from ${spec.min} to ${spec.max}.` };
        }
        value = n;
      }
    } else if (spec.kind === 'bool') {
      value = raw === true || raw === 'true';
    } else {
      const s = String(raw);
      if (!spec.values.includes(s)) {
        return { success: false, changed: 0, error: `${field} must be one of ${spec.values.join(', ')}.` };
      }
      value = s;
    }

    if (current[field] === value) continue;
    data[field] = value;
    changeRows.push({
      field,
      oldValue: current[field] === null || current[field] === undefined ? null : String(current[field]),
      newValue: value === null ? 'null' : String(value),
    });
  }

  if (changeRows.length === 0) return { success: true, changed: 0 };

  await prisma.$transaction([
    prisma.programmeConfig.update({ where: { id: 'current' }, data }),
    prisma.programmeConfigChange.createMany({
      data: changeRows.map((c) => ({
        configId: 'current',
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        actorUserId: actor.userId,
        reason: trimmedReason,
      })),
    }),
  ]);

  revalidatePath('/app/sssa/configuration');
  return { success: true, changed: changeRows.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rubric versioning
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHT_KEYS = [
  'AUTO_MISMATCH',
  'EVIDENCE_SUPPORTS_LEVEL',
  'EVIDENCE_INSUFFICIENT',
  'EVIDENCE_MISSING',
  'EVIDENCE_CONTRADICTS_LEVEL',
  'ESCALATED_RUN',
] as const;

export type NewRubricInput = {
  label: string;
  weights: Record<string, number>;
  thresholdBasis: RiskThresholdBasis;
  thresholdValue: number;
  minimumAutoIndicatorsForBasis: number;
  activate: boolean;
};

/**
 * A new rubric version. Versions are append-only and scores keep the version that computed
 * them, so activating a new rubric changes the future and provably not the past.
 */
export async function createRubricVersion(
  input: NewRubricInput,
): Promise<{ success: boolean; version?: number; error?: string }> {
  const actor = await requireSssa();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const label = input.label.trim();
  if (label.length < 5) return { success: false, error: 'Name the version so a later reader knows why it exists.' };

  const weights: Record<string, number> = {};
  for (const key of WEIGHT_KEYS) {
    const value = input.weights[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 20) {
      return { success: false, error: `${key} needs a whole-number weight from 0 to 20.` };
    }
    weights[key] = value;
  }
  if (!Number.isInteger(input.thresholdValue) || input.thresholdValue < 1 || input.thresholdValue > 100) {
    return { success: false, error: 'The threshold must be a whole number from 1 to 100.' };
  }
  if (
    !Number.isInteger(input.minimumAutoIndicatorsForBasis) ||
    input.minimumAutoIndicatorsForBasis < 0 ||
    input.minimumAutoIndicatorsForBasis > 50
  ) {
    return { success: false, error: 'The minimum AUTO indicator count must be from 0 to 50.' };
  }

  const latest = await prisma.riskRubric.findFirst({ orderBy: { version: 'desc' }, select: { version: true } });
  const version = (latest?.version ?? 0) + 1;

  await prisma.$transaction([
    ...(input.activate
      ? [prisma.riskRubric.updateMany({ where: { isActive: true }, data: { isActive: false } })]
      : []),
    prisma.riskRubric.create({
      data: {
        version,
        label,
        weights,
        thresholdBasis: input.thresholdBasis,
        thresholdValue: input.thresholdValue,
        minimumAutoIndicatorsForBasis: input.minimumAutoIndicatorsForBasis,
        isActive: input.activate,
        activatedAt: input.activate ? new Date() : null,
        createdByUserId: actor.userId,
      },
    }),
  ]);

  revalidatePath('/app/sssa/configuration');
  return { success: true, version };
}

export async function activateRubric(rubricId: string): Promise<{ success: boolean; error?: string }> {
  const actor = await requireSssa();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const rubric = await prisma.riskRubric.findUnique({ where: { id: rubricId }, select: { id: true } });
  if (!rubric) return { success: false, error: 'Rubric not found.' };

  await prisma.$transaction([
    prisma.riskRubric.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.riskRubric.update({ where: { id: rubricId }, data: { isActive: true, activatedAt: new Date() } }),
  ]);

  revalidatePath('/app/sssa/configuration');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status reporting: state, division, district
// ─────────────────────────────────────────────────────────────────────────────

export type DistrictStatusRow = {
  districtCode: string;
  districtName: string;
  mandalCode: string | null;
  mandalName: string | null;
  schools: number;
  byState: Record<string, number>;
};

export type StatusReport = {
  stateTotals: Record<string, number>;
  totalSchools: number;
  districts: DistrictStatusRow[];
};

export async function getStatusReport(): Promise<StatusReport | null> {
  if (!(await requireSssa())) return null;

  // Grouping runs by the school's district crosses a relation, which Prisma's groupBy
  // cannot do; one raw aggregate keeps this a single scan at state volume instead of
  // 2,65,278 rows shipped to the app server.
  const grouped = await prisma.$queryRaw<{ districtCode: string; state: string; count: number }[]>`
    SELECT s."districtCode" AS "districtCode", r."state"::text AS "state", COUNT(*)::int AS "count"
    FROM "AssessmentCycleRun" r
    JOIN "School" s ON s."udise" = r."schoolUdise"
    GROUP BY s."districtCode", r."state"
  `;

  const [districts, mandals, schoolCounts] = await Promise.all([
    prisma.district.findMany({ select: { code: true, nameEn: true, mandalCode: true } }),
    prisma.mandal.findMany({ select: { code: true, nameEn: true } }),
    prisma.school.groupBy({ by: ['districtCode'], _count: { _all: true } }),
  ]);

  const mandalName = new Map(mandals.map((m) => [m.code, m.nameEn]));
  const schoolsBy = new Map(schoolCounts.map((s) => [s.districtCode, s._count._all]));

  const byDistrict = new Map<string, Record<string, number>>();
  const stateTotals: Record<string, number> = {};
  for (const row of grouped) {
    const entry = byDistrict.get(row.districtCode) ?? {};
    entry[row.state] = (entry[row.state] ?? 0) + row.count;
    byDistrict.set(row.districtCode, entry);
    stateTotals[row.state] = (stateTotals[row.state] ?? 0) + row.count;
  }

  const rows: DistrictStatusRow[] = districts
    .map((d) => ({
      districtCode: d.code,
      districtName: d.nameEn,
      mandalCode: d.mandalCode,
      mandalName: d.mandalCode ? (mandalName.get(d.mandalCode) ?? null) : null,
      schools: schoolsBy.get(d.code) ?? 0,
      byState: byDistrict.get(d.code) ?? {},
    }))
    // Districts with no runs at all sit at the bottom rather than being hidden: a district
    // where nothing has started is a fact the state office needs, not noise.
    .sort((a, b) => {
      const runs = (r: DistrictStatusRow) => Object.values(r.byState).reduce((s, n) => s + n, 0);
      return runs(b) - runs(a) || a.districtName.localeCompare(b.districtName);
    });

  return {
    stateTotals,
    totalSchools: [...schoolsBy.values()].reduce((s, n) => s + n, 0),
    districts: rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Publication control
// ─────────────────────────────────────────────────────────────────────────────

export type PublicationOverview = {
  censusQueueCount: number;
  publishedCount: number;
  recent: {
    runId: string;
    schoolName: string;
    schoolUdise: string;
    districtName: string;
    publishedAt: string | null;
    finalScorePercent: number | null;
    gradeBandCode: string | null;
    corrections: number;
  }[];
};

export async function getPublicationOverview(): Promise<PublicationOverview | null> {
  if (!(await requireSssa())) return null;

  const [censusQueueCount, publishedCount, recentRuns] = await Promise.all([
    prisma.assessmentCycleRun.count({ where: { state: 'CENSUS_QUEUE' } }),
    prisma.assessmentCycleRun.count({ where: { state: 'PUBLISHED' } }),
    prisma.assessmentCycleRun.findMany({
      where: { state: 'PUBLISHED' },
      select: {
        id: true,
        cycleId: true,
        schoolUdise: true,
        enteredStateAt: true,
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
        discrepancies: { where: { upheldAt: { not: null } }, select: { id: true } },
      },
      orderBy: { enteredStateAt: 'desc' },
      take: 15,
    }),
  ]);

  const results = recentRuns.length
    ? await prisma.result.findMany({
        where: { OR: recentRuns.map((r) => ({ cycleId: r.cycleId, schoolUdise: r.schoolUdise })) },
        select: { cycleId: true, schoolUdise: true, finalScorePercent: true, gradeBandCode: true, publishedAt: true },
      })
    : [];
  const resultBy = new Map(results.map((r) => [`${r.cycleId}:${r.schoolUdise}`, r]));

  return {
    censusQueueCount,
    publishedCount,
    recent: recentRuns.map((r) => {
      const result = resultBy.get(`${r.cycleId}:${r.schoolUdise}`);
      return {
        runId: r.id,
        schoolName: r.school.nameEn,
        schoolUdise: r.schoolUdise,
        districtName: r.school.district.nameEn,
        publishedAt: result?.publishedAt?.toISOString() ?? r.enteredStateAt.toISOString(),
        finalScorePercent: result?.finalScorePercent ?? null,
        gradeBandCode: result?.gradeBandCode ?? null,
        corrections: r.discrepancies.length,
      };
    }),
  };
}

/**
 * Publish the census queue: every screened school not drawn into the field cohort, up to a
 * batch cap per press. Each run goes through the state machine individually, so each one's
 * Result is recomputed and each failure carries its own reason instead of poisoning the
 * batch. Capped because 1,75,000 in one request is a job queue, not a button.
 */
export async function publishCensusQueue(): Promise<{
  success: boolean;
  published: number;
  failed: number;
  remaining: number;
  firstErrors: string[];
  error?: string;
}> {
  const actor = await requireSssa();
  if (!actor) {
    return { success: false, published: 0, failed: 0, remaining: 0, firstErrors: [], error: 'Not authorised.' };
  }

  const BATCH = 200;
  const runs = await prisma.assessmentCycleRun.findMany({
    where: { state: 'CENSUS_QUEUE' },
    select: { id: true },
    orderBy: { enteredStateAt: 'asc' },
    take: BATCH,
  });

  let published = 0;
  let failed = 0;
  const firstErrors: string[] = [];
  for (const run of runs) {
    const moved = await transitionRun(run.id, 'PUBLISHED', { actorUserId: actor.userId });
    if (moved?.ok) published += 1;
    else {
      failed += 1;
      if (firstErrors.length < 3 && moved?.ok === false) firstErrors.push(moved.reason);
    }
  }

  const remaining = await prisma.assessmentCycleRun.count({ where: { state: 'CENSUS_QUEUE' } });
  revalidatePath('/app/sssa/reporting');
  return { success: true, published, failed, remaining, firstErrors };
}
