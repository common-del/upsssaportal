'use server';

import { prisma } from '@/lib/db';
import { SCHOOLS } from '@/lib/public/dummyData';
import type { Prisma } from '@prisma/client';

export type FindSchoolResult = {
  id: string;
  name: string;
  udise: string;
  category: string;
  districtName: string;
  blockName: string;
  phone: string | null;
  feesMin: number | null;
  feesMax: number | null;
};

export type SearchSchoolsInput = {
  districtCode: string;
  districtName: string;
  blockCode: string;
  blockName: string;
  feesMin?: number;
  feesMax?: number;
};

function buildFeesWhere(
  feesMin?: number,
  feesMax?: number,
): Prisma.SchoolWhereInput | undefined {
  const hasMin = feesMin !== undefined && !Number.isNaN(feesMin);
  const hasMax = feesMax !== undefined && !Number.isNaN(feesMax);
  if (!hasMin && !hasMax) return undefined;

  const overlap: Prisma.SchoolWhereInput = {};
  if (hasMax) overlap.feesRangeMin = { lte: feesMax };
  if (hasMin) overlap.feesRangeMax = { gte: feesMin };

  return {
    OR: [
      {
        AND: [
          { feesRangeMin: { not: null } },
          { feesRangeMax: { not: null } },
          overlap,
        ],
      },
      { feesRangeMin: null },
      { feesRangeMax: null },
    ],
  };
}

function searchDummySchools(input: SearchSchoolsInput): FindSchoolResult[] {
  return SCHOOLS.filter((s) => s.district === input.districtName)
    .filter((s) => {
      if (input.feesMin === undefined && input.feesMax === undefined) return true;
      if (!s.feeDisclosed) return true;
      const min = input.feesMin ?? 0;
      const max = input.feesMax ?? Number.MAX_SAFE_INTEGER;
      const estMin = s.type === 'Private' ? 12000 : 0;
      const estMax = s.type === 'Private' ? 45000 : 5000;
      return estMin <= max && estMax >= min;
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      udise: s.udise,
      category: s.level,
      districtName: s.district,
      blockName: s.block,
      phone: null,
      feesMin: s.feeDisclosed ? (s.type === 'Private' ? 12000 : 0) : null,
      feesMax: s.feeDisclosed ? (s.type === 'Private' ? 45000 : 5000) : null,
    }));
}

export async function searchSchools(
  input: SearchSchoolsInput,
): Promise<{ schools: FindSchoolResult[]; source: 'database' | 'dummy' }> {
  try {
    const where: Prisma.SchoolWhereInput = {
      districtCode: input.districtCode,
      blockCode: input.blockCode,
    };
    const feesFilter = buildFeesWhere(input.feesMin, input.feesMax);
    if (feesFilter) where.AND = [feesFilter];

    const schools = await prisma.school.findMany({
      where,
      select: {
        id: true,
        udise: true,
        nameEn: true,
        category: true,
        publicPhone: true,
        feesRangeMin: true,
        feesRangeMax: true,
        district: { select: { nameEn: true } },
        block: { select: { nameEn: true } },
      },
      orderBy: { nameEn: 'asc' },
    });

    if (schools.length === 0 && input.districtName) {
      const dummy = searchDummySchools(input);
      if (dummy.length > 0) {
        return { schools: dummy, source: 'dummy' };
      }
    }

    return {
      schools: schools.map((s) => ({
        id: s.id,
        name: s.nameEn,
        udise: s.udise,
        category: s.category,
        districtName: s.district.nameEn,
        blockName: s.block.nameEn,
        phone: s.publicPhone,
        feesMin: s.feesRangeMin,
        feesMax: s.feesRangeMax,
      })),
      source: 'database',
    };
  } catch {
    return { schools: searchDummySchools(input), source: 'dummy' };
  }
}
