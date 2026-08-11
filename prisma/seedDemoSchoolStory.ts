import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gives the `school` demo account something to demonstrate.
 *
 * The account had a fully-answered self-assessment seeded by seedRealFramework, and
 * every login deleted it: resetDemoSchoolProgress wiped the submission, the
 * verification, the responses and the result so the SQAAF form could be filled in
 * live. The cost was that Verifier Feedback, Appeals and the Report Card could never
 * show anything on the account anyone actually demos with — they rendered their empty
 * states, correctly, for a school whose data had just been deleted at the door.
 *
 * The wipe is gone. This gives the account the rest of the story: a verifier who
 * checked the school and disagreed on a handful of indicators, a result carrying both
 * scores, an appeal against two of those indicators with one already decided, and
 * complaints in three states including one overdue and escalated.
 *
 * Idempotent. Reruns on every deploy and must not multiply the story each time, so
 * everything is upserted or guarded on a marker id.
 */

const DEMO_UDISE = 'school';
const MARKED_DOWN_TARGET = 6;

/** Deterministic pick, so the same indicators are contested on every deploy. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
}

async function main() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('demo story: no active cycle');

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) return console.log('demo story: no framework');

  const school = await prisma.school.findUnique({ where: { udise: DEMO_UDISE } });
  if (!school) return console.log('demo story: no demo school');

  const sa = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: DEMO_UDISE } },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
  });
  if (!sa || sa.responses.length === 0) {
    return console.log('demo story: demo school has no self-assessment yet');
  }

  const verifier = await prisma.user.findFirst({
    where: { role: 'VERIFIER', active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!verifier) return console.log('demo story: no verifier');

  const assignment = await prisma.verifierAssignment.upsert({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: DEMO_UDISE } },
    create: { cycleId: cycle.id, schoolUdise: DEMO_UDISE, verifierUserId: verifier.id },
    update: { verifierUserId: verifier.id },
  });

  const params = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  const paramById = new Map(params.map((p) => [p.id, p]));

  // Options are ordered best-first, so the next index down is the weaker answer. The
  // verifier agrees with the school everywhere except a fixed handful, which is what
  // a real check looks like — not a wholesale rewrite.
  const answered = sa.responses.filter((r) => paramById.has(r.parameterId));
  const ranked = [...answered].sort(
    (a, b) => hash(a.parameterId) - hash(b.parameterId),
  );

  const markDown = new Set<string>();
  for (const r of ranked) {
    if (markDown.size >= MARKED_DOWN_TARGET) break;
    const p = paramById.get(r.parameterId)!;
    const idx = p.options.findIndex((o) => o.key === r.selectedOptionKey);
    if (idx !== -1 && idx < p.options.length - 1) markDown.add(r.parameterId);
  }

  // assignmentId is the unique key on this table, so the assignment above is what
  // makes the upsert idempotent across deploys.
  const vSub = await prisma.verificationSubmission.upsert({
    where: { assignmentId: assignment.id },
    create: {
      cycleId: cycle.id,
      schoolUdise: DEMO_UDISE,
      frameworkId: framework.id,
      assignmentId: assignment.id,
      verifierUserId: verifier.id,
      status: 'SUBMITTED',
      // Dated from the cycle start where there is one, so the demo reads as a check
      // that happened during the cycle rather than this morning.
      submittedAt: new Date((cycle.startsAt?.getTime() ?? Date.now()) + 30 * 86_400_000),
    },
    update: { status: 'SUBMITTED' },
  });

  for (const r of answered) {
    const p = paramById.get(r.parameterId)!;
    const idx = p.options.findIndex((o) => o.key === r.selectedOptionKey);
    const down = markDown.has(r.parameterId);
    const key = down ? p.options[Math.min(p.options.length - 1, idx + 1)]!.key : r.selectedOptionKey;

    await prisma.verificationResponse.upsert({
      where: { submissionId_parameterId: { submissionId: vSub.id, parameterId: r.parameterId } },
      create: {
        submissionId: vSub.id,
        parameterId: r.parameterId,
        selectedOptionKey: key,
        notes: down ? 'Evidence seen on site did not support the higher rating.' : null,
      },
      update: {
        selectedOptionKey: key,
        notes: down ? 'Evidence seen on site did not support the higher rating.' : null,
      },
    });
  }

  // An appeal against two of the contested indicators: one still with SSSA, one they
  // have already accepted, so the page shows both states at once.
  const contested = [...markDown];
  if (contested.length >= 2) {
    const appeal = await prisma.appeal.upsert({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: DEMO_UDISE } },
      create: {
        cycleId: cycle.id,
        schoolUdise: DEMO_UDISE,
        frameworkId: framework.id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      update: {},
    });

    const decisions = ['PENDING', 'ACCEPT_SCHOOL'];
    for (let i = 0; i < 2; i++) {
      const pid = contested[i]!;
      const p = paramById.get(pid)!;
      const own = answered.find((r) => r.parameterId === pid)!.selectedOptionKey;
      const idx = p.options.findIndex((o) => o.key === own);
      await prisma.appealItem.upsert({
        where: { appealId_parameterId: { appealId: appeal.id, parameterId: pid } },
        create: {
          appealId: appeal.id,
          parameterId: pid,
          schoolSelectedOptionKey: own,
          verifierSelectedOptionKey: p.options[Math.min(p.options.length - 1, idx + 1)]!.key,
          schoolJustification:
            'Records for this indicator were available on the day and are attached again here.',
          decision: decisions[i]!,
          decidedAt: decisions[i] === 'PENDING' ? null : new Date(),
        },
        update: {},
      });
    }
  }

  // Complaints, in the three states the school page separates: one answerable, one
  // overdue and escalated past the school, one already closed.
  const categories = await prisma.disputeCategory.findMany({ where: { isActive: true }, take: 3 });
  const now = Date.now();
  const complaints = [
    {
      id: 'demo_ticket_open',
      status: 'ASSIGNED_TO_SCHOOL',
      handlerLevel: 'SCHOOL',
      nextDueAt: new Date(now + 2 * 86_400_000),
      submitterName: 'Meenakshi Yadav',
      description: 'Fees charged above the amount disclosed on the portal.',
    },
    {
      id: 'demo_ticket_overdue',
      status: 'ASSIGNED_TO_DISTRICT',
      handlerLevel: 'DISTRICT',
      nextDueAt: new Date(now - 3 * 86_400_000),
      submitterName: 'Imran Qureshi',
      description: 'Boundary wall is broken on the north side and the gate is left open.',
    },
    {
      id: 'demo_ticket_closed',
      status: 'RESOLVED',
      handlerLevel: 'SCHOOL',
      nextDueAt: null,
      submitterName: 'Sunita Devi',
      description: 'Library listed on the profile was not open during school hours.',
    },
  ];

  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i]!;
    const category = categories[i % Math.max(1, categories.length)];
    if (!category) break;
    await prisma.ticket.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        schoolUdise: DEMO_UDISE,
        categoryCode: category.code,
        districtCode: school.districtCode,
        description: c.description,
        submitterName: c.submitterName,
        submitterMobile: '+91 9000000000',
        status: c.status,
        handlerLevel: c.handlerLevel,
        nextDueAt: c.nextDueAt,
        resolvedAt: c.status === 'RESOLVED' ? new Date(now - 10 * 86_400_000) : null,
      },
      update: {},
    });
  }

  console.log(
    `demo story: verification (${markDown.size} marked down), appeal, ${complaints.length} complaints`,
  );
}

main()
  .catch((e) => {
    console.error('demo story failed:', e);
  })
  .finally(() => prisma.$disconnect());
