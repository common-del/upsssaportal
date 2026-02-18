'use server';

import { prisma } from '@/lib/db';
import { z } from 'zod';

/* ── Active cycle helper ─────────────────────────────── */
export async function getActiveCycle() {
  return prisma.cycle.findFirst({ where: { isActive: true } });
}

/* ── Rating dimensions ───────────────────────────────── */
export async function getActiveDimensions() {
  return prisma.ratingDimension.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });
}

/* ── Submit rating ───────────────────────────────────── */
const ratingSchema = z.object({
  schoolUdise: z.string().min(1),
  submitterMobile: z.string().regex(/^\d{10}$/),
  otp: z.string(),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  comment: z.string().max(500).optional(),
});

export async function submitRating(data: {
  schoolUdise: string;
  submitterMobile: string;
  otp: string;
  ratings: Record<string, number>;
  comment?: string;
}) {
  const parsed = ratingSchema.safeParse(data);
  if (!parsed.success) return { error: 'VALIDATION_ERROR' };

  if (parsed.data.otp !== '123456') return { error: 'INVALID_OTP' };

  const cycle = await getActiveCycle();
  if (!cycle) return { error: 'NO_ACTIVE_CYCLE' };

  const school = await prisma.school.findUnique({
    where: { udise: parsed.data.schoolUdise },
    select: { udise: true },
  });
  if (!school) return { error: 'SCHOOL_NOT_FOUND' };

  const mobile = parsed.data.submitterMobile;

  // Validate all dimension codes exist
  const dimensions = await prisma.ratingDimension.findMany({
    where: { isActive: true },
    select: { code: true },
  });
  const validCodes = new Set(dimensions.map((d) => d.code));
  for (const code of Object.keys(parsed.data.ratings)) {
    if (!validCodes.has(code)) return { error: 'INVALID_DIMENSION' };
  }

  try {
    await prisma.parentRating.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: parsed.data.schoolUdise,
        submitterMobile: mobile,
        ratingsJson: parsed.data.ratings,
        comment: parsed.data.comment?.trim() || null,
      },
    });
    return { success: true };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    ) {
      return { error: 'ALREADY_RATED' };
    }
    throw e;
  }
}

/* ── Aggregation: single school ──────────────────────── */
export async function getSchoolRatingAggregates(schoolUdise: string) {
  const cycle = await getActiveCycle();
  if (!cycle) return null;

  const ratings = await prisma.parentRating.findMany({
    where: { cycleId: cycle.id, schoolUdise },
    select: { ratingsJson: true },
  });

  if (ratings.length === 0) return null;

  const dimensionTotals: Record<string, { sum: number; count: number }> = {};
  let overallSum = 0;
  let overallCount = 0;

  for (const r of ratings) {
    const json = r.ratingsJson as Record<string, number>;
    for (const [code, val] of Object.entries(json)) {
      if (!dimensionTotals[code]) dimensionTotals[code] = { sum: 0, count: 0 };
      dimensionTotals[code].sum += val;
      dimensionTotals[code].count += 1;
      overallSum += val;
      overallCount += 1;
    }
  }

  const dimensions = Object.entries(dimensionTotals).map(([code, { sum, count }]) => ({
    code,
    avg: Math.round((sum / count) * 10) / 10,
    count,
  }));

  return {
    totalRatings: ratings.length,
    overallAvg: overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : 0,
    dimensions,
    cycleName: cycle.name,
  };
}

/* ── Aggregation: batch for directory (no N+1) ─────── */
export async function getBatchRatingAggregates(
  schoolUdises: string[]
): Promise<Record<string, { avg: number; count: number }>> {
  if (schoolUdises.length === 0) return {};

  const cycle = await getActiveCycle();
  if (!cycle) return {};

  const ratings = await prisma.parentRating.findMany({
    where: { cycleId: cycle.id, schoolUdise: { in: schoolUdises } },
    select: { schoolUdise: true, ratingsJson: true },
  });

  const agg: Record<string, { totalSum: number; totalCount: number; raterCount: number }> = {};

  for (const r of ratings) {
    const udise = r.schoolUdise;
    if (!agg[udise]) agg[udise] = { totalSum: 0, totalCount: 0, raterCount: 0 };
    agg[udise].raterCount += 1;

    const json = r.ratingsJson as Record<string, number>;
    for (const val of Object.values(json)) {
      agg[udise].totalSum += val;
      agg[udise].totalCount += 1;
    }
  }

  const result: Record<string, { avg: number; count: number }> = {};
  for (const [udise, { totalSum, totalCount, raterCount }] of Object.entries(agg)) {
    result[udise] = {
      avg: totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : 0,
      count: raterCount,
    };
  }

  return result;
}
