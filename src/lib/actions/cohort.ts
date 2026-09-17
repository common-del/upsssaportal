'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole, requireOngroundVerifier } from '@/lib/authz';
import { planCohort, PRIORITY_LABEL, type CohortCandidate } from '@/lib/verification/cohort';
import { assignmentFor, revealMomentFor, type Assignment } from '@/lib/verification/reveal';
import { eligibleFor, loadFieldVerifiers, placeReplacement } from '@/lib/verification/placement';
import { transitionRun } from '@/lib/verification/stateMachine';

/**
 * Cohort build and the day-of-inspection reveal.
 *
 * The reveal is the reason this file is careful about what it selects. Every query that a field
 * verifier can reach either omits the school join entirely or passes the joined school through
 * `assignmentFor`, which returns a shape with no school fields when the clock has not passed. The
 * identity is not fetched-and-hidden; before the moment it is not fetched.
 */

/** One district's share of the draw, with enough beside it to say whether the share is
 *  deliverable. A count on its own cannot: 2,914 visits is fine with forty verifiers and
 *  impossible with four. */
export type DistrictLoadRow = {
  code: string;
  name: string;
  count: number;
  /** Certified field verifiers whose roster covers this district and who are not excluded from
   *  it outright. Block-level and school-level exclusions are not counted here: they are
   *  per-school facts, and the draw reports what it actually skipped. */
  verifiers: number;
  /** Visits each of them would carry. Null when there are none, which is the case worth seeing. */
  perVerifier: number | null;
  /** Share against the average district's share. 2.5 means two and a half times it. */
  timesAverage: number;
};

/** What the last press of the button produced, or null if this year has not been drawn. */
export type DrawRecord = {
  at: string;
  byName: string | null;
  selectedCount: number;
  visitsCreated: number;
  unassignedCount: number;
  travelWindowStart: string;
  travelWindowEnd: string;
};

