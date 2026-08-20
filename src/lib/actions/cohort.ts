'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole, requireVerifier } from '@/lib/authz';
import { planCohort, PRIORITY_LABEL, type CohortCandidate, type CohortPlan } from '@/lib/verification/cohort';
import { assignmentFor, isExcluded, revealMomentFor, type Assignment } from '@/lib/verification/reveal';
import { transitionRun } from '@/lib/verification/stateMachine';

/**
 * Cohort build and the day-of-inspection reveal.
 *
 * The reveal is the reason this file is careful about what it selects. Every query that a field
 * verifier can reach either omits the school join entirely or passes the joined school through
 * `assignmentFor`, which returns a shape with no school fields when the clock has not passed. The
 * identity is not fetched-and-hidden; before the moment it is not fetched.
 */

export type CohortPreview = {
  plan: Omit<CohortPlan, 'selected'> & {
    selected: { runId: string; maskedDistrict: string; priority: number; priorityLabel: string }[];
  };
  basis: string;
  percentage: number;
  registerCount: number;
  intakeCount: number;
  candidateCount: number;
};

async function loadCandidates(): Promise<{
  candidates: CohortCandidate[];
  registerCount: number;
  intakeCount: number;
  cycleId: string;
} | null> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return null;

  const runs = await prisma.assessmentCycleRun.findMany({
    // Both queues feed the cohort. CENSUS_QUEUE is the rotation; FIELD_COHORT already holds the
    // fast-tracked cases that sweepDeadlines and the walkthrough pushed in ahead of the draw.
    where: { cycleId: cycle.id, state: { in: ['CENSUS_QUEUE', 'FIELD_COHORT'] } },
    select: {
      id: true,
      schoolUdise: true,
      fastTracked: true,
      submittedAt: true,
      enteredStateAt: true,
      intakeYear: true,
      school: { select: { districtCode: true } },
    },
  });

  const [registerCount, intakeCount] = await Promise.all([
    prisma.school.count(),
    prisma.assessmentCycleRun.count({ where: { cycleId: cycle.id } }),
  ]);

  return {
    cycleId: cycle.id,
    registerCount,
    intakeCount,
    candidates: runs.map((r) => ({
      runId: r.id,
      schoolUdise: r.schoolUdise,
      districtCode: r.school.districtCode,
      fastTracked: r.fastTracked,
      submittedAt: r.submittedAt,
      enteredStateAt: r.enteredStateAt,
      intakeYear: r.intakeYear,
    })),
  };
}

/** The plan, without committing it. Shown on the build screen before anyone presses the button. */
export async function previewCohort(): Promise<CohortPreview | null> {
  if (!(await requireRole('SSSA_ADMIN'))) return null;

  const loaded = await loadCandidates();
  if (!loaded) return null;

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { fieldCohortPercentage: true, cohortBasis: true },
  });
  const percentage = config?.fieldCohortPercentage ?? 33;
  const basis = config?.cohortBasis ?? 'ALL_SCHOOLS';

  const plan = planCohort(loaded.candidates, basis, percentage, {
    registerCount: loaded.registerCount,
    intakeCount: loaded.intakeCount,
  });

  return {
    plan: {
      ...plan,
      // The preview is for SSSA, who may see identities, but the list is long and the useful
      // information is the shape of the cohort rather than which schools are in it.
      selected: plan.selected.slice(0, 200).map((c) => ({
        runId: c.runId,
        maskedDistrict: c.districtCode,
        priority: c.priority,
        priorityLabel: PRIORITY_LABEL[c.priority],
      })),
    },
    basis,
    percentage,
    registerCount: loaded.registerCount,
    intakeCount: loaded.intakeCount,
    candidateCount: loaded.candidates.length,
  };
}

export type BuildResult = {
  success: boolean;
  error?: string;
  visitsCreated?: number;
  unassigned?: number;
  excludedSkips?: number;
};

