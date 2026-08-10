/**
 * Recomputes every stored score from the answers that produced it.
 *
 * Three writers had been setting Result rows and they disagreed.
 * seedMockPerformanceSchools gives each mock school a random score and a band
 * hardcoded to NEEDS_IMPROVEMENT or EXCELLENT, so a school could hold a score of
 * 54 labelled "Needs Improvement" — a band that contradicts its own number.
 * seedVerificationActivity then wrote real computed results with
 * skipDuplicates: true, which silently skipped every school that already had a
 * row, leaving the random figures in place beneath genuine responses.
 *
 * The Appeals table shows self, verified and final side by side, so any
 * disagreement between them is visible as arithmetic that does not add up.
 *
 * This makes the responses authoritative. For every school with a
 * self-assessment it recomputes:
 *
 *   self      — the school's own answers
 *   verified  — the verifier's answers, null until a verifier submits
 *   final     — the verifier's answers with the school's restored on every
 *               indicator where an appeal was upheld
 *   band      — derived from final, never stored independently of it
 *
 * The formula and the band thresholds are the ones computeAndStoreResult uses,
 * so a school recomputed here scores exactly what the app would give it.
 *
 *   npx tsx prisma/backfillResultsFromResponses.ts --dry-run
 *   npx tsx prisma/backfillResultsFromResponses.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** School.category values, mapped to the applicability codes parameters carry. */
const CATEGORY_TO_LEVEL: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

/** Floats compared with a tolerance: both sides are rounded to one decimal, so
 *  anything smaller is representation noise rather than a real change. */
