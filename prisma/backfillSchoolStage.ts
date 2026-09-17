/**
 * Fills School.stage, the column SQAAF applicability now reads.
 *
 * Before this, applicability read `School.category` through six separate copies of a
 * `CATEGORY_TO_CODE` map, each ending `?? 'PRIMARY'`. That column holds a teaching stage for the
 * hand-seeded schools and an ownership type for everything the bulk register supplied, so every
 * bulk-register school missed the map, took the silent fallback and was judged against primary's
 * paper. The same column was also handed to Online Verifiers as the one non-identifying fact
 * about the school under review, which printed "GOVT" under the case code.
 *
 * The stage is derived, in this order:
 *
 *   1. The class range the school itself declared, by the highest class it teaches. A school
 *      running classes 1 to 10 answers the secondary indicators, whatever any label says.
 *   2. The legacy category, but only where it names a stage. "GOVT" names no stage and is left
 *      alone rather than read as one.
 *
 * A school neither source can place keeps a null stage. That is the point of the column being
 * nullable: `stageCodeFor` then applies the documented PRIMARY fallback in one visible place, and
 * the count below says how many schools are relying on it. Writing a guessed stage into the row
 * would make the guess indistinguishable from a known value and put the bug back.
 *
 * Idempotent: only rows with no stage are touched, so a re-run after a re-seed fills the new
 * rows and leaves the rest.
 *
 *   npx tsx prisma/backfillSchoolStage.ts --dry-run
 *   npx tsx prisma/backfillSchoolStage.ts
 */
import { PrismaClient } from '@prisma/client';
import { deriveStage } from '../src/lib/schoolStage';

const prisma = new PrismaClient();

/** Rows per update batch. The register is 2,65,278 schools, so this runs in chunks rather than
 *  holding every update in flight at once. */
const BATCH = 500;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const schools = await prisma.school.findMany({
    where: { stage: null },
    select: {
      udise: true,
      category: true,
      profileDetail: { select: { classesFrom: true, classesTo: true } },
    },
  });

  if (schools.length === 0) {
    console.log('Every school already carries a stage. Nothing to do.');
    return;
  }

  const planned: { udise: string; stage: string }[] = [];
  let unplaceable = 0;
  for (const s of schools) {
    const stage = deriveStage({
      category: s.category,
      classesFrom: s.profileDetail?.classesFrom ?? null,
      classesTo: s.profileDetail?.classesTo ?? null,
    });
    if (stage === null) {
      unplaceable += 1;
      continue;
    }
    planned.push({ udise: s.udise, stage });
  }

  const counts = new Map<string, number>();
  for (const p of planned) counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1);

  console.log(`${schools.length.toLocaleString('en-IN')} schools have no stage recorded.`);
  for (const [stage, n] of counts) console.log(`  ${stage}: ${n.toLocaleString('en-IN')}`);
  // Named rather than buried. These are the schools the PRIMARY fallback will cover, and the
  // number is the honest measure of how much of the applicability decision is still a default.
  console.log(
    `  no stage derivable, left null and covered by the documented fallback: ${unplaceable.toLocaleString('en-IN')}`,
  );

  if (dryRun) {
    console.log('Dry run, nothing written.');
    return;
  }

  // Grouped by stage: three statements a batch rather than one per school.
  for (const stage of counts.keys()) {
    const udises = planned.filter((p) => p.stage === stage).map((p) => p.udise);
    for (let i = 0; i < udises.length; i += BATCH) {
      await prisma.school.updateMany({
        where: { udise: { in: udises.slice(i, i + BATCH) } },
        data: { stage },
      });
    }
  }
  console.log(`Stage set on ${planned.length.toLocaleString('en-IN')} schools.`);
}

main()
  .catch((e) => {
    console.error('school stage backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