/**
 * Commit the cohort: create a FieldVisit per selected school, allocate a verifier, and move the
 * run into FIELD_COHORT.
 *
 * Notified dates are spread across the window rather than all set to its first day, because
 * 87,542 visits notified for one morning is not a schedule. The reveal moment is derived from the
 * notified date and the configured hour, so it is stored rather than computed at read time: a
 * later change to `dayOfRevealHour` must not retroactively move a reveal a verifier has already
 * been told about.
 */
export async function buildCohort(
  windowStart: string,
  windowEnd: string,
): Promise<BuildResult> {
  const actor = await requireRole('SSSA_ADMIN');
  if (!actor) return { success: false, error: 'Not authorised.' };

  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'Give a valid travel window.' };
  }
  if (end <= start) return { success: false, error: 'The window must end after it starts.' };

  const loaded = await loadCandidates();
  if (!loaded) return { success: false, error: 'No active cycle.' };

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { fieldCohortPercentage: true, cohortBasis: true, dayOfRevealHour: true },
  });
  const percentage = config?.fieldCohortPercentage ?? 33;
  const basis = config?.cohortBasis ?? 'ALL_SCHOOLS';
  const revealHour = config?.dayOfRevealHour ?? 7;

  const plan = planCohort(loaded.candidates, basis, percentage, {
    registerCount: loaded.registerCount,
    intakeCount: loaded.intakeCount,
  });

  // Field verifiers, with their district rosters and their standing exclusions.
  const fieldVerifiers = await prisma.verifierProfile.findMany({
    where: { cell: 'FIELD', certification: 'CERTIFIED', deEmpanelledAt: null },
    select: {
      id: true,
      userId: true,
      exclusions: { select: { districtCode: true, blockCode: true, schoolUdise: true } },
      user: { select: { verifierDistricts: { select: { districtCode: true } } } },
    },
  });

  const schools = await prisma.school.findMany({
    where: { udise: { in: plan.selected.map((c) => c.schoolUdise) } },
    select: { udise: true, districtCode: true, blockCode: true },
  });
  const schoolBy = new Map(schools.map((s) => [s.udise, s]));

  const windowDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  let visitsCreated = 0;
  let unassigned = 0;
  let excludedSkips = 0;

  for (const [index, candidate] of plan.selected.entries()) {
    const school = schoolBy.get(candidate.schoolUdise);
    if (!school) continue;

    // The standing eligibility rule, applied here rather than left to the declaration prompt.
    // The prompt catches what the roster could not know; this catches what it could.
    const eligible = fieldVerifiers.filter((v) => {
      const roster = v.user.verifierDistricts.map((d) => d.districtCode);
      if (roster.length > 0 && !roster.includes(school.districtCode)) return false;
      return !isExcluded(v.exclusions, school);
    });
    if (eligible.length === 0) excludedSkips += 1;

    // Round-robin across the eligible pool. Not a workload optimiser: capacity balancing is the
    // Supervisor's roster screen, and a deterministic spread is better here than an arbitrary
    // first-match that would send a district's whole cohort to one person.
    const assignee = eligible.length > 0 ? eligible[index % eligible.length]! : null;
    if (!assignee) unassigned += 1;

    const notifiedDate = new Date(start.getTime() + (index % windowDays) * 86_400_000);
    const revealAt = revealMomentFor(notifiedDate, revealHour);

    if (assignee) {
      await prisma.fieldVisit.create({
        data: {
          runId: candidate.runId,
          profileId: assignee.id,
          districtCode: school.districtCode,
          travelWindowStart: start,
          travelWindowEnd: end,
          notifiedDate,
          revealAt,
        },
      });
      visitsCreated += 1;
    }

    // Moved regardless of whether a verifier was found. A school in the cohort with nobody
    // allocated is a staffing gap the build screen should show, not a school quietly left in the
    // census queue as though it had not been drawn.
    await transitionRun(candidate.runId, 'FIELD_COHORT', { actorUserId: actor.userId });
  }

  revalidatePath('/app/sssa/cohort');
  return { success: true, visitsCreated, unassigned, excludedSkips };
}

