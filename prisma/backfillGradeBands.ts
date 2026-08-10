/**
 * Puts the official portal on the same grading scale as the public site.
 *
 * Two scales were running at once. The public site grades on Uday / Unnat /
 * Utkarsh at 55 and 80, citing the UPSQAAF School Grading Category table. The
 * GradeBand table the official portal reads used Needs Improvement /
 * Satisfactory / Excellent at 40 and 76, described in seedRealFramework.ts only
 * as matching cutoffs "already used elsewhere in the app" — an internal
 * convention, not a source.
 *
 * A school on 50% was therefore Uday to a parent and Satisfactory to an officer.
 * The published table wins: it is what has been told to the public and it cites
 * a document.
 *
 * Existing Result rows are remapped by score rather than by name, because the old
 * codes were not reliable — seedMockPerformanceSchools assigned
 * NEEDS_IMPROVEMENT or EXCELLENT from a coarse LOW/HIGH flag regardless of the
 * score stored beside it, so translating old code to new code would carry that
 * error forward.
 *
 * One boundary note. The app reads a band as min <= score < max, except the top
 * band which includes its ceiling, so exactly 55.0 lands in Unnat here while the
 * public helper's "<= 55" puts it in Uday. The published table is written for
 * whole numbers and does not define 55.5 at all, so no threshold pair can satisfy
 * both readings; this follows the app's existing convention.
 *
 *   npx tsx prisma/backfillGradeBands.ts --dry-run
 *   npx tsx prisma/backfillGradeBands.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Uday <= 55, Unnat 56-80, Utkarsh > 80, per the UPSQAAF grading table as cited
 *  in src/lib/public/dummyData.ts. */
export const GRADE_BANDS = [
  { key: 'UDAY', labelEn: 'Uday', labelHi: 'उदय', minPercent: 0, maxPercent: 55, order: 1 },
  { key: 'UNNAT', labelEn: 'Unnat', labelHi: 'उन्नत', minPercent: 55, maxPercent: 80, order: 2 },
  { key: 'UTKARSH', labelEn: 'Utkarsh', labelHi: 'उत्कर्ष', minPercent: 80, maxPercent: 100, order: 3 },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('No active cycle. Nothing to do.');
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) return console.log('No framework for the active cycle. Nothing to do.');

  const before = await prisma.gradeBand.findMany({
    where: { frameworkId: framework.id },
    select: { key: true, labelEn: true, minPercent: true, maxPercent: true },
    orderBy: { order: 'asc' },
  });
  const wanted = new Set(GRADE_BANDS.map((b) => b.key));
  const stale = before.filter((b) => !wanted.has(b.key));

  const alreadyRight =
    stale.length === 0 &&
    GRADE_BANDS.every((w) =>
      before.some(
        (b) =>
          b.key === w.key &&
          b.labelEn === w.labelEn &&
          b.minPercent === w.minPercent &&
          b.maxPercent === w.maxPercent,
      ),
    );

  if (alreadyRight) {
    console.log('Grade bands are already Uday / Unnat / Utkarsh at 55 and 80.');
  } else {
    for (const b of before) {
      console.log(`  was: ${b.key.padEnd(18)} ${b.labelEn} (${b.minPercent}–${b.maxPercent})`);
    }
    for (const b of GRADE_BANDS) {
      console.log(`  now: ${b.key.padEnd(18)} ${b.labelEn} (${b.minPercent}–${b.maxPercent})`);
    }

    if (!dryRun) {
      for (const b of GRADE_BANDS) {
        await prisma.gradeBand.upsert({
          where: { frameworkId_key: { frameworkId: framework.id, key: b.key } },
          create: { frameworkId: framework.id, ...b },
          update: b,
        });
      }
      // Removed so the table holds exactly three. Result.gradeBandCode is a plain
      // string with no foreign key, so nothing breaks — and the rows pointing at
      // these codes are rewritten by score below.
      if (stale.length > 0) {
        await prisma.gradeBand.deleteMany({
          where: { frameworkId: framework.id, key: { in: stale.map((b) => b.key) } },
        });
        console.log(`  removed ${stale.length} retired bands`);
      }
    }
  }

  // Remapped from the score, not translated from the old code.
  const counts: Record<string, number> = {};
  for (const [i, b] of GRADE_BANDS.entries()) {
    const last = i === GRADE_BANDS.length - 1;
    const where = {
      cycleId: cycle.id,
      finalScorePercent: last
        ? { gte: b.minPercent, lte: b.maxPercent }
        : { gte: b.minPercent, lt: b.maxPercent },
      NOT: { gradeBandCode: b.key },
    };
    counts[b.key] = dryRun
      ? await prisma.result.count({ where })
      : (await prisma.result.updateMany({ where, data: { gradeBandCode: b.key } })).count;
  }

  // A school with no verifier score has no final score and therefore no band.
  // Leaving a stale code there would show a grade nobody awarded.
  const unscoredWhere = {
    cycleId: cycle.id,
    finalScorePercent: null,
    NOT: { gradeBandCode: null },
  };
  const cleared = dryRun
    ? await prisma.result.count({ where: unscoredWhere })
    : (await prisma.result.updateMany({ where: unscoredWhere, data: { gradeBandCode: null } })).count;

  const moved = Object.values(counts).reduce((a, b) => a + b, 0);
  if (moved === 0 && cleared === 0) {
    console.log('Every result already carries the right band.');
  } else {
    for (const b of GRADE_BANDS) {
      if (counts[b.key]) console.log(`  ${counts[b.key]!.toLocaleString('en-IN')} → ${b.labelEn}`);
    }
    if (cleared > 0) console.log(`  ${cleared.toLocaleString('en-IN')} → no band (no verifier score)`);
    console.log(`\n${(moved + cleared).toLocaleString('en-IN')} results regraded.`);
  }

  if (dryRun) console.log('--dry-run: nothing written.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
