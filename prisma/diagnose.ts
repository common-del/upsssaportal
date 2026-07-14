import { prisma } from '../src/lib/db';

async function main() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  console.log('Active cycle:', cycle?.name, cycle?.id);

  const lynch = await prisma.school.findFirst({
    where: { nameEn: { contains: 'Lynch', mode: 'insensitive' } },
    select: { udise: true, nameEn: true },
  });
  console.log('Lynch school row:', lynch);

  if (lynch) {
    const sub = await prisma.selfAssessmentSubmission.findFirst({
      where: { schoolUdise: lynch.udise, cycleId: cycle?.id },
    });
    const respCount = sub
      ? await prisma.selfAssessmentResponse.count({ where: { saSubmissionId: sub.id } })
      : 0;
    console.log('Lynch submission:', sub?.status, 'responses:', respCount);
    // For schools, User.username === School.udise (the login is the udise itself)
    const user = await prisma.user.findUnique({ where: { username: lynch.udise }, select: { username: true, active: true } });
    console.log('Lynch login username (== udise):', user?.username, 'active:', user?.active);
  }

  const byStatus = await prisma.selfAssessmentSubmission.groupBy({
    by: ['status'],
    where: { cycleId: cycle?.id },
    _count: true,
  });
  console.log('Status distribution:', byStatus);

  // find a few schools that are safely unlocked (DRAFT / no submission row) for the user to test with
  const allSchools = await prisma.school.findMany({ select: { udise: true, nameEn: true } });
  const subs = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle?.id },
    select: { schoolUdise: true, status: true },
  });
  const subMap = new Map(subs.map((s) => [s.schoolUdise, s.status]));
  const unlocked = allSchools.filter((s) => {
    const st = subMap.get(s.udise);
    return !st || st === 'DRAFT';
  });
  console.log('Unlocked schools count:', unlocked.length);
  console.log('Sample unlocked schools (login username = udise):', unlocked.slice(0, 5));

  const schoolDemoUser = await prisma.user.findFirst({ where: { username: 'school' }, select: { username: true, role: true } });
  console.log('Demo "school" user:', schoolDemoUser);
  if (schoolDemoUser) {
    const demoSub = await prisma.selfAssessmentSubmission.findFirst({ where: { schoolUdise: schoolDemoUser.username, cycleId: cycle?.id } });
    console.log('Demo "school" submission status:', demoSub?.status);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
