import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SchoolProfileContent } from '@/components/public/SchoolProfileContent';
import { buildSchoolProfileData, getDummySchoolRecord } from '@/lib/public/schoolProfile';

export default async function SchoolProfilePage(props: {
  params: Promise<{ udise: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { udise } = await props.params;
  const { from } = await props.searchParams;

  let name = '';
  let district = '';
  let block = '';

  try {
    const school = await prisma.school.findUnique({
      where: { udise },
      include: { district: true, block: true },
    });

    if (school) {
      name = school.nameEn;
      district = school.district.nameEn;
      block = school.block.nameEn;
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

  const profile = buildSchoolProfileData({ udise, name, district, block });

  return <SchoolProfileContent profile={profile} cameFromCompare={from === 'compare'} />;
}
