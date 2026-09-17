import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Two schools in the cohort that a field verifier stood down from, so the verification year
 * screen has something on its reallocation list.
 *
 * Standing down now hands the visit straight on to the next eligible verifier, so in normal use
 * this list only fills when the automatic rule runs out of people. That is exactly the state
 * that cannot be produced by clicking around a demo: it needs a recusal that happened before the
 * handover existed. These two rows are that state, written directly.
 *
 * Both field verifiers are rostered statewide, so each case offers the other one as a
 * replacement and the Send button on the screen actually works.
 *
 * A separate seed rather than an extension of seedVerificationPipelineDemo: that seed
 * short-circuits on its own marker and the production database already carries it, so anything
 * added inside it would never run again.
 */

const MARKER = 'demo-reallocation';
const DAY = 86_400_000;

type Case = {
  /** Which seeded field verifier stood down. */
  username: string;
  recusedDaysAgo: number;
};

const CASES: Case[] = [
  { username: 'field1', recusedDaysAgo: 2 },
  { username: 'field2', recusedDaysAgo: 5 },
];

async function announce() {
  const stranded = await prisma.assessmentCycleRun.findMany({
    where: { state: 'FIELD_COHORT', fieldVisits: { none: { recusedAt: null } } },
    select: { school: { select: { udise: true, nameEn: true } } },
  });
  if (stranded.length === 0) return;
  console.log('reallocation demo: these schools are in the cohort with nobody going to them');
  for (const s of stranded) {
    console.log(`  ${s.school.udise}  (${s.school.nameEn})`);
  }
  console.log('  sign in as an SSSA admin and open Verification Year to send somebody');
}

async function main() {
  const marker = await prisma.cycleTransition.findFirst({ where: { systemReason: MARKER } });
  if (marker) {
    console.log('reallocation demo: already seeded, leaving it alone');
    await announce();
    return;
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return console.log('reallocation demo: no active cycle');

  const profiles = new Map<string, string>();
  for (const c of CASES) {
    const user = await prisma.user.findUnique({
      where: { username: c.username },
      select: { verifierProfile: { select: { id: true, cell: true } } },
    });
    if (user?.verifierProfile?.cell === 'FIELD') profiles.set(c.username, user.verifierProfile.id);
  }
  if (profiles.size === 0) return console.log('reallocation demo: no field verifier profiles');

  // Schools that submitted and have no run this cycle, so nothing already on a screen moves.
  const existing = await prisma.assessmentCycleRun.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const hasRun = new Set(existing.map((r) => r.schoolUdise));
  const candidates = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED', schoolUdise: { notIn: [...hasRun, 'school'] } },
    select: { school: { select: { udise: true, districtCode: true } } },
    orderBy: { schoolUdise: 'desc' },
    take: CASES.length,
  });
  if (candidates.length === 0) return console.log('reallocation demo: no free schools left');

  const intakeYear = new Date().getFullYear();
  let written = 0;

  for (const [i, plan] of CASES.slice(0, candidates.length).entries()) {
    const profileId = profiles.get(plan.username);
    if (!profileId) continue;
    const school = candidates[i]!.school;

    const enteredStateAt = new Date(Date.now() - (plan.recusedDaysAgo + 6) * DAY);
    const run = await prisma.assessmentCycleRun.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: school.udise,
        state: 'FIELD_COHORT',
        intakeYear,
        enteredStateAt,
        submittedAt: new Date(Date.now() - 30 * DAY),
      },
    });
    await prisma.cycleTransition.create({
      data: {
        runId: run.id,
        fromState: 'CENSUS_QUEUE',
        toState: 'FIELD_COHORT',
        systemReason: MARKER,
        createdAt: enteredStateAt,
      },
    });

    // The visit that was drawn, revealed, and stood down from. Left exactly as a real recusal
    // leaves it: the assignee stays on the row and nothing replaces it.
    const recusedAt = new Date(Date.now() - plan.recusedDaysAgo * DAY);
    await prisma.fieldVisit.create({
      data: {
        runId: run.id,
        profileId,
        districtCode: school.districtCode,
        travelWindowStart: new Date(Date.now() - 5 * DAY),
        travelWindowEnd: new Date(Date.now() + 20 * DAY),
        notifiedDate: recusedAt,
        revealAt: recusedAt,
        revealedAt: recusedAt,
        conflictDeclaredAt: recusedAt,
        recusedAt,
      },
    });
    written += 1;
  }

  console.log(`reallocation demo: ${written} stranded ${written === 1 ? 'school' : 'schools'} seeded`);
  await announce();
}

main()
  .catch((e) => {
    console.error('reallocation demo failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
