/**
 * Who runs a school. Three values, fixed by how UDISE classifies schools, and the
 * single place that mapping lives.
 *
 * Before this existed, `schoolProfile.ts` derived a school's type from a hash of
 * its UDISE code — a stable-looking value that was never real. Anything that needs
 * management type now reads `School.management` and falls back to null, never to a
 * guess: a school we have not imported is absent from the breakdown rather than
 * silently assigned to a bucket.
 */

export const MANAGEMENT_CODES = ['PRIVATE', 'GOVERNMENT', 'AIDED'] as const;
export type ManagementCode = (typeof MANAGEMENT_CODES)[number];

/** Display labels. Plural, because they name groups of schools on a dashboard. */
export const MANAGEMENT_LABELS: Record<ManagementCode, string> = {
  PRIVATE: 'Private Schools',
  GOVERNMENT: 'Government Schools',
  AIDED: 'Government Aided Schools',
};

export const MANAGEMENT_LABELS_HI: Record<ManagementCode, string> = {
  PRIVATE: 'निजी विद्यालय',
  GOVERNMENT: 'राजकीय विद्यालय',
  AIDED: 'सहायता प्राप्त विद्यालय',
};

/**
 * The same three, without the noun. A dashboard card names one group once and reads
 * better plural; a register column repeats itself down thirty thousand rows, where
 * "Schools" on every line is width spent saying what the table already is.
 */
export const MANAGEMENT_LABELS_SHORT: Record<ManagementCode, string> = {
  PRIVATE: 'Private',
  GOVERNMENT: 'Government',
  AIDED: 'Government Aided',
};

export function isManagementCode(v: string | null | undefined): v is ManagementCode {
  return v != null && (MANAGEMENT_CODES as readonly string[]).includes(v);
}

export function managementLabel(v: string | null | undefined, locale = 'en'): string | null {
  if (!isManagementCode(v)) return null;
  return locale === 'hi' ? MANAGEMENT_LABELS_HI[v] : MANAGEMENT_LABELS[v];
}

/**
 * Maps the free-text values UDISE extracts use onto our three codes. Extracts vary
 * between years and districts, so this is deliberately forgiving about case and
 * spacing — but it returns null rather than guessing when nothing matches, so an
 * unrecognised value shows up as missing data instead of being filed under
 * Government because that is the biggest bucket.
 */
export function normaliseManagement(raw: string | null | undefined): ManagementCode | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/[\s_-]+/g, ' ');
  if (!s) return null;
  if (s.includes('UNAIDED') || s.includes('PRIVATE')) return 'PRIVATE';
  if (s.includes('AIDED')) return 'AIDED'; // after UNAIDED, which also contains "AIDED"
  if (s.includes('GOVT') || s.includes('GOVERNMENT') || s.includes('MUNICIPAL')) return 'GOVERNMENT';
  return null;
}
