/**
 * The two rules the state dashboard's body rests on, kept out of the query so they can be read
 * and tested: how the four counts are derived, and how districts are ranked.
 *
 * Both are decisions rather than arithmetic, which is why they are here rather than inline.
 */

export type DistrictTotals = {
  code: string;
  name: string;
  schools: number;
  finished: number;
};

export type RankedDistrict = DistrictTotals & {
  /** 0 to 100, one decimal. What the table is sorted on. */
  finishedPct: number;
  averageScore: number | null;
  band: string | null;
};

export type Standing = {
  totalSchools: number;
  notStarted: number;
  draft: number;
  awaitingVerification: number;
  verified: number;
  finishedSelfAssessment: number;
};

/**
 * Ranking a district on two or three schools is noise, not a finding.
 *
 * It matters more on a completion ranking than it did on a score one: a district with two
 * schools, both finished, would otherwise sit above every district in the state at a permanent
 * 100% while representing nothing.
 */
export const MIN_SCHOOLS_FOR_DISTRICT_RANK = 5;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The four counts, mutually exclusive and summing to the register.
 *
 * Every subtraction is clamped at zero, because a school that never submitted can still reach a
 * verified Result through a field visit. Without the clamps that case drives a count negative,
 * which reads as a bug on the page and hides the real one.
 */
export function standingFrom(input: {
  totalSchools: number;
  draft: number;
  submitted: number;
  verified: number;
}): Standing {
  const { totalSchools, draft, submitted, verified } = input;
  return {
    totalSchools,
    notStarted: Math.max(0, totalSchools - draft - submitted),
    draft,
    awaitingVerification: Math.max(0, submitted - verified),
    verified,
    finishedSelfAssessment: submitted,
  };
}

/**
 * Districts ordered on the share of their schools that have finished a self assessment.
 *
 * Ties are broken by the larger district first: finishing 431 of 438 is a bigger piece of work
 * than finishing 20 of 20, and a ranking that put the small one above it would be telling the
 * Authority to chase the wrong place. Name breaks a remaining tie only so the order is stable
 * between requests rather than shifting under whatever the database returned first.
 */
export function rankDistricts(
  totals: DistrictTotals[],
  scoreFor: (code: string) => number | null,
  bandFor: (score: number) => string | null,
): RankedDistrict[] {
  return totals
    .filter((d) => d.schools >= MIN_SCHOOLS_FOR_DISTRICT_RANK)
    .map((d) => {
      const averageScore = scoreFor(d.code);
      return {
        ...d,
        finishedPct: round1((d.finished / d.schools) * 100),
        averageScore,
        band: averageScore === null ? null : bandFor(averageScore),
      };
    })
    .sort(
      (a, b) =>
        b.finishedPct - a.finishedPct || b.schools - a.schools || a.name.localeCompare(b.name),
    );
}
