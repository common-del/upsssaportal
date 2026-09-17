import { redirect } from 'next/navigation';

/**
 * Quality Sample folded into Workforce.
 *
 * It was a whole-roster screen answering a question about one person: you arrived already
 * knowing whose work you wanted to read, then looked for them in a list of everybody. The
 * sampled cases and their verdicts are on each verifier's own page now, under the caseload they
 * are judgements about, and the flag count survives as a column on the roster so the sample
 * still has a whole-roster reading.
 *
 * The draw itself is unchanged: still seeded on the server, still redrawn every Monday, so a
 * verifier cannot predict which of their cases will come up.
 */
export default function QualitySampleMovedPage() {
  redirect('/app/sssa/workforce');
}
