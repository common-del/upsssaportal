/**
 * Backfills School.management.
 *
 * In production this reads the management column straight out of the UDISE extract
 * the register was loaded from — UDISE already classifies every school as
 * government, aided or private, so nothing is asked of schools and nothing is
 * guessed. `normaliseManagement` handles the wording differences between extracts.
 *
 * Against seeded data there is no extract, so this assigns values deterministically
 * from the UDISE code in roughly the real statewide proportions. That is a stand-in
 * for demo purposes and is clearly not the truth about any individual school — it
 * only runs where the column is still null, so a real import always wins.
 *
 *   npx tsx prisma/backfillSchoolManagement.ts            # seeded stand-in
 *   npx tsx prisma/backfillSchoolManagement.ts --dry-run  # report only
 */
import { PrismaClient } from '@prisma/client';
import { normaliseManagement, type ManagementCode } from '../src/lib/schoolManagement';

const prisma = new PrismaClient();

/** Roughly the statewide split: most schools are government, private next, aided
 *  a small minority. Used only when there is no extract to read. */
const DEMO_SPLIT: { code: ManagementCode; upTo: number }[] = [
  { code: 'GOVERNMENT', upTo: 60 },
  { code: 'PRIVATE', upTo: 88 },
  { code: 'AIDED', upTo: 100 },
];

function demoManagementFor(udise: string): ManagementCode {
  let h = 0;
  for (let i = 0; i < udise.length; i++) h = (h * 31 + udise.charCodeAt(i)) | 0;
  const bucket = Math.abs(h) % 100;
  return DEMO_SPLIT.find((s) => bucket < s.upTo)!.code;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const schools = await prisma.school.findMany({
    where: { management: null },
    select: { udise: true, category: true },
  });

  if (schools.length === 0) {
    console.log('Every school already has a management type. Nothing to do.');
    return;
  }

  const counts: Record<string, number> = {};
  const updates = schools.map((s) => {
    // If an extract ever writes a raw value into `category` or elsewhere, prefer it
    // over the stand-in — a real classification always beats a derived one.
    const code = normaliseManagement(s.category) ?? demoManagementFor(s.udise);
    counts[code] = (counts[code] ?? 0) + 1;
    return { udise: s.udise, code };
  });

  console.log(`${schools.length} schools without a management type.`);
  for (const [code, n] of Object.entries(counts)) {
    console.log(`  ${code.padEnd(11)} ${n} (${Math.round((n / schools.length) * 100)}%)`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  // Chunked: a single transaction over tens of thousands of updates will time out
  // on a hosted database, and this is restartable because it only touches nulls.
  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(
      updates.slice(i, i + CHUNK).map((u) =>
        prisma.school.update({ where: { udise: u.udise }, data: { management: u.code } }),
      ),
    );
    console.log(`  written ${Math.min(i + CHUNK, updates.length)} / ${updates.length}`);
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
