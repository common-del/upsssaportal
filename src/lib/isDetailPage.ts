const SECTION_HOME_SUFFIXES = new Set([
  'new',
  'bulk',
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

/**
 * Detail routes that already render a named back link of their own.
 *
 * The shell prints a generic "Back" on every drill-down page, and these five print something
 * like "Back to the walkthrough queue" as well, so both appeared one above the other. Two back
 * controls on one page is one too many, and the named one is the one worth keeping: same
 * behaviour, it just says where it goes.
 *
 * A list rather than a runtime check because the shell renders above the page and cannot ask it
 * what it contains without a context that would depend on hydration order. The file already
 * keeps one hand list for the same kind of question.
 */
const OWN_BACK_LINK = [
  '/app/verifier/walkthrough/',
  '/app/verifier/desk/',
  '/app/verifier/visit/',
  '/app/sssa/audit/',
  '/app/sssa/discrepancies/',
];

/** Show the shell's Back button only on detail / drill-down routes that do not carry their own. */
export function showsShellBackButton(pathname: string): boolean {
  if (!pathname.startsWith('/app/')) return false;
  if (OWN_BACK_LINK.some((prefix) => pathname.startsWith(prefix))) return false;

  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  if (parts.length <= 1) return false;

  if (parts.length === 2) return false;

  if (parts.length === 3 && SECTION_HOME_SUFFIXES.has(parts[2]!)) return false;

  return true;
}
