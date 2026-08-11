import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SchoolProfileContent } from '@/components/public/SchoolProfileContent';
import {
  buildSchoolProfileData,
  getDummySchoolRecord,
  type SchoolEnteredDetail,
} from '@/lib/public/schoolProfile';
import { UNVERIFIED, verifiedStateFor, type VerifiedState } from '@/lib/public/verifiedStatus';

export default async function SchoolProfilePage(props: {
  params: Promise<{ udise: string }>;
}) {
  const { udise } = await props.params;

  let name = '';
  let district = '';
  let block = '';
  // Unverified until the record says otherwise. A database that cannot be reached is
  // not evidence that an inspection happened.
  let verification: VerifiedState = UNVERIFIED;
  // What the school entered about itself. Everything the profile still derives from
  // the UDISE hash is a placeholder for a field nobody has been asked for yet.
  let detail: SchoolEnteredDetail | null = null;

  try {
    const school = await prisma.school.findUnique({
      where: { udise },
      include: { district: true, block: true },
    });

    if (school) {
      name = school.nameEn;
      district = school.district.nameEn;
      block = school.block.nameEn;
      verification = await verifiedStateFor(udise);
      detail = await prisma.schoolProfileDetail.findUnique({ where: { schoolUdise: udise } });
    }
  } catch {
    // fall through to dummy lookup
  }

  if (!name) {
    const dummy = getDummySchoolRecord(udise);
    if (!dummy) {
      notFound();
    }
    name = dummy.name;
    district = dummy.district;
    block = dummy.block;
  }

  const profile = buildSchoolProfileData({ udise, name, district, block }, { ...verification, detail });

  return <SchoolProfileContent profile={profile} />;
}
