/**
 * Gives seeded complaints the filing role the public form has always required.
 *
 * "Filing As" is a required select on the public form with four values, and the Complaints list
 * now shows it as a column and filters on it. Every seeded ticket was written before that column
 * existed and carries no role at all, so the whole demo read "Not given" in a column whose point
 * is to distinguish a parent from a member of school staff.
 *
 * It targets ids beginning dummy_dispute_ rather than every ticket with an empty role. A
 * complaint filed by a real person with no role recorded is a gap in that record, and inventing
 * one would be writing fiction into it. Only the seeder's own rows are touched.
 *
 * The rota position comes from the id's own number, as in backfillComplainantNames.ts, so this
 * script and a re-seed agree on every row.
 *
 *   npx tsx prisma/backfillComplainantRoles.ts --dry-run
 *   npx tsx prisma/backfillComplainantRoles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** The id prefix seed-dummy.ts gives every complaint it creates. */
const SEEDED_PREFIX = 'dummy_dispute_';

/**
 * The four roles the form offers, weighted the way a complaints desk actually looks: mostly
 * parents, a scattering of guardians and neighbours, and the occasional member of staff
 * reporting their own school. A flat rota would have made a quarter of every list School Staff,
 * which would misrepresent the channel to anybody reading the demo.
 */
const ROTA = [
  'Parent',
  'Parent',
  'Parent',
  'Guardian',
  'Parent',
  'Community Member',
  'Parent',
  'Parent',
  'Guardian',
  'School Staff',
  'Parent',
  'Community Member',
] as const;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const seeded = await prisma.ticket.findMany({
    where: { id: { startsWith: SEEDED_PREFIX }, OR: [{ submitterRole: null }, { submitterRole: '' }] },
    select: { id: true },
  });

  if (seeded.length === 0) {
    console.log('Every seeded complaint already carries a filing role. Nothing to do.');
    return;
  }

  const planned: { id: string; role: string }[] = [];
  for (const t of seeded) {
    const n = Number.parseInt(t.id.slice(SEEDED_PREFIX.length), 10);
    // An id the seeder did not number is one this script cannot place on the rota, and
    // guessing would put a role on a row it knows nothing about.
    if (!Number.isFinite(n) || n < 1) continue;
    planned.push({ id: t.id, role: ROTA[(n - 1) % ROTA.length]! });
  }

  if (dryRun) {
    const counts = new Map<string, number>();
    for (const r of planned) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
    console.log(`Would set a filing role on ${planned.length} seeded complaints:`);
    for (const [role, n] of counts) console.log(`  ${role}: ${n}`);
    return;
  }

  for (const r of planned) {
    await prisma.ticket.update({ where: { id: r.id }, data: { submitterRole: r.role } });
  }
  console.log(`Filing roles set on ${planned.length} seeded complaints.`);
}

main()
  .catch((e) => {
    console.error('complainant roles backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
