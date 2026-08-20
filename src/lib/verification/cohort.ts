import type { CohortBasis } from '@prisma/client';

/**
 * Choosing which schools get a physical visit this year, and in what order.
 *
 * The size of the cohort is the most expensive number in the programme: it sets the field
 * verifier headcount and the travel budget, and the source documents do not pin it down. They
 * say 33% and they say "next visit within 3 years", and those two statements only agree on one
 * reading of what the 33% is a share of.
 *
 *   ALL_SCHOOLS     33% of 2,65,278 is 87,542 visits a year, so every school is seen once in
 *                   three years. Matches the flowchart's revisit promise. But it is very nearly
 *                   the whole annual verification intake, which leaves the desk screening and
 *                   the video walkthrough deciding little, since almost every school screened
 *                   gets visited anyway.
 *   ANNUAL_INTAKE   33% of the 88,426 entering verification each year is 29,181 visits, so the
 *                   triage means something. But a school is then seen once in nine years, and
 *                   the three-year promise is broken.
 *
 * Defaulted to ALL_SCHOOLS because the published promise is the harder one to walk back, and
 * left in config because this is SSSA's call and it is a factor of three either way.
 */

export type CohortBasisTotals = {
  /** Every school on the register. */
  registerCount: number;
  /** Schools whose runs are in this year of the cycle. */
  intakeCount: number;
};

/**
 * How many schools this year's cohort should hold.
 *
 * Rounds rather than truncating, so a 33% cohort of 100 schools is 33 and not 32. Clamped to the
 * number of schools actually available: a basis of ALL_SCHOOLS can ask for more visits than
 * there are candidates in the queue, and a cohort cannot contain a school twice.
 */
export function cohortSize(
  basis: CohortBasis,
  percentage: number,
  totals: CohortBasisTotals,
  availableCandidates: number,
): number {
  const denominator = basis === 'ALL_SCHOOLS' ? totals.registerCount : totals.intakeCount;
  const target = Math.round((denominator * percentage) / 100);
  return Math.max(0, Math.min(target, availableCandidates));
}

/**
 * Priority band, per the brief's queue order: fast-tracked unresolved cases first, then
 * non-submitters, then census-queue schools due by rotation.
 *
 * Derived rather than stored. A run reaching the cohort from an unresolved walkthrough and one
 * reaching it as a non-submitter both carry `fastTracked`, because both skipped the normal
 * queue, so the flag alone cannot separate them. What does separate them is whether the school
 * ever submitted: a non-submitter by definition has no submission, and an unresolved walkthrough
 * can only have happened to a school that did submit.
 */
export type CohortPriority = 1 | 2 | 3;

export const PRIORITY_LABEL: Record<CohortPriority, string> = {
  1: 'Unresolved on video',
  2: 'Did not submit',
  3: 'Census rotation',
};

export function cohortPriority(run: {
  fastTracked: boolean;
  submittedAt: Date | null;
}): CohortPriority {
  // Order matters here. A non-submitter is also fast-tracked, so testing fastTracked first
  // without the submission check would put every non-submitter in band 1 and empty band 2.
  if (run.submittedAt === null) return 2;
  if (run.fastTracked) return 1;
  return 3;
}

export type CohortCandidate = {
  runId: string;
  schoolUdise: string;
  districtCode: string;
  fastTracked: boolean;
  submittedAt: Date | null;
  /** When the run entered the queue. The rotation proxy inside band 3. */
  enteredStateAt: Date;
  intakeYear: number;
};

export type OrderedCandidate = CohortCandidate & { priority: CohortPriority };

/**
 * Order the queue, then take the cohort from the front.
 *
 * Within band 3 the order is oldest-waiting first, by intake year and then by how long the run
 * has sat in the queue. That is a proxy for rotation rather than rotation itself: a true "least
 * recently visited" ordering needs a visit history across cycles, and in the first cycle there
 * is none. Recorded here rather than quietly approximated, because in cycle two this should read
 * the previous cycle's FieldVisit dates and does not yet.
 */
export function orderCandidates(candidates: CohortCandidate[]): OrderedCandidate[] {
  return candidates
    .map((c) => ({ ...c, priority: cohortPriority(c) }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.intakeYear - b.intakeYear ||
        a.enteredStateAt.getTime() - b.enteredStateAt.getTime() ||
        // Stable last resort, so two runs that tie on everything do not swap between builds and
        // make the preview disagree with the build.
        a.runId.localeCompare(b.runId),
    );
}

/**
 * District-wise load, for the cohort build screen.
 *
 * Shown because a cohort that is correctly sized statewide can still be undeliverable: 87,542
 * visits spread evenly is 1,167 per district, and a district drawing three times that has a
 * travel problem no statewide number reveals.
 */
export function districtLoad(selected: OrderedCandidate[]): Record<string, number> {
  const load: Record<string, number> = {};
  for (const c of selected) load[c.districtCode] = (load[c.districtCode] ?? 0) + 1;
  return load;
}

export type CohortPlan = {
  selected: OrderedCandidate[];
  /** Candidates that did not make the cut, kept so the screen can say how many waited. */
  deferredCount: number;
  size: number;
  byPriority: Record<CohortPriority, number>;
  byDistrict: Record<string, number>;
};

export function planCohort(
  candidates: CohortCandidate[],
  basis: CohortBasis,
  percentage: number,
  totals: CohortBasisTotals,
): CohortPlan {
  const ordered = orderCandidates(candidates);
  const size = cohortSize(basis, percentage, totals, ordered.length);
  const selected = ordered.slice(0, size);

  const byPriority: Record<CohortPriority, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of selected) byPriority[c.priority] += 1;

  return {
    selected,
    deferredCount: ordered.length - selected.length,
    size,
    byPriority,
    byDistrict: districtLoad(selected),
  };
}
