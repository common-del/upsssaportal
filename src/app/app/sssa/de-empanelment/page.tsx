import { redirect } from 'next/navigation';

/**
 * De-empanelment folded into Workforce.
 *
 * Each verifier's standing against both rules is on their own page, under the work the rules
 * are read against, and the removal button still sits directly below the numbers that justify
 * it. The whole-roster question the board answered, who is over a line, is a column: a row
 * reads "Removal recommended" when either rule has triggered.
 */
export default function DeEmpanelmentMovedPage() {
  redirect('/app/sssa/workforce');
}
