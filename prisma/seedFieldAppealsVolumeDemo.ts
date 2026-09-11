import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Enough appeals on field1's inspections for the Appeals page to show its volume machinery.
 *
 * The find bar (status chips, search, district filter) renders only past five appeals, and the
 * first appeals seed created two, so a demo login never saw the thing the design round was
 * about. This one adds up to six more against field1's remaining published runs: two still
 * waiting on the SSSA and four decided with a spread of outcomes (upheld in full twice, revised
 * in full once, mixed once). One decision is dated yesterday so the month grouping shows two
 * headings rather than one.
 *
 * Guarded by its own marker, like every demo seed, so a redeploy does not double the pile.
 */

const MARKER = 'demo-field-appeals-volume';
const DAY = 86_400_000;

const JUSTIFICATIONS = [
  'The register covering this indicator was with the block office for audit on the day of the visit. A certified copy is uploaded as evidence.',
  'The facility was under repair during the inspection week. The completion certificate and dated photographs are attached.',
  'The verifier saw the room in use for the census work that day, not its normal purpose. The timetable and inventory register are uploaded.',
  'The claimed provision serves both buildings and was assessed from one. Photographs from the second building are attached.',
];

async function main() {
  const marker = await prisma.cycleTransition.findFirst({ where: { systemReason: MARKER } });
  if (marker) {
    console.log('field appeals volume demo: already seeded, leaving it alone');
    return;
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('field appeals volume demo: no active cycle');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) return console.log('field appeals volume demo: no framework');

  const field1 = await prisma.user.findUnique({
    where: { username: 'field1' },
    select: { verifierProfile: { select: { id: true } } },
  });
  if (!field1?.verifierProfile) return console.log('field appeals volume demo: field1 has no profile');
  const sssa = await prisma.user.findUnique({ where: { username: 'sssa' }, select: { id: true } });

  const runs = await prisma.assessmentCycleRun.findMany({
    where: {
      cycleId: cycle.id,
      state: 'PUBLISHED',
      publishedAt: { not: null },
      fieldVisits: { some: { profileId: field1.verifierProfile.id, signedOffAt: { not: null } } },
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      schoolUdise: true,
      publishedAt: true,
      discrepancies: { select: { parameterId: true, claimedLevel: true, proposedLevel: true } },
    },
    take: 12,
  });

  const alreadyAppealed = new Set(
    (
      await prisma.appeal.findMany({
        where: { cycleId: cycle.id, schoolUdise: { in: runs.map((r) => r.schoolUdise) } },
        select: { schoolUdise: true },
      })
    ).map((a) => a.schoolUdise),
  );
  const candidates = runs.filter((r) => !alreadyAppealed.has(r.schoolUdise) && r.discrepancies.length >= 1);
  if (candidates.length === 0) return console.log('field appeals volume demo: nothing left to appeal');

  const parameterIds = [...new Set(candidates.flatMap((r) => r.discrepancies.map((d) => d.parameterId)))];
  const options = await prisma.parameterOption.findMany({
    where: { parameterId: { in: parameterIds } },
    select: { parameterId: true, order: true, key: true },
  });
  const keyByOrder = new Map(options.map((o) => [`${o.parameterId}:${o.order}`, o.key]));

  function itemsFor(run: (typeof candidates)[number], limit: number) {
    return run.discrepancies
      .map((d, i) => ({
        parameterId: d.parameterId,
        schoolSelectedOptionKey: keyByOrder.get(`${d.parameterId}:${d.claimedLevel}`),
        verifierSelectedOptionKey: keyByOrder.get(`${d.parameterId}:${d.proposedLevel}`),
        schoolJustification: JUSTIFICATIONS[i % JUSTIFICATIONS.length]!,
      }))
      .filter((i) => i.schoolSelectedOptionKey && i.verifierSelectedOptionKey)
      .slice(0, limit);
  }

  const now = Date.now();
  // Two still waiting, then the decided spread: kept in full, kept in full, revised in full,
  // mixed. Decisions per plan[i]: null = waiting; otherwise a function of the item index.
  const plan: (null | ((itemIndex: number) => 'KEEP_VERIFIER' | 'ACCEPT_SCHOOL'))[] = [
    null,
    null,
    () => 'KEEP_VERIFIER',
    () => 'KEEP_VERIFIER',
    () => 'ACCEPT_SCHOOL',
    (i) => (i % 2 === 0 ? 'KEEP_VERIFIER' : 'ACCEPT_SCHOOL'),
  ];

  let created = 0;
  let markerRunId: string | null = null;
  for (const [index, decide] of plan.entries()) {
    const run = candidates[index];
    if (!run) break;
    const items = itemsFor(run, index === 5 ? 2 : 3);
    if (items.length === 0) continue;

    const submittedAt = new Date(Math.min(run.publishedAt!.getTime() + (1 + (index % 3)) * DAY, now - 6 * DAY));
    // The first decided appeal lands yesterday so the page's month grouping shows two headings.
    const decidedAt =
      decide === null
        ? null
        : index === 2
          ? new Date(now - 1 * DAY)
          : new Date(Math.min(submittedAt.getTime() + 4 * DAY, now - 2 * DAY));

    await prisma.appeal.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: run.schoolUdise,
        frameworkId: framework.id,
        status: decide === null ? 'SUBMITTED' : 'DECIDED',
        submittedAt,
        decidedAt,
        decidedByUserId: decide === null ? null : (sssa?.id ?? null),
        items: {
          create: items.map((item, itemIndex) => ({
            parameterId: item.parameterId,
            schoolSelectedOptionKey: item.schoolSelectedOptionKey!,
            verifierSelectedOptionKey: item.verifierSelectedOptionKey!,
            schoolJustification: item.schoolJustification,
            ...(decide === null
              ? {}
              : { decision: decide(itemIndex), decidedAt }),
          })),
        },
      },
    });
    markerRunId = markerRunId ?? run.id;
    created += 1;
  }

  if (markerRunId) {
    await prisma.cycleTransition.create({
      data: { runId: markerRunId, fromState: 'PUBLISHED', toState: 'PUBLISHED', systemReason: MARKER },
    });
  }
  console.log(`field appeals volume demo: ${created} appeal(s) added against field1 inspections`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
