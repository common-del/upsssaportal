'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireSssa } from '@/lib/authz';
import type { RiskThresholdBasis } from '@prisma/client';

/**
 * SSSA PMU administration: the programme configuration with its audit trail, and rubric
 * versioning. Build step 8.
 *
 * Status reporting and publication control used to live here too, behind the Reporting tab.
 * Both are gone: the district and division rollups on SSSA's instruction, and the publication
 * button because publication no longer needs one. What it did is in
 * `@/lib/verification/publishQueue`, fired by the events that finish a school's year rather
 * than by a person pressing something two hundred schools at a time.
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