export type CohortPreview = {
  size: number;
  deferredCount: number;
  candidateCount: number;
  byPriority: Record<number, number>;
  districts: DistrictLoadRow[];
  /** Districts in the draw with nobody rostered to visit them, and the schools stranded there. */
  districtsWithoutVerifier: { code: string; name: string; count: number }[];
  schoolsWithoutVerifier: number;
  basis: string;
  percentage: number;
  registerCount: number;
  intakeCount: number;
  drawn: DrawRecord | null;
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
    //
    // A run that already has a visit of any kind is not a candidate. Without that condition a
    // second press of the button redrew every school already in the cohort and wrote a second
    // visit for each: FieldVisit has no unique key on runId, and a FIELD_COHORT to FIELD_COHORT
    // move is a silent no-op, so nothing downstream refused it. A school whose only visit was
    // recused is excluded here too and is put back through reallocation instead, because the
    // draw's round-robin does not know who has already stood down from that school.
    where: { cycleId: cycle.id, state: { in: ['CENSUS_QUEUE', 'FIELD_COHORT'] }, fieldVisits: { none: {} } },
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

/**
 * The plan, without committing it. Shown on the draw screen before anyone presses the button.
 *
 * Returns the shape of the cohort rather than the list of schools in it. The Authority may see
 * identities, but 87,542 rows answer no question anybody has at this point, and the two things
 * that decide whether to press the button are where the visits fall and whether anyone is there
 * to make them.
 */
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

  const [districtRecords, verifiers, lastDraw] = await Promise.all([
    prisma.district.findMany({ select: { code: true, nameEn: true } }),
    loadFieldVerifiers(),
    prisma.cohortDraw.findFirst({
      where: { cycleId: loaded.cycleId },
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
  const districtName = new Map(districtRecords.map((d) => [d.code, d.nameEn]));

  const drawnCodes = Object.keys(plan.byDistrict);
  const average = drawnCodes.length === 0 ? 0 : plan.size / drawnCodes.length;

  const districts: DistrictLoadRow[] = drawnCodes
    .map((code) => {
      const count = plan.byDistrict[code]!;
      // An empty roster is read as statewide, the same reading the allocation loop uses. A
      // standing exclusion naming the district removes that person from it whatever the roster
      // says.
      const cover = verifiers.filter(
        (v) =>
          (v.districts.length === 0 || v.districts.includes(code)) &&
          !v.exclusions.some((e) => e.districtCode === code),
      ).length;
      return {
        code,
        name: districtName.get(code) ?? code,
        count,
        verifiers: cover,
        perVerifier: cover === 0 ? null : Math.round(count / cover),
        timesAverage: average === 0 ? 0 : count / average,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const districtsWithoutVerifier = districts
    .filter((d) => d.verifiers === 0)
    .map((d) => ({ code: d.code, name: d.name, count: d.count }));

  return {
    size: plan.size,
    deferredCount: plan.deferredCount,
    candidateCount: loaded.candidates.length,
    byPriority: plan.byPriority,
    districts,
    districtsWithoutVerifier,
    schoolsWithoutVerifier: districtsWithoutVerifier.reduce((t, d) => t + d.count, 0),
    basis,
    percentage,
    registerCount: loaded.registerCount,
    intakeCount: loaded.intakeCount,
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
  };
}

/** The queue order, for the screen. Exported so the page cannot invent its own labels. */
export async function cohortPriorityLabels(): Promise<{ priority: number; label: string }[]> {
  return ([1, 2, 3] as const).map((p) => ({ priority: p, label: PRIORITY_LABEL[p] }));
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
  const fieldVerifiers = await loadFieldVerifiers();

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
    // The prompt catches what the roster could not know; this catches what it could. Shared with
    // the reallocation path so the two cannot disagree about who may be sent where.
    const eligible = eligibleFor(fieldVerifiers, school);
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

  // The draw itself, recorded. Without it the only evidence that a year has been drawn is the
  // presence of visits, which cannot tell a cohort the Authority drew from schools the
  // walkthrough fast-tracked in one at a time, and leaves the screen looking identical before
  // and after the most consequential button in the programme.
  await prisma.cohortDraw.create({
    data: {
      cycleId: loaded.cycleId,
      drawnByUserId: actor.userId,
      travelWindowStart: start,
      travelWindowEnd: end,
      selectedCount: plan.size,
      visitsCreated,
      unassignedCount: unassigned,
    },
  });

  revalidatePath('/app/sssa/cohort');
  revalidatePath('/app/sssa/year');
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
  const actor = await requireOngroundVerifier();
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
      runId: true,
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

  // What the desk screening flagged, as a count per case. Safe to carry on a sealed card: the
  // number of flags identifies no school. The flags themselves come from getFieldVisit, which
  // sits behind the reveal gate.
  const flagged = visits.length
    ? await prisma.deskScreeningDecision.groupBy({
        by: ['runId'],
        where: {
          runId: { in: visits.map((v) => v.runId) },
          decision: { not: 'EVIDENCE_SUPPORTS_LEVEL' },
        },
        _count: { _all: true },
      })
    : [];
  const deskFlagCountBy = new Map(flagged.map((f) => [f.runId, f._count._all]));

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
        deskFlagCount: deskFlagCountBy.get(v.runId) ?? 0,
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
 * Recusal is recorded, not erased. `recusedAt` stays on the original row and the original
 * assignee stays with it: who was sent to which school, and who stood down from it, is exactly
 * the history an integrity question would ask about later. Deleting the visit or blanking the
 * assignee would silently drop a school out of the year's cohort.
 *
 * Standing down now also hands the visit on. Until this was added, `recusedAt` was a mark nothing
 * read: every query in the app filters recused rows out, so the school left the cohort without
 * anybody being told, and the verifier's own card said it was "waiting to be reassigned" when
 * nothing was going to reassign it. The replacement goes to the eligible verifier carrying the
 * fewest visits, never to anybody who has already stood down from this school, and never today,
 * since a recusal is normally declared at 07:00 on the morning of the visit. When there is
 * nobody left, the school stays in the cohort with no visit and appears on the Authority's
 * verification year screen, which is the honest outcome and not a silent one.
 */
export async function declareConflict(
  visitId: string,
  hasConflict: boolean,
): Promise<{ success: boolean; error?: string; recused?: boolean; reallocated?: boolean }> {
  const actor = await requireOngroundVerifier();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!profile) return { success: false, error: 'Not authorised.' };

  const visit = await prisma.fieldVisit.findFirst({
    where: { id: visitId, profileId: profile.id },
    select: { id: true, revealAt: true, runId: true },
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
  if (!hasConflict) return { success: true, recused: false };

  const placement = await placeReplacement(visit.runId);
  revalidatePath('/app/sssa/year');
  return { success: true, recused: true, reallocated: placement.placed };
}
