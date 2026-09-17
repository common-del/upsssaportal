import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Retires the district logins.
 *
 * Monitoring and complaint handling are run from the SSSA admin, whose own Monitoring and
 * Complaints pages already cover every district, so a separate district sign-in offered a
 * second way into work one team does. No login tab accepts these roles any more.
 *
 * Deactivated rather than deleted, exactly as the supervisor and audit accounts were. A
 * district official may have filed or answered a complaint, and deleting the user would take
 * the author off those timeline entries; deactivating keeps the record intact and makes the
 * decision reversible if districts are staffed again.
 *
 * Runs on every deploy and is idempotent: it only touches accounts that are still active, and
 * says so when there is nothing to do.
 */

const DISTRICT_ROLES = ['DISTRICT_OFFICIAL', 'DISTRICT_ADMIN'];

async function main() {
  const live = await prisma.user.findMany({
    where: { role: { in: DISTRICT_ROLES }, active: true },
    select: { username: true, role: true },
    orderBy: { username: 'asc' },
  });

  if (live.length === 0) {
    console.log('district logins: already retired, nothing to do');
    return;
  }

  const { count } = await prisma.user.updateMany({
    where: { role: { in: DISTRICT_ROLES }, active: true },
    data: { active: false },
  });

  const shown = live.slice(0, 5).map((u) => u.username).join(', ');
  console.log(
    `district logins: deactivated ${count} account${count === 1 ? '' : 's'} (${shown}${live.length > 5 ? `, and ${live.length - 5} more` : ''})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
