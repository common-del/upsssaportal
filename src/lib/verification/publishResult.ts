import { prisma } from '@/lib/db';
import {
  applyCorrections,
  domainWeightedPercent,
  gradeBandFor,
  type ScorableParameter,
} from '@/lib/verification/scoreFormula';

/**
 * What "publish" means: the moment a run enters PUBLISHED, the Result row the public site
 * reads is recomputed from the verified record, not left as whatever the school claimed.
 *
 * The verified record, in order of what exists:
 *
 *   A school with a self-assessment starts from its own claims; every discrepancy the
 *   supervisor upheld replaces the claim on that indicator with the ruled level. A clean
 *   verification therefore publishes the claims unchanged, which is the point of a clean
 *   verification.
 *
 *   A non-submitter has no claims, so the field verifier's observed levels ARE the record.
 *
 * Called by the state machine before it writes the PUBLISHED state, and it can refuse: a
 * ruling whose level maps to no option, or a run with nothing scorable at all, blocks
 * publication with a reason instead of publishing a blank or mis-scored result. The brief
 * names a school "published from a state that never verified anything" as the failure this
 * pipeline exists to prevent, and an unscoreable publication is that failure.
 */

export type PublishComputation =
  | {
      ok: true;
      selfScorePercent: number | null;
      finalScorePercent: number;
      gradeBandCode: string | null;
    }
  | { ok: false; reason: string };

export async function computeVerifiedResult(runId: string): Promise<PublishComputation> {
  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: {
      cycleId: true,
      schoolUdise: true,
      school: { select: { category: true } },
      discrepancies: {
        where: { upheldAt: { not: null } },
        select: { parameterId: true, proposedLevel: true, revisedLevel: true },
      },
      fieldVisits: {
        where: { signedOffAt: { not: null } },
        orderBy: { signedOffAt: 'desc' },
        take: 1,
        select: { findings: { select: { parameterId: true, observedLevel: true } } },
      },
    },
  });
  if (!run) return { ok: false, reason: 'Run not found.' };

  const framework = await prisma.framework.findUnique({
    where: { cycleId: run.cycleId },
    select: { id: true },
  });
  if (!framework) return { ok: false, reason: 'No framework exists for this cycle.' };

  const [parameters, rubricRows, domains, bands, submission] = await Promise.all([
    prisma.parameter.findMany({
      where: { frameworkId: framework.id, isActive: true },
      select: {
        id: true,
        applicability: true,
        subDomain: { select: { domainId: true } },
        options: { select: { key: true, order: true } },
      },
    }),
    prisma.rubricMapping.findMany({
      where: { frameworkId: framework.id },
      select: { parameterId: true, optionKey: true, score: true },
    }),
    prisma.sqaafDomain.findMany({
      where: { frameworkId: framework.id, isActive: true },
      select: { id: true, weightPercent: true },
    }),
    prisma.gradeBand.findMany({
      where: { frameworkId: framework.id },
      select: { key: true, minPercent: true, maxPercent: true },
      orderBy: { order: 'asc' },
    }),
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
      select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
  ]);

  const categoryToCode: Record<string, string> = {
    Primary: 'PRIMARY',
    'Upper Primary': 'UPPER_PRIMARY',
    Secondary: 'SECONDARY',
  };
  const level = categoryToCode[run.school.category] ?? 'PRIMARY';
  const applicable: ScorableParameter[] = parameters
    .filter((p) => (p.applicability as string[]).includes(level))
    .map((p) => ({
      id: p.id,
      domainId: p.subDomain.domainId,
      optionKeys: p.options.map((o) => o.key),
    }));

  const rubric = new Map(rubricRows.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const weights = new Map(domains.map((d) => [d.id, d.weightPercent ?? 0]));
  const orderToKey = new Map(
    parameters.flatMap((p) => p.options.map((o) => [`${p.id}:${o.order}`, o.key] as const)),
  );

  const claims = new Map((submission?.responses ?? []).map((r) => [r.parameterId, r.selectedOptionKey]));

  // The corrections. A submitter's record is corrected by upheld rulings; a non-submitter's
  // record is the field findings themselves, because there is nothing else it could be.
  const corrections = submission
    ? run.discrepancies.map((d) => ({
        parameterId: d.parameterId,
        level: d.revisedLevel ?? d.proposedLevel,
      }))
    : (run.fieldVisits[0]?.findings ?? []).map((f) => ({
        parameterId: f.parameterId,
        level: f.observedLevel,
      }));

  const { responses: verified, unmapped } = applyCorrections(claims, corrections, orderToKey);
  if (unmapped.length > 0) {
    return {
      ok: false,
      reason: `${unmapped.length} correction(s) name a level that no longer exists on the indicator. Fix the framework or the ruling before publishing.`,
    };
  }

  const selfScorePercent = submission ? domainWeightedPercent(applicable, rubric, weights, claims) : null;
  const finalScorePercent = domainWeightedPercent(applicable, rubric, weights, verified);
  if (finalScorePercent === null) {
    return {
      ok: false,
      reason: 'Nothing scorable: the school has no claims and no signed-off field findings. This run has not verified anything and cannot publish.',
    };
  }

  const gradeBandCode = gradeBandFor(finalScorePercent, bands);

  const existing = await prisma.result.findUnique({
    where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
    select: { publishedAt: true },
  });

  await prisma.result.upsert({
    where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
    create: {
      cycleId: run.cycleId,
      schoolUdise: run.schoolUdise,
      frameworkId: framework.id,
      selfScorePercent,
      verifierScorePercent: finalScorePercent,
      finalScorePercent,
      gradeBandCode,
      publishedAt: new Date(),
    },
    update: {
      selfScorePercent,
      verifierScorePercent: finalScorePercent,
      finalScorePercent,
      gradeBandCode,
      // First publication only: a correction republished after an appeal keeps the date the
      // public first saw a score, which is the date that matters to the public record.
      publishedAt: existing?.publishedAt ?? new Date(),
    },
  });

  return { ok: true, selfScorePercent, finalScorePercent, gradeBandCode };
}
