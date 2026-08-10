/**
 * Replaces the faker names on seeded complaints with names from Uttar Pradesh.
 *
 * The "Filed by" column read Gerard Steuber, Harley Bechtelar, Jaclyn
 * Fay-Spencer — faker.person.fullName() output, sitting next to school names
 * that were Indianised months ago.
 *
 * It targets ids beginning dummy_dispute_ rather than trying to recognise a
 * faker name by its shape. That distinction matters more here than it did for
 * school names: a complaint carries the name of a real person who filed it, and
 * a heuristic that misfires would overwrite it. Matching the seeder's own id
 * prefix cannot touch anything a member of the public submitted.
 *
 *   npx tsx prisma/backfillComplainantNames.ts --dry-run
 *   npx tsx prisma/backfillComplainantNames.ts
 */
import { PrismaClient } from '@prisma/client';
import { personName } from './indianPersonNames';

const prisma = new PrismaClient();

/** The id prefix seed-dummy.ts gives every complaint it creates. */
const SEEDED_PREFIX = 'dummy_dispute_';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const seeded = await prisma.ticket.findMany({
    where: { id: { startsWith: SEEDED_PREFIX } },
    select: { id: true, submitterName: true },
  });

  if (seeded.length === 0) {
    console.log('No seeded complaints. Nothing to do.');
    return;
  }

  // The rota position comes from the id's own number, not from row order. The
  // seeder names ticket N with personName(N - 1), so reading the number back
  // makes this script and a re-seed agree on every row. Sorting by id would not:
  // dummy_dispute_10 sorts before dummy_dispute_2, and the two would disagree.
  const renames = seeded
    .map((t) => {
      const n = Number(t.id.slice(SEEDED_PREFIX.length));
      return Number.isInteger(n) && n > 0
        ? { id: t.id, from: t.submitterName, to: personName(n - 1) }
        : null;
    })
    .filter((r): r is { id: string; from: string | null; to: string } => r !== null)
    .filter((r) => r.from !== r.to);

  if (renames.length === 0) {
    console.log(`${seeded.length} seeded complaints already carry UP names.`);
    return;
  }

  console.log(`${renames.length} of ${seeded.length} seeded complaints need renaming.`);
  for (const r of renames.slice(0, 8)) console.log(`  ${r.from ?? '(none)'} → ${r.to}`);
  if (renames.length > 8) console.log(`  … and ${renames.length - 8} more`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  for (const r of renames) {
    await prisma.ticket.update({ where: { id: r.id }, data: { submitterName: r.to } });
  }
  console.log(`\n✓ ${renames.length} complainants renamed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