const EPSILON = 0.05;
const same = (a: number | null, b: number | null) =>
  a == null && b == null ? true : a == null || b == null ? false : Math.abs(a - b) < EPSILON;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('No active cycle. Nothing to do.');
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) return console.log('No framework for the active cycle. Nothing to do.');

  const [params, rubrics, domains, gradeBands] = await Promise.all([
    prisma.parameter.findMany({
      where: { frameworkId: framework.id, isActive: true },
      select: {
        id: true,
        applicability: true,
        subDomain: { select: { domainId: true } },
        options: { where: { isActive: true }, select: { key: true } },
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
  ]);

  if (params.length === 0 || rubrics.length === 0) {
    return console.log('No parameters or no rubric on this framework. Nothing can be computed.');
  }

  const scoreOf = new Map(rubrics.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const weightOf = new Map(domains.map((d) => [d.id, d.weightPercent ?? 0]));

  /** The domain-weighted formula from computeAndStoreResult. */
  function computeScore(responses: Map<string, string>, applicable: typeof params) {
    const groups = new Map<string, { achieved: number; possible: number }>();
    for (const p of applicable) {
      const domainId = p.subDomain.domainId;
      if (!groups.has(domainId)) groups.set(domainId, { achieved: 0, possible: 0 });
      const g = groups.get(domainId)!;
      g.possible += Math.max(0, ...p.options.map((o) => scoreOf.get(`${p.id}:${o.key}`) ?? 0));
      const key = responses.get(p.id);
      if (key) g.achieved += scoreOf.get(`${p.id}:${key}`) ?? 0;
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [domainId, g] of groups) {
      const w = weightOf.get(domainId) ?? 0;
      if (w > 0 && g.possible > 0) {
        weightedSum += (g.achieved / g.possible) * w;
        totalWeight += w;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;
  }

  const bandFor = (score: number | null) => {
    if (score == null) return null;
    for (let i = 0; i < gradeBands.length; i++) {
      const b = gradeBands[i]!;
      const last = i === gradeBands.length - 1;
      if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) return b.key;
    }
    return null;
  };

  // Only schools that have answered something. A school with no self-assessment
  // has no score to recompute and its Result row, if any, is not this pass's business.
  const saSubs = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id },
    select: {
      schoolUdise: true,
      responses: { select: { parameterId: true, selectedOptionKey: true } },
    },
  });
  if (saSubs.length === 0) return console.log('No self-assessments. Nothing to do.');

  const udises = saSubs.map((s) => s.schoolUdise);
  const [vSubs, appeals, schools, existing] = await Promise.all([
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        responses: { select: { parameterId: true, selectedOptionKey: true } },
      },
    }),
    // Upheld items only: KEEP_VERIFIER leaves the verifier's answer standing and
    // cannot move the final score.
    prisma.appeal.findMany({
      where: { cycleId: cycle.id, status: 'DECIDED', schoolUdise: { in: udises } },
      select: {
        schoolUdise: true,
        items: {
          where: { decision: 'ACCEPT_SCHOOL' },
          select: { parameterId: true, schoolSelectedOptionKey: true },
        },
      },
    }),
    prisma.school.findMany({
      where: { udise: { in: udises } },
      select: { udise: true, category: true },
    }),
    prisma.result.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: {
        schoolUdise: true,
        selfScorePercent: true,
        verifierScorePercent: true,
        finalScorePercent: true,
        gradeBandCode: true,
      },
    }),
  ]);

  const vBy = new Map(
    vSubs.map((v) => [v.schoolUdise, new Map(v.responses.map((r) => [r.parameterId, r.selectedOptionKey]))]),
  );
  const upheldBy = new Map(appeals.map((a) => [a.schoolUdise, a.items]));
  const categoryOf = new Map(schools.map((s) => [s.udise, s.category]));
  const existingBy = new Map(existing.map((r) => [r.schoolUdise, r]));

  const applicableCache = new Map<string, typeof params>();
  const applicableFor = (category: string) => {
    const level = CATEGORY_TO_LEVEL[category] ?? 'PRIMARY';
    if (!applicableCache.has(level)) {
      applicableCache.set(
        level,
        params.filter((p) => (p.applicability as string[]).includes(level)),
      );
    }
    return applicableCache.get(level)!;
  };

  let checked = 0;
  let rewritten = 0;
  let bandFixed = 0;
  const samples: string[] = [];

  for (const sa of saSubs) {
    const applicable = applicableFor(categoryOf.get(sa.schoolUdise) ?? '');
    if (applicable.length === 0) continue;
    checked++;

    // An empty response set is not a score of zero. computeScore returns 0 when
    // nothing has been answered — achieved 0 out of a real possible — and storing
    // that reads as "this school scored nothing", which is untrue for a school
    // that has merely opened the form, and drags down every average it lands in.
    const selfMap = new Map(sa.responses.map((r) => [r.parameterId, r.selectedOptionKey]));
    const selfScorePercent = selfMap.size > 0 ? computeScore(selfMap, applicable) : null;

    const raw = vBy.get(sa.schoolUdise);
    const vMap = raw && raw.size > 0 ? raw : null;
    const verifierScorePercent = vMap ? computeScore(vMap, applicable) : null;

    // No final score without a verifier score, matching computeAndStoreResult.
    let finalScorePercent: number | null = null;
    if (vMap) {
      const finalMap = new Map(vMap);
      for (const item of upheldBy.get(sa.schoolUdise) ?? []) {
        finalMap.set(item.parameterId, item.schoolSelectedOptionKey);
      }
      finalScorePercent = computeScore(finalMap, applicable);
    }
    const gradeBandCode = bandFor(finalScorePercent);

    const was = existingBy.get(sa.schoolUdise);
    const unchanged =
      was &&
      same(was.selfScorePercent, selfScorePercent) &&
      same(was.verifierScorePercent, verifierScorePercent) &&
      same(was.finalScorePercent, finalScorePercent) &&
      was.gradeBandCode === gradeBandCode;
    if (unchanged) continue;

    if (was && was.gradeBandCode !== gradeBandCode) bandFixed++;
    if (samples.length < 6 && was) {
      samples.push(
        `  ${sa.schoolUdise}: self ${was.selfScorePercent ?? '—'}→${selfScorePercent ?? '—'}, ` +
          `verified ${was.verifierScorePercent ?? '—'}→${verifierScorePercent ?? '—'}, ` +
          `final ${was.finalScorePercent ?? '—'}→${finalScorePercent ?? '—'}`,
      );
    }

    if (!dryRun) {
      await prisma.result.upsert({
        where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: sa.schoolUdise } },
        create: {
          cycleId: cycle.id,
          schoolUdise: sa.schoolUdise,
          frameworkId: framework.id,
          selfScorePercent,
          verifierScorePercent,
          finalScorePercent,
          gradeBandCode,
          publishedAt: new Date(),
        },
        update: { selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode },
      });
    }
    rewritten++;
  }

  for (const s of samples) console.log(s);
  if (rewritten > samples.length) console.log(`  … and ${rewritten - samples.length} more`);

  console.log(
    `\n${checked} schools checked, ${rewritten} results rewritten` +
      (bandFixed > 0 ? `, ${bandFixed} bands corrected` : ''),
  );
  if (dryRun) console.log('--dry-run: nothing written.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
