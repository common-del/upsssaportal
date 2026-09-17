import { redirect } from 'next/navigation';

/**
 * Reporting is retired.
 *
 * It held two unrelated things. The publication button is gone because publication no longer
 * needs one: a field visit signed off with nothing raised and a supervisor's last ruling already
 * published themselves, and the census queue now publishes when the cohort is drawn, or on
 * arrival for anything screened after that. The district and division rollups were dropped on
 * SSSA's instruction.
 *
 * The URL survives as a redirect because links to it exist in older notes and in this repository's
 * own revalidation calls.
 */
export default function RetiredReportingPage() {
  redirect('/app/sssa/year');
}
