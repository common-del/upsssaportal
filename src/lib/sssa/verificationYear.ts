import { prisma } from '@/lib/db';
import type { CycleState } from '@prisma/client';

/**
 * The year's run, as one sequence.
 *
 * Built because the Authority had no screen that said where the year had got to. Each stage owned
 * its own page and reported its own number, and the one stage that is a single irreversible
 * decision, drawing the field cohort, sat in the sidebar as a permanent tab: a place you could
 * visit any day of the year, looking identical before and after the only press that matters.
 *
 * So the draw is a row here, in its place in the sequence, carrying its own before and after. The
 * screen's job is to answer two questions in one look: how far has the year got, and what is the
 * Authority's next move.
 */

export type YearStep = {
  key: string;
  name: string;
  /** Plain sentence, with the numbers in it. Never a bare count with no noun. */
  state: string;
  status: 'DONE' | 'RUNNING' | 'WAITING';
  /** Right-hand note: a date, or where it has got to. */
  note: string;
};

export type VerificationYear = {
  cycleName: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Every run in the year has a published result, so nothing is left in flight. */
  resultsPublished: boolean;
  registerCount: number;
  steps: YearStep[];
  cohort: {
    /** Schools in the cohort right now, drawn or fast-tracked in. */
    size: number;
    /** Null until the button has been pressed for this cycle. */
    drawn: {
      at: string;
      byName: string | null;
      selectedCount: number;
      visitsCreated: number;
      unassignedCount: number;
      travelWindowStart: string;
      travelWindowEnd: string;
    } | null;
    /** Schools waiting for the draw: the census rotation plus the fast-tracked cases ahead of it,
     *  minus anything already carrying a visit. */
    waiting: number;
    /** In the cohort with nobody going to them. The number the recusal path used to lose. */
    stranded: number;
  };
  visits: { live: number; signedOff: number };
} | null;

/** Everything a run passes through after desk screening has finished with it. */
const PAST_DESK: CycleState[] = [
  'VIDEO_WALKTHROUGH',
  'CENSUS_QUEUE',
  'FIELD_COHORT',
  'FIELD_VISIT',
  'DISCREPANCY_REVIEW',
  'SCHOOL_RESPONSE_WINDOW',
  'PUBLISHED',
];

const formatIN = (n: number) => n.toLocaleString('en-IN');

export async function buildVerificationYear(): Promise<VerificationYear> {
  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, startsAt: true, endsAt: true, resultsPublished: true },
  });
  if (!cycle) return null;

  const inCycle = { cycleId: cycle.id };
  const [
    registerCount,
    runTotal,
    filed,
    awaitingScreening,
    pastDesk,
    onVideo,
    waiting,
    inCohort,
    stranded,
    onVisit,
    published,
    liveVisits,
    signedOffVisits,
    lastDraw,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.assessmentCycleRun.count({ where: inCycle }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, submittedAt: { not: null } } }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: { in: ['AUTO_CHECK', 'DESK_SCREENING'] } } }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: { in: PAST_DESK } } }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: 'VIDEO_WALKTHROUGH' } }),
    prisma.assessmentCycleRun.count({
      where: {
        ...inCycle,
        state: { in: ['CENSUS_QUEUE', 'FIELD_COHORT'] },
        fieldVisits: { none: {} },
      },
    }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: 'FIELD_COHORT' } }),
    prisma.assessmentCycleRun.count({
      where: { ...inCycle, state: 'FIELD_COHORT', fieldVisits: { none: { recusedAt: null } } },
    }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: 'FIELD_VISIT' } }),
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: 'PUBLISHED' } }),
    prisma.fieldVisit.count({ where: { run: inCycle, recusedAt: null, signedOffAt: null } }),
    prisma.fieldVisit.count({ where: { run: inCycle, recusedAt: null, signedOffAt: { not: null } } }),
    prisma.cohortDraw.findFirst({
      where: { cycleId: cycle.id },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        selectedCount: true,
        visitsCreated: true,
        unassignedCount: true,
        travelWindowStart: true,
        travelWindowEnd: true,
        drawnBy: { select: { name: true } },
      },
    }),
  ]);

  // A year is finished when nothing is left in flight, derived rather than flagged. The old
  // cycle-wide `resultsPublished` switch was thrown by a button that no longer exists, so it is
  // read only as history: a cycle from before publication became automatic still counts as
  // complete if somebody threw it.
  const complete = cycle.resultsPublished || (runTotal > 0 && published === runTotal);

  const steps: YearStep[] = [
    {
      key: 'self-assessment',
      name: 'Self assessment',
      state: `${formatIN(filed)} of ${formatIN(runTotal)} schools in this year’s intake have filed.`,
      status: filed >= runTotal && runTotal > 0 ? 'DONE' : 'RUNNING',
      note: runTotal === 0 ? '' : `${Math.round((filed / runTotal) * 100)}% filed`,
    },
    {
      key: 'desk-screening',
      name: 'Desk screening',
      state:
        awaitingScreening === 0
          ? `${formatIN(pastDesk)} cases screened.`
          : `${formatIN(pastDesk)} screened, ${formatIN(awaitingScreening)} still in the queue.`,
      status: awaitingScreening === 0 ? 'DONE' : 'RUNNING',
      note: awaitingScreening === 0 ? 'complete' : 'in progress',
    },
    {
      key: 'walkthroughs',
      name: 'Video walkthroughs',
      state:
        onVideo === 0
          ? 'No school is on a walkthrough at the moment.'
          : `${formatIN(onVideo)} schools are on a walkthrough now.`,
      status: onVideo === 0 ? 'DONE' : 'RUNNING',
      note: onVideo === 0 ? 'clear' : 'in progress',
    },
  ];

  const tail: YearStep[] = [
    {
      key: 'field-visits',
      name: 'Field visits',
      state:
        liveVisits + signedOffVisits === 0
          ? 'Opens once the cohort is drawn.'
          : `${formatIN(signedOffVisits)} signed off, ${formatIN(liveVisits)} still to happen.`,
      status: liveVisits + signedOffVisits === 0 ? 'WAITING' : liveVisits === 0 ? 'DONE' : 'RUNNING',
      note: onVisit > 0 ? `${formatIN(onVisit)} under way` : '',
    },
    {
      key: 'published',
      name: 'Results published',
      state:
        published === 0
          ? 'Opens as schools finish verification.'
          : complete
            ? `All ${formatIN(published)} schools have a published result.`
            : `${formatIN(published)} of ${formatIN(runTotal)} schools have a published result.`,
      status: complete ? 'DONE' : published === 0 ? 'WAITING' : 'RUNNING',
      note: complete ? 'complete' : published === 0 ? '' : 'publishing',
    },
  ];

  return {
    cycleName: cycle.name,
    startsAt: cycle.startsAt?.toISOString() ?? null,
    endsAt: cycle.endsAt?.toISOString() ?? null,
    resultsPublished: complete,
    registerCount,
    steps: [...steps, ...tail],
    cohort: {
      size: inCohort,
      drawn: lastDraw
        ? {
            at: lastDraw.createdAt.toISOString(),
            byName: lastDraw.drawnBy?.name ?? null,
            selectedCount: lastDraw.selectedCount,
            visitsCreated: lastDraw.visitsCreated,
            unassignedCount: lastDraw.unassignedCount,
            travelWindowStart: lastDraw.travelWindowStart.toISOString(),
            travelWindowEnd: lastDraw.travelWindowEnd.toISOString(),
          }
        : null,
      waiting,
      stranded,
    },
    visits: { live: liveVisits, signedOff: signedOffVisits },
  };
}
