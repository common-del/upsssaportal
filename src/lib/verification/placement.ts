import { prisma } from '@/lib/db';
import { isExcluded, revealMomentFor } from './reveal';
import { chooseReplacement, replacementDate } from './reallocation';

/**
 * Putting one field visit on one verifier, on the server.
 *
 * Separate from `buildCohort`, which allocates the whole year at once, and deliberately NOT a
 * server action: a function that places an inspection must never be reachable as an endpoint by
 * whoever guesses a run id. The two callers that may place a visit, a verifier recusing
 * themselves and the Authority reallocating by hand, each do their own authorisation first and
 * then call in here.
 *
 * The eligibility rule lives here too, so the draw and the replacement cannot drift apart. A
 * verifier is eligible for a school when their district roster covers it, or they have no roster
 * at all, and when nothing on their exclusion list names that school, its block or its district.
 */

export type SchoolLocation = { udise: string; districtCode: string; blockCode: string };

export type FieldVerifier = {
  id: string;
  /** Empty means no roster, which the rule reads as statewide rather than as nowhere. */
  districts: string[];
  exclusions: { districtCode: string | null; blockCode: string | null; schoolUdise: string | null }[];
};

/** Certified, still empanelled, in the field cell. The three conditions assignment depends on. */
export async function loadFieldVerifiers(): Promise<FieldVerifier[]> {
  const rows = await prisma.verifierProfile.findMany({
    where: { cell: 'FIELD', certification: 'CERTIFIED', deEmpanelledAt: null },
    select: {
      id: true,
      exclusions: { select: { districtCode: true, blockCode: true, schoolUdise: true } },
      user: { select: { verifierDistricts: { select: { districtCode: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    districts: r.user.verifierDistricts.map((d) => d.districtCode),
    exclusions: r.exclusions,
  }));
}

export function eligibleFor(verifiers: FieldVerifier[], school: SchoolLocation): FieldVerifier[] {
  return verifiers.filter((v) => {
    if (v.districts.length > 0 && !v.districts.includes(school.districtCode)) return false;
    return !isExcluded(v.exclusions, school);
  });
}

/** Visits each of these verifiers is still carrying: neither signed off nor stood down from. */
export async function openVisitCounts(profileIds: string[]): Promise<Map<string, number>> {
  if (profileIds.length === 0) return new Map();
  const grouped = await prisma.fieldVisit.groupBy({
    by: ['profileId'],
    where: { profileId: { in: profileIds }, signedOffAt: null, recusedAt: null },
    _count: { _all: true },
  });
  const counts = new Map(profileIds.map((id) => [id, 0]));
  for (const g of grouped) counts.set(g.profileId, g._count._all);
  return counts;
}

export type PlacementFailure =
  | 'already-placed'
  | 'run-not-found'
  | 'no-travel-window'
  | 'no-eligible-verifier'
  | 'not-eligible';

export type PlacementResult =
  | { placed: true; profileId: string; visitId: string; notifiedDate: Date; outsideWindow: boolean }
  | { placed: false; reason: PlacementFailure };

type PlaceOptions = {
  /** Force a particular verifier, for the Authority's by-hand path. Still checked for
   *  eligibility: a manual override of the roster is a different decision from a manual choice
   *  within it, and this function only offers the second. */
  profileId?: string;
  now?: Date;
};

/**
 * Put a visit on somebody for a school in the cohort that has nobody.
 *
 * Two cases reach here and they are the same problem. A verifier stood down at the reveal, or the
 * draw found nobody eligible in the first place. Either way the school is in this year's cohort
 * with no live visit, and without this it stays that way for good.
 *
 * Where there is a recused visit, it is left exactly as it is and a new row is written beside it
 * pointing back at it. Mutating the old row would be cheaper and would destroy the only record of
 * who was sent where and who stood down, which is the first thing an integrity question asks
 * about.
 *
 * Returns `already-placed` rather than throwing when the run already has a live visit, so two
 * recusals arriving together, or a retry after a slow response, leave one replacement.
 */
export async function placeReplacement(
  runId: string,
  options: PlaceOptions = {},
): Promise<PlacementResult> {
  const now = options.now ?? new Date();

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: {
      cycleId: true,
      school: { select: { udise: true, districtCode: true, blockCode: true } },
      fieldVisits: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          profileId: true,
          recusedAt: true,
          travelWindowStart: true,
          travelWindowEnd: true,
          replacedBy: { select: { id: true } },
        },
      },
    },
  });
  if (!run) return { placed: false, reason: 'run-not-found' };

  const visits = run.fieldVisits;
  if (visits.some((v) => v.recusedAt === null)) return { placed: false, reason: 'already-placed' };

  // The recused visit this one takes over from, if there is one. Null when the draw never placed
  // the school at all, in which case the window comes from the draw itself.
  const replaces = visits.find((v) => v.recusedAt !== null && v.replacedBy === null) ?? null;

  let windowStart: Date;
  let windowEnd: Date;
  if (replaces) {
    windowStart = replaces.travelWindowStart;
    windowEnd = replaces.travelWindowEnd;
  } else {
    const draw = await prisma.cohortDraw.findFirst({
      where: { cycleId: run.cycleId },
      orderBy: { createdAt: 'desc' },
      select: { travelWindowStart: true, travelWindowEnd: true },
    });
    if (!draw) return { placed: false, reason: 'no-travel-window' };
    windowStart = draw.travelWindowStart;
    windowEnd = draw.travelWindowEnd;
  }

  const school = run.school;
  const eligible = eligibleFor(await loadFieldVerifiers(), school);
  // Everyone who has already stood down from this school, not only the last of them. Handing a
  // school back to somebody who declared a connection to it would defeat the declaration.
  const barred = visits.filter((v) => v.recusedAt !== null).map((v) => v.profileId);

  let profileId: string | null;
  if (options.profileId) {
    const ok = eligible.some((v) => v.id === options.profileId) && !barred.includes(options.profileId);
    if (!ok) return { placed: false, reason: 'not-eligible' };
    profileId = options.profileId;
  } else {
    const counts = await openVisitCounts(eligible.map((v) => v.id));
    profileId = chooseReplacement(
      eligible.map((v) => ({ profileId: v.id, openVisits: counts.get(v.id) ?? 0 })),
      barred,
    );
  }
  if (!profileId) return { placed: false, reason: 'no-eligible-verifier' };

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { dayOfRevealHour: true },
  });
  const { notifiedDate, outsideWindow } = replacementDate(now, windowStart, windowEnd);

  const created = await prisma.fieldVisit.create({
    data: {
      runId,
      profileId,
      districtCode: school.districtCode,
      travelWindowStart: windowStart,
      travelWindowEnd: windowEnd,
      notifiedDate,
      revealAt: revealMomentFor(notifiedDate, config?.dayOfRevealHour ?? 7),
      replacesVisitId: replaces?.id ?? null,
    },
    select: { id: true },
  });

  return { placed: true, profileId, visitId: created.id, notifiedDate, outsideWindow };
}
