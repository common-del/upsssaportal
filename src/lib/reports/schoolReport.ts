import { prisma } from '@/lib/db';

export type SchoolReportDomainRow = {
  code: string;
  titleEn: string;
  titleHi: string;
  weightPercent: number | null;
};

export type SchoolReportData = {
  cycleId: string;
  cycleName: string;
  resultsPublished: boolean;
  school: {
    udise: string;
    nameEn: string;
    nameHi: string;
    category: string;
    blockNameEn: string | null;
    blockNameHi: string | null;
    districtNameEn: string | null;
    districtNameHi: string | null;
    districtCode: string;
  };
  grade: { code: string | null; labelEn: string | null; labelHi: string | null; status: 'PENDING' | 'AVAILABLE' };
  scores: {
    compositePercent: number | null;
    districtAvgPercent: number | null;
    stateAvgPercent: number | null;
  };
  domains: SchoolReportDomainRow[];
};

function bestScore(r: { finalScorePercent: number | null; verifierScorePercent: number | null; selfScorePercent: number | null }) {
  return r.finalScorePercent ?? r.verifierScorePercent ?? r.selfScorePercent ?? null;
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

export async function buildSchoolReportData(udise: string): Promise<SchoolReportData | null> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id }, select: { id: true } });
  if (!framework) return null;

  const school = await prisma.school.findUnique({
    where: { udise },
    select: {
      udise: true,
      nameEn: true,
      nameHi: true,
      category: true,
      districtCode: true,
      block: { select: { nameEn: true, nameHi: true } },
      district: { select: { nameEn: true, nameHi: true } },
    },
  });
  if (!school) return null;

  const [result, gradeBands, domains, cycleResults] = await Promise.all([
    prisma.result.findUnique({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
      select: { selfScorePercent: true, verifierScorePercent: true, finalScorePercent: true, gradeBandCode: true },
    }),
    prisma.gradeBand.findMany({
      where: { frameworkId: framework.id },
      orderBy: { order: 'asc' },
      select: { key: true, labelEn: true, labelHi: true },
    }),
    prisma.sqaafDomain.findMany({
      where: { frameworkId: framework.id, isActive: true },
      orderBy: { order: 'asc' },
      select: { code: true, titleEn: true, titleHi: true, weightPercent: true },
    }),
    prisma.result.findMany({
      where: { cycleId: cycle.id },
      select: {
        schoolUdise: true,
        selfScorePercent: true,
        verifierScorePercent: true,
        finalScorePercent: true,
        school: { select: { districtCode: true } },
      },
    }),
  ]);

  const gradeBand = result?.gradeBandCode
    ? gradeBands.find((b) => b.key === result.gradeBandCode) ?? null
    : null;

  const compositePercent = result ? bestScore(result) : null;

  const districtScores = cycleResults
    .filter((r) => r.school.districtCode === school.districtCode)
    .map((r) => bestScore(r))
    .filter((n): n is number => typeof n === 'number');

  const stateScores = cycleResults
    .map((r) => bestScore(r))
    .filter((n): n is number => typeof n === 'number');

  const gradeStatus: 'PENDING' | 'AVAILABLE' =
    !cycle.resultsPublished || !result?.gradeBandCode ? 'PENDING' : 'AVAILABLE';

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    resultsPublished: cycle.resultsPublished,
    school: {
      udise: school.udise,
      nameEn: school.nameEn,
      nameHi: school.nameHi,
      category: school.category,
      blockNameEn: school.block?.nameEn ?? null,
      blockNameHi: school.block?.nameHi ?? null,
      districtNameEn: school.district?.nameEn ?? null,
      districtNameHi: school.district?.nameHi ?? null,
      districtCode: school.districtCode,
    },
    grade: {
      code: result?.gradeBandCode ?? null,
      labelEn: gradeBand?.labelEn ?? (result?.gradeBandCode ?? null),
      labelHi: gradeBand?.labelHi ?? (result?.gradeBandCode ?? null),
      status: gradeStatus,
    },
    scores: {
      compositePercent,
      districtAvgPercent: avg(districtScores),
      stateAvgPercent: avg(stateScores),
    },
    domains,
  };
}

