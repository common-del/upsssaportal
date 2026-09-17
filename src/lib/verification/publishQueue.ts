import { prisma } from '@/lib/db';
import { transitionRun } from './stateMachine';

/**
 * Publishing the census queue, without a button.
 *
 * Three of the four ways a run reaches PUBLISHED already happen on their own: a field visit
 * signed off with nothing raised publishes itself, and a supervisor's ruling on the last
 * discrepancy publishes the run whether the school's response window was used or not. Only the
 * census queue needed a person to press something, and that button is gone.
 *
 * The rule that replaces it: **the draw is the cut-off.** A school sits in the census queue
 * because desk screening found nothing worth a walkthrough, or because its walkthrough resolved.
 * Its verified record is therefore its own self-assessment, and the only thing still undecided is
 * whether a field verifier will turn up. The draw decides that. Anything not selected has
 * finished this year's verification, so it publishes then; anything arriving in the queue after
 * the draw has already missed it, so it publishes on arrival.
 *
 * That pairing matters. Publishing only at the draw would strand every school screened after it,
 * and publishing only on arrival would empty the pool the census rotation draws from.
 *
 * `transitionRun` recomputes the Result from the verified record on its way into PUBLISHED, so a
 * school whose claims were corrected publishes the corrected figures, and a clean verification
 * publishes the claims unchanged. A run that cannot be scored is refused rather than published
 * blank, and the refusal is counted here rather than swallowed.
 */

export type PublishSummary = {
  published: number;
  failed: number;
  /** The first few reasons, for a screen to show without printing thousands of lines. */
  firstErrors: string[];
};

const EMPTY: PublishSummary = { published: 0, failed: 0, firstErrors: [] };

async function publishEach(
  runIds: string[],
  by: { actorUserId?: string; systemReason?: string },
): Promise<PublishSummary> {
  let published = 0;
  let failed = 0;
  const firstErrors: string[] = [];

  // One at a time, deliberately. Each run's Result is computed from its own record, and one
  // unscoreable school must not take the rest of the district down with it.
  for (const runId of runIds) {
    const moved = await transitionRun(runId, 'PUBLISHED', by);
    if (moved?.ok) published += 1;
    else {
      failed += 1;
      if (firstErrors.length < 3 && moved?.ok === false) firstErrors.push(moved.reason);
    }
  }

  return { published, failed, firstErrors };
}

/**
 * Everything still in the census queue when the year's cohort is drawn.
 *
 * Called from the draw itself rather than from a schedule, because the draw is the event that
 * settles these schools' year. At full state volume this is a long loop in one request, the same
 * shape as the draw's own allocation loop beside it; both belong in a job queue before this runs
 * against 2,65,278 schools for real.
 */
export async function publishRemainingCensusQueue(
  cycleId: string,
  by: { actorUserId?: string; systemReason?: string },
): Promise<PublishSummary> {
  const runs = await prisma.assessmentCycleRun.findMany({
    where: { cycleId, state: 'CENSUS_QUEUE' },
    select: { id: true },
    orderBy: { enteredStateAt: 'asc' },
  });
  if (runs.length === 0) return EMPTY;
  return publishEach(
    runs.map((r) => r.id),
    by,
  );
}

/**
 * One run that has just reached the census queue.
 *
 * Publishes it only when this cycle's cohort has already been drawn, which is the same rule the
 * sweep above applies, read from the other side. Before the draw it returns false and the school
 * waits in the pool where it belongs.
 */
export async function publishIfCohortAlreadyDrawn(
  runId: string,
  by: { actorUserId?: string; systemReason?: string },
): Promise<boolean> {
  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: { cycleId: true, state: true },
  });
  if (!run || run.state !== 'CENSUS_QUEUE') return false;

  const drawn = await prisma.cohortDraw.findFirst({
    where: { cycleId: run.cycleId },
    select: { id: true },
  });
  if (!drawn) return false;

  const moved = await transitionRun(runId, 'PUBLISHED', by);
  return moved?.ok === true;
}
