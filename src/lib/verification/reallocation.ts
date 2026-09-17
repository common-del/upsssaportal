/**
 * Putting a field visit back on somebody after the first verifier stood down.
 *
 * A recusal is the one moment in the field pathway where the school's identity has already been
 * revealed and the visit has not happened. Until now that combination had no exit: `recusedAt`
 * was written, every query in the app filtered the row out, and the school left the year's
 * cohort without anyone being told. The card even said "waiting to be reassigned", which nothing
 * did. This module is the missing half.
 *
 * Kept pure, and separate from the allocation inside `buildCohort`, because the two decisions
 * are not the same decision. The draw allocates 87,542 visits at once, where round-robin across
 * the eligible pool is already even and cheap. A replacement allocates one, where the fair
 * answer is whoever is carrying least, and where the person who just stood down, and anyone who
 * stood down from this school before them, must not come back round.
 */

/** India Standard Time is UTC+05:30 with no daylight saving, as in `reveal.ts`. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * How many days' notice a replacement gets.
 *
 * One, not zero. A recusal is normally declared at 07:00 on the morning of the visit, and a
 * verifier told at 07:00 to be at a school today has not been given a visit, they have been
 * given an impossible instruction. Tomorrow is the earliest honest date.
 */
export const REALLOCATION_LEAD_DAYS = 1;

/** The IST calendar day a moment falls on, as a whole number, so two dates can be compared as
 *  days rather than as instants. A notified date stored at 18:30 UTC and a window end stored at
 *  midnight are the same day in IST, and comparing timestamps would call that overdue. */
export function istDayNumber(at: Date): number {
  return Math.floor((at.getTime() + IST_OFFSET_MINUTES * 60_000) / 86_400_000);
}

export type ReplacementCandidate = {
  profileId: string;
  /** Visits already on this person that are neither signed off nor recused. */
  openVisits: number;
};

/**
 * Who takes the visit instead.
 *
 * Least-loaded first, ties broken by id so the same inputs always give the same answer and a
 * retry cannot quietly pick somebody else. `barred` carries the verifier who has just stood
 * down and everyone who stood down from this school earlier: handing a school back to somebody
 * who has already declared a connection to it would be the exact failure the declaration exists
 * to catch.
 *
 * Returns null when the pool is empty, which is a real outcome and not an error. A district with
 * one certified verifier has nobody left the moment that person recuses, and the honest response
 * is to say so on the Authority's screen rather than to place the visit with somebody ineligible.
 */
export function chooseReplacement(
  candidates: ReplacementCandidate[],
  barred: string[],
): string | null {
  const barredSet = new Set(barred);
  const pool = candidates.filter((c) => !barredSet.has(c.profileId));
  if (pool.length === 0) return null;

  return pool
    .slice()
    .sort((a, b) => a.openVisits - b.openVisits || a.profileId.localeCompare(b.profileId))[0]!
    .profileId;
}

export type ReplacementDate = {
  notifiedDate: Date;
  /** The travel window has already closed, or closes before the replacement can travel. The
   *  visit is still scheduled: a late visit is a problem someone can see and fix, and a school
   *  dropped out of the cohort is not. */
  outsideWindow: boolean;
};

/**
 * When the replacement visit happens.
 *
 * Clamped forward to the window's start, so a recusal on a visit notified early in a window that
 * has not opened yet does not get pushed to tomorrow and jump the queue. Not clamped backward to
 * the window's end, deliberately: capping it would hide an overrun by printing a date that has
 * already passed.
 */
export function replacementDate(
  now: Date,
  windowStart: Date,
  windowEnd: Date,
  leadDays: number = REALLOCATION_LEAD_DAYS,
): ReplacementDate {
  const earliest = new Date(now.getTime() + leadDays * 86_400_000);
  const notifiedDate = istDayNumber(earliest) < istDayNumber(windowStart) ? windowStart : earliest;
  return {
    notifiedDate,
    outsideWindow: istDayNumber(notifiedDate) > istDayNumber(windowEnd),
  };
}
