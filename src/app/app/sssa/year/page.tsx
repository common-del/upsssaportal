import { redirect } from 'next/navigation';

/**
 * The verification year, retired a day after it was built.
 *
 * It existed to give the cohort draw a home with a visible before and after, which it did. What
 * it turned out not to need was a tab of its own: the draw is the act of putting schools on
 * field verifiers, so it belongs where the verifiers are, and the schools left with nobody are a
 * staffing list rather than a stage in a timeline. Both are on Workforce, with the draw screen
 * still at /app/sssa/cohort behind its button.
 *
 * What did not survive the move is the stage-by-stage view of the year, from self assessment
 * through screening and walkthroughs to publication. Workforce answers how far the year has got
 * in four figures instead. Dropped on SSSA's instruction rather than by oversight.
 */
export default function VerificationYearMovedPage() {
  redirect('/app/sssa/workforce');
}
