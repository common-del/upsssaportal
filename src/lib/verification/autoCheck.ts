import { prisma } from '@/lib/db';
import type { AutoCheckOutcome } from '@prisma/client';
import { adapterFor, type ExternalReading } from './adapters';
import { mappingFor } from './indicatorSources';

/**
 * Stage 3 of the pipeline: cross-match a school's self-assessment against the government
 * systems and write one AutoCheckResult per AUTO indicator.
 *
 * Three decisions in here matter more than the code.
 *
 * MANUAL indicators get no row. It would be easy to write NOT_CHECKABLE for all sixty of
 * them and have a tidy full set, but that conflates two different things: an indicator
 * nobody expected a system to answer, and an AUTO indicator whose source came back empty.
 * The second is a data-quality problem worth counting; the first is the design. The desk
 * queue needs to tell them apart, so only AUTO indicators appear here.
 *
 * A missing reading is NOT_CHECKABLE, never MATCH. An absent record is not agreement. This
 * is the single most important line in the file: defaulting an unanswerable check to MATCH
 * would let a school claim the top level on an indicator no system can see and have the
 * portal record it as confirmed.
 *
 * A reading with no threshold rule is also NOT_CHECKABLE, with the raw value stored anyway.
 * The verifier then sees "school claims level 3, UDISE says 42 classrooms" and judges it,
 * which is honest, rather than the portal inventing a norm and declaring a mismatch.
 */

/**
 * The whole decision, separated from the database so it can be tested and read on its own.
 *
 * Pulled out deliberately: the rule "an unanswerable check is not a pass" is the one thing
 * in this file that must never regress, and it is not testable while it is buried in a loop
 * that needs a cycle run, a submission and three adapters to reach.
 */
export function decideOutcome(
  reading: ExternalReading,
  claimedLevel: number | null,
): { outcome: AutoCheckOutcome; externalValue: string | null; sourceReadAt: Date | null } {
  if (!reading.available) {
    // Never MATCH. An absent record is not agreement, and defaulting it to a pass would let
    // a school claim the top level on an indicator no system can see and have the portal
    // record that as confirmed.
    return { outcome: 'NOT_CHECKABLE', externalValue: null, sourceReadAt: null };
  }

  // Read, but not comparable: either no threshold rule turns this value into a level, or the
  // school never answered. The value is still stored so the verifier can judge it.
  if (reading.impliedLevel == null || claimedLevel == null) {
    return {
      outcome: 'NOT_CHECKABLE',
      externalValue: reading.rawValue,
      sourceReadAt: reading.readAt,
    };
  }

  return {
    outcome: reading.impliedLevel === claimedLevel ? 'MATCH' : 'MISMATCH',
    externalValue: reading.rawValue,
    sourceReadAt: reading.readAt,
  };
}

export type AutoCheckSummary = {
  runId: string;
  checked: number;
  match: number;
  mismatch: number;
  notCheckable: number;
  /** AUTO indicators whose field key is still a placeholder rather than a confirmed column. */
  unconfirmedKeys: number;
};

export async function runAutoCheck(runId: string): Promise<AutoCheckSummary | null> {
  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: { id: true, cycleId: true, schoolUdise: true },
  });
  if (!run) return null;

  // The school's own answers, and the framework's applicable indicators for its stage. Both
  // are needed: an indicator the school was never asked cannot be cross-matched.
  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
    include: {
      responses: {
        include: {
          parameter: {
            // The option's `order` is the level: this framework's three options are ordered
            // 1, 2, 3 and mean levels 1, 2, 3. Deliberately not RubricMapping.score, which
            // is the weight SSSA can edit for scoring. Identifying which level a school
            // claimed must not move when someone reweights the rubric.
            include: { options: { select: { key: true, order: true } } },
          },
        },
      },
    },
  });
  if (!submission) return null;

  const summary: AutoCheckSummary = {
    runId,
    checked: 0,
    match: 0,
    mismatch: 0,
    notCheckable: 0,
    unconfirmedKeys: 0,
  };

  for (const response of submission.responses) {
    const param = response.parameter;
    if (param.checkMethod !== 'AUTO') continue;
    if (!param.externalSource || !param.externalFieldKey) continue;

    summary.checked += 1;
    if (mappingFor(param.code).unconfirmedKey) summary.unconfirmedKeys += 1;

    const claimedLevel =
      param.options.find((o) => o.key === response.selectedOptionKey)?.order ?? null;

    const reading = await adapterFor(param.externalSource).read(
      run.schoolUdise,
      param.externalFieldKey,
    );

    const { outcome, externalValue, sourceReadAt } = decideOutcome(reading, claimedLevel);

    if (outcome === 'MATCH') summary.match += 1;
    else if (outcome === 'MISMATCH') summary.mismatch += 1;
    else summary.notCheckable += 1;

    await prisma.autoCheckResult.upsert({
      where: { runId_parameterId: { runId: run.id, parameterId: param.id } },
      create: {
        runId: run.id,
        parameterId: param.id,
        outcome,
        source: param.externalSource,
        selfReportedValue: claimedLevel == null ? null : String(claimedLevel),
        externalValue,
        sourceReadAt,
      },
      // Re-running replaces the previous answer rather than accumulating rows: the check is
      // a snapshot of two systems at a moment, and two contradictory snapshots for one
      // indicator would make the risk score depend on which was read.
      update: {
        outcome,
        source: param.externalSource,
        selfReportedValue: claimedLevel == null ? null : String(claimedLevel),
        externalValue,
        sourceReadAt,
      },
    });
  }

  return summary;
}
