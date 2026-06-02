const SECTION_HOME_SUFFIXES = new Set([
  'new',
  'bulk',
  'verifiers-by-district',
  'appeals',
  'settings',
  'evidence',
  'documents',
  'notifications',
  'monitoring',
  'framework',
  'verifiers',
  'disputes',
  'users',
  'tickets',
  'finalization',
  'frameworks',
  'builder',
  'sqaaf',
  'fee-disclosure',
  'report-card',
  'verifier-feedback',
  'assessments',
  'district',
  'verification',
]);

/** Show the Back button only on detail / drill-down routes, not top-level section pages. */
export function isDetailPage(pathname: string): boolean {
  if (!pathname.startsWith('/app/')) return false;

  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  if (parts.length <= 1) return false;

  if (parts.length === 2) return false;

  if (parts.length === 3 && SECTION_HOME_SUFFIXES.has(parts[2]!)) return false;

  return true;
}
