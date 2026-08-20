import { prisma } from '@/lib/db';
import type { CycleState } from '@prisma/client';

/**
 * The verification flow as a declared table, not as conditionals spread across the actions
 * that trigger them.
 *
 * The brief names this one of four things to test before the build moves past cohort build,
 * and the reason is worth stating: a defect here is not a bug a user works around, it is a
 * school stuck in a state nobody can move it out of, or worse, a school published from a
 * state that never verified anything. Both are visible to the public.
 *
 * Three properties follow from doing it this way:
 *
 *   - Every legal move is in one place and can be read in full. An action cannot invent a
 *     transition the table does not allow.
 *   - The state and its audit row are written in one transaction, so a run's history can
 *     never disagree with its state.
 *   - Re-applying the state a run is already in succeeds and writes nothing. Sweep jobs are
 *     meant to be safe to run twice, and making that an error would mean every sweep had to
 *     re-read state it has just filtered on.
 */

/**
 * Legal moves, from the brief's section 2.
 *
 * CENSUS_QUEUE has two exits and both are real. A school drawn into this cycle's cohort goes
 * to FIELD_COHORT; a school not drawn is published on the strength of the desk check and the
 * walkthrough, which is what the flowchart's "verified score published, next visit within 3
 * years" describes. Without the second exit, every school that passed screening would wait
 * for a visit that the 33% cohort was never going to include.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<CycleState, readonly CycleState[]>> = {
  SELF_ASSESSMENT_OPEN: ['SUBMITTED', 'NOT_SUBMITTED'],
  // A school that misses the deadline can still submit during the extension.
  NOT_SUBMITTED: ['SUBMITTED', 'NON_SUBMITTER'],
  // Never verified anything, so it goes straight to the priority field list. It does not
  // pass through AUTO_CHECK or DESK_SCREENING: there is nothing to cross-match or screen.
  NON_SUBMITTER: ['FIELD_COHORT'],
  SUBMITTED: ['AUTO_CHECK'],
  AUTO_CHECK: ['DESK_SCREENING'],
  DESK_SCREENING: ['VIDEO_WALKTHROUGH', 'CENSUS_QUEUE'],
  VIDEO_WALKTHROUGH: ['CENSUS_QUEUE', 'FIELD_COHORT'],
  CENSUS_QUEUE: ['FIELD_COHORT', 'PUBLISHED'],
  FIELD_COHORT: ['FIELD_VISIT'],
  FIELD_VISIT: ['DISCREPANCY_REVIEW', 'PUBLISHED'],
  // Straight to PUBLISHED when schoolResponseWindowEnabled is off. The window is an
  // addition to the source documents, so the flow has to work without it.
  DISCREPANCY_REVIEW: ['SCHOOL_RESPONSE_WINDOW', 'PUBLISHED'],
  // A supervisor who neither upholds nor revises refers the case back for another visit.
  SCHOOL_RESPONSE_WINDOW: ['PUBLISHED', 'FIELD_COHORT'],
  PUBLISHED: [],
};

export function isTerminal(state: CycleState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

export function canTransition(from: CycleState, to: CycleState): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Every state reachable from SELF_ASSESSMENT_OPEN. Used by the tests to prove nothing is
 *  stranded, and by the admin reporting screens to enumerate the pipeline. */
export function reachableStates(): Set<CycleState> {
  const seen = new Set<CycleState>(['SELF_ASSESSMENT_OPEN']);
  const queue: CycleState[] = ['SELF_ASSESSMENT_OPEN'];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const next of ALLOWED_TRANSITIONS[s]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

export type TransitionResult =
  | { ok: true; from: CycleState; to: CycleState; changed: boolean }
  | { ok: false; reason: string; from: CycleState; to: CycleState };

/**
 * Move a run to `to`, writing the state and its history row together.
 *
 * `actorUserId` for a person, `systemReason` for a scheduled job. One or the other should be
 * set: a transition with neither is a change nobody can account for later, which is the
 * problem the audit log exists to prevent.
 */
export async function transitionRun(
  runId: string,
  to: CycleState,
  by: { actorUserId?: string; systemReason?: string },
): Promise<TransitionResult | null> {
  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: { id: true, state: true },
  });
  if (!run) return null;

  const from = run.state;

  if (from === to) {
    // Idempotent, and deliberately not logged. A sweep that runs twice should leave one
    // history row, not two identical ones an hour apart.
    return { ok: true, from, to, changed: false };
  }

  if (!canTransition(from, to)) {
    return {
      ok: false,
      from,
      to,
      reason: `${from} cannot move to ${to}. Allowed: ${
        ALLOWED_TRANSITIONS[from].join(', ') || 'none, this state is terminal'
      }.`,
    };
  }

  await prisma.$transaction([
    prisma.assessmentCycleRun.update({
      where: { id: runId },
      data: {
        state: to,
        enteredStateAt: new Date(),
        // Set here rather than by the caller so the timestamp and the state cannot disagree.
        ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        // Both routes into the field cohort that skip the normal queue are fast-tracked: an
        // unresolved walkthrough and a non-submitter. Recorded so cohort ordering does not
        // have to re-derive it from history.
        ...(to === 'FIELD_COHORT' && (from === 'VIDEO_WALKTHROUGH' || from === 'NON_SUBMITTER')
          ? { fastTracked: true }
          : {}),
      },
    }),
    prisma.cycleTransition.create({
      data: {
        runId,
        fromState: from,
        toState: to,
        actorUserId: by.actorUserId ?? null,
        systemReason: by.systemReason ?? null,
      },
    }),
  ]);

  return { ok: true, from, to, changed: true };
}
