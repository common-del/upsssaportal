/**
 * Gives every school a login account.
 *
 * seedMockPerformanceSchools.ts creates 32,357 schools with school.createMany and
 * no corresponding User rows, so almost every school in the register has no way to
 * sign in. That is why the dashboard reads "32,378 not started, 99%": those schools
 * are not ignoring the portal, they cannot reach it.
 *
 * It also broke the reminder button on Furthest behind — there was nobody to
 * notify, which the row reported honestly as "No school accounts in this block".
 *
 * School accounts are keyed by UDISE as their username, matching seed-dummy.ts and
 * the lookup in lib/actions/users.ts. Only creates what is missing, so a school
 * that already has an account keeps its password.
 *
 *   npx tsx prisma/backfillSchoolAccounts.ts --dry-run
 *   npx tsx prisma/backfillSchoolAccounts.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Same demo password seed-dummy.ts uses, so every seeded school behaves alike.
 *  A real deployment would issue credentials rather than share one. */
const DEFAULT_PASSWORD = 'school123';
const CHUNK = 2_000;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const [schools, existing] = await Promise.all([
    prisma.school.findMany({ select: { udise: true, nameEn: true, districtCode: true } }),
    prisma.user.findMany({ where: { role: 'SCHOOL' }, select: { username: true } }),
  ]);

  const have = new Set(existing.map((u) => u.username));
  const missing = schools.filter((s) => !have.has(s.udise));

  console.log(`${schools.length} schools, ${have.size} with an account.`);
  if (missing.length === 0) {
    console.log('Every school can sign in. Nothing to do.');
    return;
  }
  console.log(`${missing.length} have no account.`);
  for (const s of missing.slice(0, 5)) console.log(`  ${s.udise}  ${s.nameEn}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  // Hashed once rather than per row: bcrypt on 32,000 rows individually would take
  // minutes and every account starts from the same demo password anyway.
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let done = 0;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = missing.slice(i, i + CHUNK);
    await prisma.user.createMany({
      data: batch.map((s) => ({
        username: s.udise,
        passwordHash,
        name: s.nameEn,
        role: 'SCHOOL',
        districtCode: s.districtCode,
      })),
      // A concurrent run, or an account created between the read and the write,
      // must not fail the whole batch.
      skipDuplicates: true,
    });
    done += batch.length;
    console.log(`  created ${done} / ${missing.length}`);
  }
  console.log(`\n✓ ${done} schools can now sign in.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
