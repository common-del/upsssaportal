import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isFeeDisclosureEligible } from '@/lib/school/helpers';
import { FeeDisclosureClient, FeeDisclosureNotApplicable } from '@/components/school/FeeDisclosureClient';
import { SCHOLARSHIP_SCHEMES } from '@/lib/school/helpers';

export default async function FeeDisclosurePage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) redirect('/login?tab=school');

  if (!isFeeDisclosureEligible(school.category)) {
    return <FeeDisclosureNotApplicable />;
  }

  const [disclosure, scholarships] = await Promise.all([
    prisma.feeDisclosure.findUnique({ where: { schoolUdise } }),
    prisma.schoolScholarship.findMany({ where: { schoolUdise } }),
  ]);

  // Ensure scholarship rows exist
  for (const scheme of SCHOLARSHIP_SCHEMES) {
    if (!scholarships.find((s) => s.scheme === scheme)) {
      await prisma.schoolScholarship.upsert({
        where: { schoolUdise_scheme: { schoolUdise, scheme } },
        create: { schoolUdise, scheme, available: false },
        update: {},
      });
    }
  }

  const allScholarships = await prisma.schoolScholarship.findMany({ where: { schoolUdise } });

  return (
    <FeeDisclosureClient
      udise={schoolUdise}
      disclosure={disclosure}
      scholarships={allScholarships}
    />
  );
}
