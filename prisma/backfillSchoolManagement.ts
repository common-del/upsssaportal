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

  // Grouped by target value, so this is three updateMany calls per chunk rather
  // than one UPDATE per school. Row-at-a-time took about six minutes for 32,579
  // schools, which is six minutes added to every deploy and a build-timeout risk;
  // this is a few seconds. Chunked because a single IN list of 32,579 ids exceeds
  // what the driver will bind.
  const CHUNK = 5_000;
  const byCode = new Map<ManagementCode, string[]>();
  for (const u of updates) byCode.set(u.code, [...(byCode.get(u.code) ?? []), u.udise]);

  let written = 0;
  for (const [code, udises] of byCode) {
    for (let i = 0; i < udises.length; i += CHUNK) {
      const slice = udises.slice(i, i + CHUNK);
      await prisma.school.updateMany({
        where: { udise: { in: slice } },
        data: { management: code },
      });
      written += slice.length;
      console.log(`  written ${written} / ${updates.length}`);
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
