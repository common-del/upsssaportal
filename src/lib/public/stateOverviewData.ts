import { ALL_DISTRICTS } from '@/lib/public/dummyData';
import { scoreToLevel } from '@/lib/public/schoolProfile';
import { SQAAF_DOMAINS } from '@/lib/public/constants';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';

/**
 * Placeholder figures for the public State Overview. Every number here is
 * generated from a name hash so the page is stable between loads, and none of it
 * comes from the assessment tables. Swap this module for real cycle aggregates
 * once results are published.
 */

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 100003;
  return h;
}

export const DISTRICTS_TOTAL = ALL_DISTRICTS.length;
export const DISTRICTS_ASSESSED = ALL_DISTRICTS.length;

export type DistrictRank = { rank: number; district: string; score: number };

export const DISTRICT_RANKING: DistrictRank[] = ALL_DISTRICTS.map((district) => ({
  district,
  // 44-78, wide enough to span all three tiers.
  score: 44 + (hash(district) % 35),
}))
  .sort((a, b) => b.score - a.score || a.district.localeCompare(b.district))
  .map((row, i) => ({ rank: i + 1, ...row }));

/** The page lists only the top ten; the full ranking stays available for the
 * state average below. */
export const TOP_DISTRICTS = DISTRICT_RANKING.slice(0, 10);

export const STATE_AVERAGE_SCORE = Math.round(
  DISTRICT_RANKING.reduce((sum, d) => sum + d.score, 0) / DISTRICT_RANKING.length,
);
export const STATE_AVERAGE_LEVEL: PerformanceLevel = scoreToLevel(STATE_AVERAGE_SCORE);

export const TOP_DISTRICT = DISTRICT_RANKING[0];

/** Per-type averages. Only the highest surfaces now, as a headline stat - the
 * full breakdown section was removed. The groups differ hugely in size, so the
 * headline says "Top management type" and not that one type is better. */
export const TYPE_AVERAGES: { type: string; score: number }[] = [
  { type: 'Private', score: 68 },
  { type: 'Aided', score: 61 },
  { type: 'Government', score: 57 },
  { type: 'Unaided', score: 55 },
].sort((a, b) => b.score - a.score);

const BLOCK_POOL = [
  'Sadar',
  'Kotwali',
  'Civil Lines',
  'Bilaspur',
  'Rampur',
  'Naugarh',
  'Chiraigaon',
  'Malihabad',
  'Fatehpur',
  'Baragaon',
];

const NAME_PATTERNS = [
  'Government Inter College',
  'Kendriya Vidyalaya',
  'Saraswati Vidya Mandir',
  'Government Girls Inter College',
  'Public School',
  'Aided Inter College',
  'Model School',
  'Government Primary School',
  'Aided Junior High School',
  'Basic Primary School',
];

const TYPE_POOL: SchoolType[] = ['Government', 'Aided', 'Private'];

export type TopSchool = {
  rank: number;
  name: string;
  block: string;
  type: SchoolType;
  level: PerformanceLevel;
  score: number;
};

/** Ten placeholder schools for one district only - the page never lists every
 * district's schools at once. */
export function topSchoolsForDistrict(district: string): TopSchool[] {
  const seed = hash(district);

  return NAME_PATTERNS.map((pattern, i) => ({
    name: `${pattern}, ${district}`,
    block: BLOCK_POOL[(seed + i * 3) % BLOCK_POOL.length],
    // Step by 1, not a multiple of the pool length, or every row lands on the
    // same type.
    type: TYPE_POOL[(seed + i) % TYPE_POOL.length],
    // Descends from a district-specific ceiling so rank order is meaningful and
    // the ten rows span all three tiers (Utkarsh >80, Unnat 56-80, Uday <=55).
    score: Math.max(41, 88 - (seed % 7) - i * 4),
  }))
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ rank: i + 1, ...row, level: scoreToLevel(row.score) }));
}

export const TOP_TYPE = TYPE_AVERAGES[0];

export const OVERVIEW_DISTRICTS = [...ALL_DISTRICTS];

// ─── Comparison flow: district -> block -> schools ───

const COMPARE_BLOCKS_PER_DISTRICT = 6;
const COMPARE_SCHOOLS_PER_BLOCK = 7;

const CLASS_RANGES = ['Primary', 'Upper Primary', 'Secondary', 'Higher Secondary'];

