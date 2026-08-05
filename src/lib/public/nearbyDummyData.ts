import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';

export type NearbySchool = {
  udise: string;
  name: string;
  districtName: string;
  blockName: string;
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  overallScore: number;
  distanceKm: number;
};

export const RADIUS_TIERS_KM = [5, 10, 20] as const;

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) % 100003;
  }
  return h;
}

/**
 * "Schools near me" needs a real per-school lat/lng to compute distance, and
 * that data doesn't exist anywhere in the schema or dummy data. Rather than
 * fabricate coordinates, this fabricates the distances directly: a
 * deterministic (same school -> same distance every load), clearly
 * illustrative spread across the three radius tiers. Replace this with real
 * haversine distance once school geo-coordinates exist.
 */
export function getDummyNearbySchools<
  T extends {
    udise: string;
    nameEn?: string;
    name?: string;
    districtName: string;
    blockName: string;
    type: SchoolType;
    performanceLevel: PerformanceLevel;
    overallScore?: number;
  },
>(pool: T[], count = 15): NearbySchool[] {
  const picked = pool.slice(0, Math.max(count, 1));
  const bandSize = Math.ceil(picked.length / RADIUS_TIERS_KM.length);

  return picked
    .map((s, i) => {
      const seed = hashString(s.udise);
      // Guarantees every radius tier has at least one entry (evenly banded
      // by index), instead of leaving it to chance across a small pool.
      const band = Math.min(Math.floor(i / bandSize), RADIUS_TIERS_KM.length - 1);
      const bandMin = band === 0 ? 0.5 : RADIUS_TIERS_KM[band - 1];
      const bandMax = RADIUS_TIERS_KM[band];
      const distanceKm = Math.round((bandMin + (seed % 1000) / 1000 * (bandMax - bandMin)) * 10) / 10;
      return {
        udise: s.udise,
        name: s.nameEn ?? s.name ?? s.udise,
        districtName: s.districtName,
        blockName: s.blockName,
        type: s.type,
        performanceLevel: s.performanceLevel,
        overallScore: s.overallScore ?? 0,
        distanceKm,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