/**
 * The field verifier's own assignments.
 *
 * The school join is present in the query but never reaches the response except through
 * `assignmentFor`, which drops it when the clock has not passed. Fetching it here rather than in
 * a second query after the gate keeps the gate in one place: two code paths for the same answer
 * is how one of them ends up wrong.
 */
export async function getMyAssignments(): Promise<Assignment[]> {
  const actor = await requireVerifier();
  if (!actor) return [];

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, cell: true, certification: true, deEmpanelledAt: true },
  });
  if (!profile || profile.cell !== 'FIELD') return [];
  if (profile.certification !== 'CERTIFIED' || profile.deEmpanelledAt) return [];

  const visits = await prisma.fieldVisit.findMany({
    // Recused visits are excluded: a verifier who stood down should not go on being shown the
    // school they declared a connection to.
    where: { profileId: profile.id, signedOffAt: null, recusedAt: null },
    orderBy: { notifiedDate: 'asc' },
    select: {
      id: true,
      districtCode: true,
      travelWindowStart: true,
      travelWindowEnd: true,
      notifiedDate: true,
      revealAt: true,
      conflictDeclaredAt: true,
      recusedAt: true,
      run: {
        select: {
          school: {
            select: { udise: true, nameEn: true, addressEn: true, block: { select: { nameEn: true } } },
          },
        },
      },
    },
  });

  const districts = await prisma.district.findMany({ select: { code: true, nameEn: true } });
  const districtNameBy = new Map(districts.map((d) => [d.code, d.nameEn]));

  const now = new Date();
  return visits.map((v) =>
    assignmentFor(
      {
        id: v.id,
        districtCode: v.districtCode,
        districtName: districtNameBy.get(v.districtCode) ?? v.districtCode,
        travelWindowStart: v.travelWindowStart,
        travelWindowEnd: v.travelWindowEnd,
        notifiedDate: v.notifiedDate,
        revealAt: v.revealAt,
        conflictDeclaredAt: v.conflictDeclaredAt,
        recusedAt: v.recusedAt,
      },
      {
        udise: v.run.school.udise,
        nameEn: v.run.school.nameEn,
        blockName: v.run.school.block.nameEn,
        addressEn: v.run.school.addressEn,
      },
      now,
    ),
  );
}

/**
 * The conflict-of-interest declaration at the moment of reveal, and the recuse path.
 *
 * Recusal is recorded, not erased. `recusedAt` is what marks a visit as needing reallocation, and
 * the original assignee stays on the row: who was sent to which school, and who stood down from
 * it, is exactly the history an integrity question would ask about later. Deleting the visit or
 * blanking the assignee would silently drop a school out of the year's cohort, which is the
 * failure nobody would notice.
 */
export async function declareConflict(
  visitId: string,
  hasConflict: boolean,
): Promise<{ success: boolean; error?: string; recused?: boolean }> {
  const actor = await requireVerifier();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!profile) return { success: false, error: 'Not authorised.' };

  const visit = await prisma.fieldVisit.findFirst({
    where: { id: visitId, profileId: profile.id },
    select: { id: true, revealAt: true },
  });
  if (!visit) return { success: false, error: 'Assignment not found.' };

  // A declaration before the reveal is meaningless: the verifier has not been told which school
  // it is, so they cannot yet know whether they have a connection to it.
  if (new Date() < visit.revealAt) {
    return { success: false, error: 'This assignment has not been revealed yet.' };
  }

  await prisma.fieldVisit.update({
    where: { id: visitId },
    data: {
      conflictDeclaredAt: new Date(),
      ...(hasConflict ? { recusedAt: new Date() } : {}),
    },
  });

  revalidatePath('/app/verifier/assignments');
  return { success: true, recused: hasConflict };
}
