import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Recording tasks for online1, so the new page shows all three of its zones instead of one.
 *
 * The pipeline demo creates a single guided-capture case with no clips returned, which lands
 * in "Waiting on the school" and leaves the other two zones empty. This seed adds the pile
 * that is complete and can be settled, and the pile whose window closed with clips missing,
 * because those are the two states the page exists to separate.
 *
 * A separate seed rather than an extension of seedVerificationPipelineDemo: that seed
 * short-circuits on its own marker and the production database already carries it, so code
 * added inside it would never run again.
 *
 * Clips carry a placeholder address. The upload path is wired end to end, but nothing is
 * stored in this environment, and the console says so on the clip rather than showing a
 * player that will not play.
 */

const MARKER = 'demo-recording-tasks';
const DAY = 86_400_000;
const HOUR = 3_600_000;

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 999983;
  return h;
}

/** The three cases, in the order the page shows them. */
const CASES = [
  {
    // Every clip in, six hours ago, with most of the window still to run: the pile a verifier
    // opens first because it is the only one that can be settled.
    disputed: 4,
    clipsReturned: 4,
    deadlineHours: 21,
    lastClipHoursAgo: 6,
    staleClipIndex: 2,
  },
  {
    // Half returned, the window running out: nothing to do yet, and the page says so.
    disputed: 5,
    clipsReturned: 2,
    deadlineHours: 7,
    lastClipHoursAgo: 3,
    staleClipIndex: -1,
  },
  {
    // The window closed with three indicators never recorded. What the clips do show can
    // still be settled; the rest is why the case goes to the field.
    disputed: 5,
    clipsReturned: 2,
    deadlineHours: -9,
    lastClipHoursAgo: 30,
    staleClipIndex: 1,
  },
];

/**
 * Which schools are recording right now, printed on every build.
 *
 * The screen is only demonstrable if someone can sign in as one of these schools, and the
 * username is the UDISE. Without this the seed does its work and nobody can reach it: the
 * demo school account has its own run in another state and cannot be in two at once.
 */
async function announceLogins() {
  const sessions = await prisma.walkthroughSession.findMany({
    where: { mode: 'GUIDED_CAPTURE', endedAt: null, recusedAt: null },
    select: { run: { select: { schoolUdise: true, school: { select: { nameEn: true } } } } },
  });
  if (sessions.length === 0) return;
  console.log('recording tasks demo: sign in as any of these schools to see the recording screen');
  for (const s of sessions) {
    console.log(`  username ${s.run.schoolUdise}  (${s.run.school.nameEn})`);
  }
}

async function main() {
  const marker = await prisma.cycleTransition.findFirst({ where: { systemReason: MARKER } });
  if (marker) {
    console.log('recording tasks demo: already seeded, leaving it alone');
    await announceLogins();
    return;
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('recording tasks demo: no active cycle');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) return console.log('recording tasks demo: no framework');

  const online1 = await prisma.user.findUnique({
    where: { username: 'online1' },
    select: { verifierProfile: { select: { id: true } } },
  });
  if (!online1?.verifierProfile) return console.log('recording tasks demo: online1 has no profile');
  const profileId = online1.verifierProfile.id;

  const parameters = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true, checkMethod: 'MANUAL' },
    select: { id: true, code: true, titleEn: true, applicability: true },
    orderBy: { code: 'asc' },
  });
  if (parameters.length === 0) return console.log('recording tasks demo: no manual parameters');

  // Schools that submitted and have no run this cycle, so nothing already on a screen moves.
  const existing = await prisma.assessmentCycleRun.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const hasRun = new Set(existing.map((r) => r.schoolUdise));
  const candidates = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED', schoolUdise: { notIn: [...hasRun, 'school'] } },
    select: { school: { select: { udise: true, category: true } } },
    orderBy: { schoolUdise: 'asc' },
    take: CASES.length,
  });
  if (candidates.length === 0) return console.log('recording tasks demo: no free schools left');
  if (candidates.length < CASES.length) {
    console.log(`recording tasks demo: only ${candidates.length} schools free of ${CASES.length} planned`);
  }

  const intakeYear = new Date().getFullYear();
  let clipsWritten = 0;

  for (const [i, plan] of CASES.slice(0, candidates.length).entries()) {
    const school = candidates[i]!.school;
    const applicable = parameters.filter((p) =>
      (p.applicability as string[]).includes(CATEGORY_TO_CODE[school.category] ?? 'PRIMARY'),
    );
    if (applicable.length < plan.disputed) continue;

    // Deterministic pick, so a rebuild of the demo database produces the same case.
    const start = hash(school.udise) % Math.max(1, applicable.length - plan.disputed);
    const disputed = applicable.slice(start, start + plan.disputed);

    const enteredStateAt = new Date(Date.now() - (3 + i) * DAY);
    const run = await prisma.assessmentCycleRun.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: school.udise,
        state: 'VIDEO_WALKTHROUGH',
        intakeYear,
        enteredStateAt,
        submittedAt: new Date(Date.now() - 30 * DAY),
        deskAssigneeProfileId: profileId,
      },
    });
    await prisma.cycleTransition.create({
      data: {
        runId: run.id,
        fromState: 'DESK_SCREENING',
        toState: 'VIDEO_WALKTHROUGH',
        systemReason: MARKER,
        createdAt: enteredStateAt,
      },
    });

    // The agenda: the desk decisions that put this case over the threshold. Only the disputed
    // ones are written, because those are exactly the recording tasks the school was sent.
    await prisma.deskScreeningDecision.createMany({
      data: disputed.map((p) => ({
        runId: run.id,
        parameterId: p.id,
        profileId,
        decision: 'EVIDENCE_CONTRADICTS_LEVEL' as const,
        rationale: 'The uploaded evidence shows a lower state than the claimed level describes.',
      })),
      skipDuplicates: true,
    });

    // The call that could not hold: two consecutive drops, which is what moves a session to
    // recording tasks with its time box.
    const session = await prisma.walkthroughSession.create({
      data: {
        runId: run.id,
        profileId,
        mode: 'GUIDED_CAPTURE',
        conflictDeclaredAt: new Date(Date.now() - (2 + i) * DAY),
        identityDisclosedAt: new Date(Date.now() - (2 + i) * DAY),
        startedAt: new Date(Date.now() - (2 + i) * DAY),
        connectivityFailures: 2,
        guidedCaptureDeadline: new Date(Date.now() + plan.deadlineHours * HOUR),
      },
    });

    // Clips come back against the first tasks in the list, oldest first, the last one at the
    // hour the plan says. A school with a pin records inside it; one case has a clip that
    // carried an old file timestamp, which is the flag a verifier is meant to notice.
    const returned = disputed.slice(0, plan.clipsReturned);
    await prisma.walkthroughClip.createMany({
      data: returned.map((p, k) => ({
        sessionId: session.id,
        parameterId: p.id,
        taskLabel: `${p.code} ${p.titleEn}`,
        blobUrl: 'demo://clip-not-attached',
        lat: 26.8467 + (hash(school.udise + p.code) % 100) / 10_000,
        lng: 80.9462 + (hash(p.code + school.udise) % 100) / 10_000,
        capturedAt: new Date(
          Date.now() - plan.lastClipHoursAgo * HOUR - (returned.length - 1 - k) * 40 * 60_000,
        ),
        freshCapture: k !== plan.staleClipIndex,
      })),
    });
    clipsWritten += returned.length;
  }

  console.log(
    `recording tasks demo: ${Math.min(CASES.length, candidates.length)} cases, ${clipsWritten} clips`,
  );
  await announceLogins();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
