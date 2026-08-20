/**
 * The day-of-inspection reveal.
 *
 * The terms of reference are specific: an On-Ground Verifier receives the district and travel
 * window in advance, but the school name and location only on the morning of the visit. The
 * point is an unannounced inspection, and the whole value of it collapses if a verifier can
 * learn the school the night before.
 *
 * The brief adds the constraint that makes it real: "Reveal is server-side and time-gated. The
 * client must never hold the school identity before reveal." That rules out the obvious
 * implementation, which is to send the assignment with the school attached and have the field
 * app hide it until the clock passes. Anyone can open a network tab.
 *
 * So there are two different response shapes, not one shape with fields blanked out.
 * `SealedAssignment` has no field for a school, so there is nothing to omit and nothing to
 * accidentally populate later. `RevealedAssignment` is only ever constructed after the gate has
 * been checked. A future field added to the sealed type would be a visible change to a type
 * whose entire purpose is to be empty of identity, which is the review that catches it.
 */

/** Before the gate. Deliberately has no school field of any kind. */
export type SealedAssignment = {
  visitId: string;
  state: 'SEALED';
  districtCode: string;
  districtName: string;
  travelWindowStart: string;
  travelWindowEnd: string;
  notifiedDate: string;
  /** When the school unlocks, so the field app can show a countdown without knowing more. */
  revealAt: string;
};

/** After the gate. */
export type RevealedAssignment = {
  visitId: string;
  state: 'REVEALED';
  districtCode: string;
  districtName: string;
  travelWindowStart: string;
  travelWindowEnd: string;
  notifiedDate: string;
  revealAt: string;
  schoolUdise: string;
  schoolName: string;
  blockName: string;
  addressEn: string | null;
  /** Set once the verifier has answered the conflict-of-interest prompt. */
  conflictDeclaredAt: string | null;
  recusedAt: string | null;
};

export type Assignment = SealedAssignment | RevealedAssignment;

/**
 * The reveal moment for a visit: `dayOfRevealHour` local time on the notified date.
 *
 * Uses the configured hour rather than midnight because the ToR says "the morning of the visit",
 * and midnight would hand the school over the evening before to anyone still awake, which is the
 * leak the whole mechanism exists to prevent.
 *
 * India Standard Time is UTC+05:30 with no daylight saving, so the offset is a constant rather
 * than a timezone lookup. Stated explicitly because a silent UTC interpretation would reveal
 * every school five and a half hours early.
 */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

export function revealMomentFor(notifiedDate: Date, dayOfRevealHour: number): Date {
  // Work in IST calendar terms, then convert back. Taking the UTC date parts of the notified
  // date directly would slip by a day for any date stored near midnight.
  const ist = new Date(notifiedDate.getTime() + IST_OFFSET_MINUTES * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const istMidnightUtc = Date.UTC(y, m, d) - IST_OFFSET_MINUTES * 60_000;
  return new Date(istMidnightUtc + dayOfRevealHour * 3_600_000);
}

/**
 * The gate itself.
 *
 * One comparison, in one place, so there is a single answer to "is this revealed" that both the
 * query and any later check agree on. Exclusive on the boundary is wrong here and inclusive is
 * right: a verifier standing at the school at exactly 07:00 should be able to start work.
 */
export function isRevealed(revealAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= revealAt.getTime();
}

export function minutesUntilReveal(revealAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((revealAt.getTime() - now.getTime()) / 60_000));
}

/**
 * Build the response for one visit.
 *
 * Takes the school as a separate argument rather than reading it off a joined row, so the caller
 * has to decide to pass it. A function that received the whole row and chose what to return
 * would leak the moment somebody refactored the return statement.
 */
export function assignmentFor(
  visit: {
    id: string;
    districtCode: string;
    districtName: string;
    travelWindowStart: Date;
    travelWindowEnd: Date;
    notifiedDate: Date;
    revealAt: Date;
    conflictDeclaredAt: Date | null;
    recusedAt: Date | null;
  },
  school: { udise: string; nameEn: string; blockName: string; addressEn: string | null } | null,
  now: Date = new Date(),
): Assignment {
  const common = {
    visitId: visit.id,
    districtCode: visit.districtCode,
    districtName: visit.districtName,
    travelWindowStart: visit.travelWindowStart.toISOString(),
    travelWindowEnd: visit.travelWindowEnd.toISOString(),
    notifiedDate: visit.notifiedDate.toISOString(),
    revealAt: visit.revealAt.toISOString(),
  };

  // Sealed unless both conditions hold: the clock has passed and the caller actually supplied a
  // school. A missing school with a passed clock returns sealed rather than a revealed shape with
  // empty strings in it, because an empty name renders as a blank field and reads as a bug rather
  // than as a withheld identity.
  if (!isRevealed(visit.revealAt, now) || !school) {
    return { ...common, state: 'SEALED' };
  }

  return {
    ...common,
    state: 'REVEALED',
    schoolUdise: school.udise,
    schoolName: school.nameEn,
    blockName: school.blockName,
    addressEn: school.addressEn,
    conflictDeclaredAt: visit.conflictDeclaredAt?.toISOString() ?? null,
    recusedAt: visit.recusedAt?.toISOString() ?? null,
  };
}

/**
 * Whether this verifier may be sent to this school at all.
 *
 * The ToR bars a verifier from any school or cluster in a district where they hold a position.
 * That is a standing eligibility rule, so it belongs at roster build, not only in the
 * self-declaration prompt at reveal. The prompt catches what the roster could not know; this
 * catches what it could.
 */
export function isExcluded(
  exclusions: { districtCode: string | null; blockCode: string | null; schoolUdise: string | null }[],
  school: { udise: string; districtCode: string; blockCode: string },
): boolean {
  return exclusions.some(
    (e) =>
      (e.schoolUdise !== null && e.schoolUdise === school.udise) ||
      (e.blockCode !== null && e.blockCode === school.blockCode) ||
      (e.districtCode !== null && e.districtCode === school.districtCode),
  );
}
