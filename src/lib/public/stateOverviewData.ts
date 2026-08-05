import { ALL_DISTRICTS } from '@/lib/public/dummyData';
import { scoreToLevel } from '@/lib/public/schoolProfile';
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

export const STATE_AVERAGE_SCORE = Math.round(
  DISTRICT_RANKING.reduce((sum, d) => sum + d.score, 0) / DISTRICT_RANKING.length,
);
export const STATE_AVERAGE_LEVEL: PerformanceLevel = scoreToLevel(STATE_AVERAGE_SCORE);

/** Deliberately headed "Highest average score by type" rather than "best" - the
 * groups differ hugely in size, so a single winner should not be read into it. */
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

export const OVERVIEW_DISTRICTS = [...ALL_DISTRICTS];
