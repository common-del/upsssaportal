/**
 * Makes the final score reflect appeal decisions.
 *
 * The app's own computeAndStoreResult builds a final score by taking the
 * verifier's answers and restoring the school's answer on every indicator where
 * the appeal was upheld. The seeders skipped that step — they wrote
 * finalScorePercent = verifierScorePercent and never revisited it — so Final and
 * Verified showed the same number on every row, including schools that had won
 * their appeal. A column that always equals its neighbour is worse than no
 * column: it reads as a bug in the arithmetic.
 *
 * This recomputes it for decided appeals, using the same domain-weighted formula
 * and the same band thresholds the app uses, and rewrites gradeBandCode with it —
 * an upheld appeal can carry a school across 40 or 76, which is the whole reason
 * a school bothers to appeal.
 *
 * Appeals still pending are left alone. Nothing has changed their score yet, so
 * final legitimately equals verified until someone decides.
 *
 *   npx tsx prisma/backfillAppealFinalScores.ts --dry-run
 *   npx tsx prisma/backfillAppealFinalScores.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** School.category values, mapped to the applicability codes parameters carry. */
const CATEGORY_TO_LEVEL: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('No active cycle. Nothing to do.');
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) return console.log('No framework for the active cycle. Nothing to do.');

  // Only upheld items matter: KEEP_VERIFIER leaves the verifier's answer standing,
  // so it cannot move the score.
  const decided = await prisma.appeal.findMany({
    where: { cycleId: cycle.id, status: 'DECIDED' },
    select: {
      schoolUdise: true,
      items: {
        where: { decision: 'ACCEPT_SCHOOL' },
        select: { parameterId: true, schoolSelectedOptionKey: true },
      },
    },
  });

  const upheld = decided.filter((a) => a.items.length > 0);
  console.log(`${decided.length} decided appeals, ${upheld.length} with at least one upheld indicator.`);
  if (upheld.length === 0) {
    return console.log('No upheld indicators, so no final score can differ. Nothing to do.');
  }

  const udises = upheld.map((a) => a.schoolUdise);
  const [params, rubrics, domains, gradeBands, vSubs, schools] = await Promise.all([
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
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        responses: { select: { parameterId: true, selectedOptionKey: true } },
      },
    }),
    prisma.school.findMany({
      where: { udise: { in: udises } },
      select: { udise: true, category: true },
    }),
  ]);

  const scoreOf = new Map(rubrics.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const weightOf = new Map(domains.map((d) => [d.id, d.weightPercent ?? 0]));
  const vBy = new Map(
    vSubs.map((v) => [v.schoolUdise, new Map(v.responses.map((r) => [r.parameterId, r.selectedOptionKey]))]),
  );
  const categoryOf = new Map(schools.map((s) => [s.udise, s.category]));

  /** The same domain-weighted formula computeAndStoreResult uses. */
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

  let changed = 0;
  let bandMoved = 0;
  for (const appeal of upheld) {
    const vMap = vBy.get(appeal.schoolUdise);
    if (!vMap) continue;

    const level = CATEGORY_TO_LEVEL[categoryOf.get(appeal.schoolUdise) ?? ''] ?? 'PRIMARY';
    const applicable = params.filter((p) => (p.applicability as string[]).includes(level));
    if (applicable.length === 0) continue;

    const verified = computeScore(vMap, applicable);

    const finalMap = new Map(vMap);
    for (const item of appeal.items) finalMap.set(item.parameterId, item.schoolSelectedOptionKey);
    const finalScore = computeScore(finalMap, applicable);
    if (finalScore == null) continue;

    const band = bandFor(finalScore);
    const before = await prisma.result.findUnique({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: appeal.schoolUdise } },
      select: { finalScorePercent: true, gradeBandCode: true },
    });
    if (!before || before.finalScorePercent === finalScore) continue;

    if (band !== before.gradeBandCode) bandMoved++;
    console.log(
      `  ${appeal.schoolUdise}: verified ${verified ?? '—'} → final ${finalScore}` +
        (band !== before.gradeBandCode ? `  (band ${before.gradeBandCode ?? '—'} → ${band ?? '—'})` : ''),
    );

    if (!dryRun) {
      await prisma.result.update({
        where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: appeal.schoolUdise } },
        data: { finalScorePercent: finalScore, gradeBandCode: band },
      });
    }
    changed++;
  }

  console.log(
    `\n${changed} final scores recomputed` + (bandMoved > 0 ? `, ${bandMoved} crossing a band` : ''),
  );
  if (dryRun) console.log('--dry-run: nothing written.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
