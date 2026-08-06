import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SchoolProfileContent } from '@/components/public/SchoolProfileContent';
import {
  buildSchoolProfileData,
  deriveResultFields,
  getDummySchoolRecord,
} from '@/lib/public/schoolProfile';
import { getDummyNearbySchools } from '@/lib/public/nearbyDummyData';
import {
  toDomainScoreRecord,
  type ComparableSchool,
} from '@/components/public/CompareReportCard';
import type { NearbyComparable } from '@/components/public/NearbyCompare';
import { SCHOOLS } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';

/** How many same-district schools to draw the "nearby performance" list from. */
const NEARBY_POOL = 12;

type NearbyPoolRow = {
  udise: string;
  name: string;
  districtName: string;
  blockName: string;
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  overallScore: number;
};

export default async function SchoolProfilePage(props: {
  params: Promise<{ udise: string }>;
}) {
  const { udise } = await props.params;

  let name = '';
  let district = '';
  let block = '';
  let nearbyPool: NearbyPoolRow[] = [];

  try {
    const school = await prisma.school.findUnique({
      where: { udise },
      include: { district: true, block: true },
    });

    if (school) {
      name = school.nameEn;
      district = school.district.nameEn;
      block = school.block.nameEn;

      // Same district, this school excluded - the closest thing to "nearby" the
      // schema supports, since no school coordinates exist anywhere.
      const siblings = await prisma.school.findMany({
        where: { districtCode: school.districtCode, udise: { not: udise } },
        include: { district: true, block: true },
        orderBy: { nameEn: 'asc' },
        take: NEARBY_POOL,
      });

      nearbyPool = siblings.map((s) => {
        const extra = deriveResultFields(s.udise);
        return {
          udise: s.udise,
          name: s.nameEn,
          districtName: s.district.nameEn,
          blockName: s.block.nameEn,
          type: extra.type,
          performanceLevel: extra.performanceLevel,
          overallScore: extra.overallScore,
        };
      });
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

  if (nearbyPool.length === 0) {
    nearbyPool = SCHOOLS.filter((s) => s.district === district && s.udise !== udise)
      .slice(0, NEARBY_POOL)
      .map((s) => ({
        udise: s.udise,
        name: s.name,
        districtName: s.district,
        blockName: s.block,
        type: s.type,
        performanceLevel: s.performanceLevel,
        overallScore: s.overallScore,
      }));
  }

  const profile = buildSchoolProfileData({ udise, name, district, block });
  const nearbySchools = getDummyNearbySchools(nearbyPool, NEARBY_POOL);

  // Comparison needs domain scores, which the nearby list doesn't carry. Building
  // each sibling's profile is a pure derivation - no extra queries - and means the
  // figures shown here match that school's own report card exactly.
  const nearbyByUdise = new Map(nearbyPool.map((s) => [s.udise, s]));
  const nearbyComparable: NearbyComparable[] = nearbySchools.flatMap((n) => {
    const source = nearbyByUdise.get(n.udise);
    if (!source) return [];
    const sibling = buildSchoolProfileData({
      udise: source.udise,
      name: source.name,
      district,
      block: source.blockName,
    });
    return [
      {
        udise: sibling.udise,
        name: sibling.name,
        district: sibling.district,
        type: sibling.type,
        level: sibling.classes,
        overallScore: sibling.overallScore,
        performanceLevel: sibling.performanceLevel,
        domainScores: toDomainScoreRecord(sibling.reportCard.domainScores),
        blockName: source.blockName,
        distanceKm: n.distanceKm,
      },
    ];
  });

  const currentComparable: ComparableSchool = {
    udise: profile.udise,
    name: profile.name,
    district: profile.district,
    type: profile.type,
    level: profile.classes,
    overallScore: profile.overallScore,
    performanceLevel: profile.performanceLevel,
    domainScores: toDomainScoreRecord(profile.reportCard.domainScores),
  };

  return (
    <SchoolProfileContent
      profile={profile}
      currentComparable={currentComparable}
      nearbyComparable={nearbyComparable}
    />
  );
}