/** Placeholder blocks. The real Block table has no Hindi names and the dummy
 * school set is too thin (15 rows statewide) to fill a block list, so the
 * comparison flow generates its own. */
export function compareBlocksForDistrict(district: string): string[] {
  const seed = hash(district);
  // Step by 1. A step sharing a factor with the pool length cycles through only
  // a couple of entries, which dedup then collapses to almost nothing.
  return Array.from(
    { length: COMPARE_BLOCKS_PER_DISTRICT },
    (_, i) => BLOCK_POOL[(seed + i) % BLOCK_POOL.length],
  );
}

export type CompareSchool = {
  udise: string;
  name: string;
  district: string;
  block: string;
  type: SchoolType;
  level: string;
  overallScore: number;
  performanceLevel: PerformanceLevel;
  domainScores: Record<(typeof SQAAF_DOMAINS)[number], number>;
};

/** Placeholder schools for one block, enough of them that picking four is
 * possible. Deterministic per district+block so selections survive a reload. */
export function compareSchoolsForBlock(district: string, block: string): CompareSchool[] {
  const seed = hash(`${district}|${block}`);

  return Array.from({ length: COMPARE_SCHOOLS_PER_BLOCK }, (_, i) => {
    const overallScore = Math.max(38, Math.min(94, 86 - (seed % 9) - i * 6 + ((seed + i) % 5)));
    const domainScores = {} as Record<(typeof SQAAF_DOMAINS)[number], number>;
    SQAAF_DOMAINS.forEach((domain, d) => {
      // Spread each domain around the overall score so the bars differ.
      const offset = ((hash(domain) + seed + i * 13 + d * 7) % 21) - 10;
      domainScores[domain] = Math.max(30, Math.min(98, overallScore + offset));
    });

    return {
      udise: `9CMP${String(hash(`${district}|${block}|${i}`)).padStart(7, '0')}`,
      name: `${NAME_PATTERNS[(seed + i) % NAME_PATTERNS.length]}, ${block}`,
      district,
      block,
      type: TYPE_POOL[(seed + i) % TYPE_POOL.length],
      level: CLASS_RANGES[(seed + i * 3) % CLASS_RANGES.length],
      overallScore,
      performanceLevel: scoreToLevel(overallScore),
      domainScores,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

/** Kept here, not in the client component: importing a value from a 'use client'
 * module into a server component yields a client-reference stub, not the number,
 * which silently broke slice() on the server.
 *
 * Raising this needs the Side-by-side grid in CompareSearchFlow raised with it, or
 * the extra card wraps onto a row of its own. Every label and cap reads from here,
 * so nothing else is hardcoded. */
export const MAX_COMPARE = 4;

// ─── Comparison search: one flat pool, built once, server side only ───

/** Every generated school across every district and block. Built lazily and
 * cached, so the page can search by name without shipping ~3,000 records to the
 * browser - the compare page resolves matches server side and passes only the
 * handful it needs. */
let comparePool: CompareSchool[] | null = null;

function getComparePool(): CompareSchool[] {
  if (comparePool) return comparePool;
  comparePool = ALL_DISTRICTS.flatMap((district) =>
    compareBlocksForDistrict(district).flatMap((block) =>
      compareSchoolsForBlock(district, block),
    ),
  );
  return comparePool;
}

export function searchCompareSchools(
  query: string,
  opts: { district?: string; block?: string; limit?: number } = {},
): CompareSchool[] {
  const { district, block, limit = 12 } = opts;
  const needle = query.trim().toLowerCase();
  if (!needle && !district) return [];

  const matches = getComparePool().filter((s) => {
    if (district && s.district !== district) return false;
    if (block && s.block !== block) return false;
    if (!needle) return true;
    return (
      s.name.toLowerCase().includes(needle) ||
      s.udise.toLowerCase().includes(needle) ||
      s.block.toLowerCase().includes(needle)
    );
  });

  return matches.slice(0, limit);
}

export function compareSchoolsByUdise(udises: string[]): CompareSchool[] {
  if (udises.length === 0) return [];
  const wanted = new Set(udises);
  const found = new Map(
    getComparePool()
      .filter((s) => wanted.has(s.udise))
      .map((s) => [s.udise, s]),
  );
  // Preserve the order the user picked them in.
  return udises.flatMap((u) => {
    const hit = found.get(u);
    return hit ? [hit] : [];
  });
}
