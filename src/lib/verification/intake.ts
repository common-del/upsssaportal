import { prisma } from '@/lib/db';
import { transitionRun } from './stateMachine';

/**
 * Getting schools into the pipeline, and dealing with the ones that never answer.
 *
 * Two things here are shaped by decisions taken with SSSA rather than by the code.
 *
 * A cycle spans three years, so roughly a third of the register enters verification each
 * year. `intakeYear` on the run records which year a school was drawn into, and the rotation
 * is by that field rather than by a separate table. Schools may still self-assess annually;
 * what rotates is the verification of it.
 *
 * The non-submitter path has no scheduler behind it. There is no cron in this project, no
 * `vercel.json` crons key, and no mail or SMS dependency, so the reminder ladder the source
 * flowchart draws cannot run on its own yet. `sweepDeadlines` is written to be called by a
 * scheduled job when one exists and is safe to call repeatedly until then, which is why the
 * state machine treats a no-op transition as success. It does the state changes; it cannot
 * send the reminders, and it does not pretend to.
 */

export type IntakeResult = { runId: string; created: boolean };

/**
 * The run for one school in the active cycle, created if absent.
 *
 * Idempotent by the unique key on (cycleId, schoolUdise), so it can be called from a page
 * render without guarding.
 */
export async function ensureRun(schoolUdise: string): Promise<IntakeResult | null> {
  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
    select: { id: true, startsAt: true },
  });
  if (!cycle) return null;

  const existing = await prisma.assessmentCycleRun.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    select: { id: true },
  });
  if (existing) return { runId: existing.id, created: false };

  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { udise: true },
  });
  if (!school) return null;

  // Year 1 of the cycle unless the cycle started earlier, in which case the school joins the
  // year it is actually in. Clamped to the configured span so a cycle left open past its end
  // does not produce a year 4 that no cohort build looks at.
  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { cycleSpanYears: true },
  });
  const span = config?.cycleSpanYears ?? 3;
  const startedAt = cycle.startsAt ?? new Date();
  const elapsedYears = Math.floor(
    (Date.now() - startedAt.getTime()) / (365 * 86_400_000),
  );
  const intakeYear = Math.min(Math.max(1, elapsedYears + 1), span);

  const run = await prisma.assessmentCycleRun.create({
    data: { cycleId: cycle.id, schoolUdise, intakeYear, state: 'SELF_ASSESSMENT_OPEN' },
  });

  await prisma.cycleTransition.create({
    data: {
      runId: run.id,
      fromState: null,
      toState: 'SELF_ASSESSMENT_OPEN',
      systemReason: `Intake, year ${intakeYear} of ${span}`,
    },
  });

  return { runId: run.id, created: true };
}

/**
 * Advance a school's run when it submits its self-assessment.
 *
 * Called from the submit action rather than inferred later, so the run and the submission
 * cannot disagree about whether a school has answered. Returns null when the school has no
 * run, which is not an error: the pipeline may not have taken this school in yet, and its
 * submission is still valid.
 */
export async function markSubmitted(
  schoolUdise: string,
  actorUserId?: string,
): Promise<boolean> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return false;

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    select: { id: true, state: true },
  });
  if (!run) return false;

  // Legal from SELF_ASSESSMENT_OPEN and from NOT_SUBMITTED, which is a school submitting
  // inside its extension. Any other state means the pipeline has already moved on and a late
  // submission must not drag it backwards.
  if (run.state !== 'SELF_ASSESSMENT_OPEN' && run.state !== 'NOT_SUBMITTED') return false;

  const result = await transitionRun(run.id, 'SUBMITTED', { actorUserId });
  if (result?.ok) {
    await prisma.assessmentCycleRun.update({
      where: { id: run.id },
      data: { submittedAt: new Date() },
    });
  }
  return result?.ok === true;
}

export type SweepSummary = {
  /** Passed the deadline with nothing submitted, now inside their extension. */
  markedNotSubmitted: number;
  /** Extension expired with nothing submitted. */
  markedNonSubmitter: number;
  /** Non-submitters pushed onto the priority field list. */
  pushedToFieldCohort: number;
};

/**
 * Move runs along on time alone: deadline passed, then extension expired, then onto the
 * priority field list.
 *
 * `now` is a parameter rather than read from the clock so the behaviour is testable and so a
 * dry run can be taken at a future date before a real sweep is scheduled.
 */
export async function sweepDeadlines(now: Date = new Date()): Promise<SweepSummary | null> {
  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
    select: { id: true, endsAt: true },
  });
  if (!cycle?.endsAt) return null;

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { submissionExtensionDays: true },
  });
  const extensionDays = config?.submissionExtensionDays ?? 15;

  const summary: SweepSummary = {
    markedNotSubmitted: 0,
    markedNonSubmitter: 0,
    pushedToFieldCohort: 0,
  };

  // Stage one: the deadline has passed and nothing was submitted.
  if (now >= cycle.endsAt) {
    const open = await prisma.assessmentCycleRun.findMany({
      where: { cycleId: cycle.id, state: 'SELF_ASSESSMENT_OPEN' },
      select: { id: true },
    });
    const extensionExpiresAt = new Date(cycle.endsAt.getTime() + extensionDays * 86_400_000);
    for (const run of open) {
      const r = await transitionRun(run.id, 'NOT_SUBMITTED', {
        systemReason: `Deadline passed, ${extensionDays}-day extension granted`,
      });
      if (r?.ok && r.changed) {
        await prisma.assessmentCycleRun.update({
          where: { id: run.id },
          data: { extensionExpiresAt },
        });
        summary.markedNotSubmitted += 1;
      }
    }
  }

  // Stage two: the extension has run out.
  const expired = await prisma.assessmentCycleRun.findMany({
    where: {
      cycleId: cycle.id,
      state: 'NOT_SUBMITTED',
      extensionExpiresAt: { not: null, lte: now },
    },
    select: { id: true },
  });
  for (const run of expired) {
    const r = await transitionRun(run.id, 'NON_SUBMITTER', {
      systemReason: 'Extension expired with no submission',
    });
    if (r?.ok && r.changed) summary.markedNonSubmitter += 1;
  }

  // Stage three: non-submitters join this year's field cohort ahead of everyone else. Done
  // here rather than at cohort build so the priority list exists before the cohort is drawn,
  // which is the order the flowchart puts them in.
  const nonSubmitters = await prisma.assessmentCycleRun.findMany({
    where: { cycleId: cycle.id, state: 'NON_SUBMITTER' },
    select: { id: true },
  });
  for (const run of nonSubmitters) {
    const r = await transitionRun(run.id, 'FIELD_COHORT', {
      systemReason: 'Non-submitter, priority field list',
    });
    if (r?.ok && r.changed) summary.pushedToFieldCohort += 1;
  }

  return summary;
}
