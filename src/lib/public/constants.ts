export const UP_NAVY = '#1B2A6B';
export const UP_GOLD = '#F5B731';
export const UP_BG = '#F3F4F6';
export const UP_ORANGE = '#F97316';
export const UP_GREEN = '#22C55E';

export const LEVEL_UDAY = '#E5E7EB';
export const LEVEL_UNNAT = '#F5B731';
export const LEVEL_UTKARSH = '#1B2A6B';

export const DISTRICTS = [
  'Lucknow',
  'Agra',
  'Varanasi',
  'Kanpur',
  'Prayagraj',
  'Meerut',
  'Gorakhpur',
  'Aligarh',
  'Bareilly',
  'Mathura',
] as const;

export type District = (typeof DISTRICTS)[number];

export const SCHOOL_TYPES = ['Government', 'Aided', 'Private'] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const SCHOOL_LEVELS = [
  'Primary',
  'Upper Primary',
  'Secondary',
  'Higher Secondary',
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export const SQAAF_DOMAINS = [
  'Infrastructure and Safety',
  'Administration, HR and Leadership',
  'Teaching and Learning',
  'Assessment and Learning Outcomes',
  'Inclusiveness and Community Engagement',
] as const;

export const PERFORMANCE_LEVELS = ['Uday', 'Unnat', 'Utkarsh'] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];

export const PERFORMANCE_COLORS: Record<PerformanceLevel, string> = {
  Uday: LEVEL_UDAY,
  Unnat: LEVEL_UNNAT,
  Utkarsh: LEVEL_UTKARSH,
};
