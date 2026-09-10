import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Appeals against field1's published inspections, so the on-ground verifier's overview shows
 * the after-the-visit story: one appeal waiting on the SSSA, one already decided with a mixed
 * outcome.
 *
 * A separate seed rather than an extension of seedVerificationPipelineDemo, because that seed
 * short-circuits on its own marker and the production database already carries it; code added
 * inside it would never run again. This one has its own marker and builds on whatever published
 * runs the pipeline demo left behind.
 *
 * The appeals are coherent with the pipeline: each contested indicator is one where the visit's
 * discrepancy stands (the school claims its original level, the verifier's proposed level was
 * published), which is exactly what getDifferingParameters derives for a pipeline school.
 */

const MARKER = 'demo-field-appeals';
const DAY = 86_400_000;

const JUSTIFICATIONS = [
  'The laboratory equipment was in the adjoining store room on the day of the visit because the floor was being relaid. The purchase vouchers and the stock register are uploaded under this indicator.',
  'The verifier saw the room during the mid day meal, when the materials are locked away. The issue register shows daily use through the term.',
  'The repair was completed the week after the visit. The invoice and a dated photograph are attached as evidence.',
  'The provision at the rear of the campus was missed during the walkround. It serves both classroom blocks and is photographed from the gate.',
];

async function main() {
  const marker = await prisma.cycleTransition.findFirst({ where: { systemReason: MARKER } });
  if (marker) {
    console.log('field appeals demo: already seeded, leaving it alone');
    return;
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('field appeals demo: no active cycle');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) return console.log('field appeals demo: no framework');

  const field1 = await prisma.user.findUnique({
    where: { username: 'field1' },
    select: { verifierProfile: { select: { id: true } } },
  });
  if (!field1?.verifierProfile) return console.log('field appeals demo: field1 has no profile');
  const sssa = await prisma.user.findUnique({ where: { username: 'sssa' }, select: { id: true } });

  // Published runs whose result rests on a visit field1 signed off, newest publication first.
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
    take: 6,
  });

  const alreadyAppealed = new Set(
    (
      await prisma.appeal.findMany({
        where: { cycleId: cycle.id, schoolUdise: { in: runs.map((r) => r.schoolUdise) } },
        select: { schoolUdise: true },
      })
    ).map((a) => a.schoolUdise),
  );
  const candidates = runs.filter((r) => !alreadyAppealed.has(r.schoolUdise) && r.discrepancies.length >= 2);
  if (candidates.length === 0) return console.log('field appeals demo: no published field1 runs to appeal');

  // Levels to option keys, per parameter.
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
  let created = 0;

  // One appeal still waiting on the SSSA. Filed two days after publication; it also lands in the
  // admin's Decisions inbox, which is the same story from the other chair.
  {
    const run = candidates[0]!;
    const items = itemsFor(run, 4);
    if (items.length >= 2) {
      const submittedAt = new Date(Math.min(run.publishedAt!.getTime() + 2 * DAY, now - 3_600_000));
      await prisma.appeal.create({
        data: {
          cycleId: cycle.id,
          schoolUdise: run.schoolUdise,
          frameworkId: framework.id,
          status: 'SUBMITTED',
          submittedAt,
          items: {
            create: items.map((i) => ({
              parameterId: i.parameterId,
              schoolSelectedOptionKey: i.schoolSelectedOptionKey!,
              verifierSelectedOptionKey: i.verifierSelectedOptionKey!,
              schoolJustification: i.schoolJustification,
            })),
          },
        },
      });
      await prisma.cycleTransition.create({
        data: { runId: run.id, fromState: 'PUBLISHED', toState: 'PUBLISHED', systemReason: MARKER },
      });
      created += 1;
    }
  }

  // One appeal already decided, mixed: the first contested indicator kept the verifier's level,
  // the second went the school's way. The mixed outcome is the demonstration; a clean sweep in
  // either direction would read as a rubber stamp.
  if (candidates.length > 1) {
    const run = candidates[1]!;
    const items = itemsFor(run, 2);
    if (items.length === 2) {
      const submittedAt = new Date(Math.min(run.publishedAt!.getTime() + 1 * DAY, now - 2 * DAY));
      const decidedAt = new Date(Math.min(submittedAt.getTime() + 3 * DAY, now - 3_600_000));
      await prisma.appeal.create({
        data: {
          cycleId: cycle.id,
          schoolUdise: run.schoolUdise,
          frameworkId: framework.id,
          status: 'DECIDED',
          submittedAt,
          decidedAt,
          decidedByUserId: sssa?.id ?? null,
          items: {
            create: items.map((i, idx) => ({
              parameterId: i.parameterId,
              schoolSelectedOptionKey: i.schoolSelectedOptionKey!,
              verifierSelectedOptionKey: i.verifierSelectedOptionKey!,
              schoolJustification: i.schoolJustification,
              decision: idx === 0 ? 'KEEP_VERIFIER' : 'ACCEPT_SCHOOL',
              decidedAt,
            })),
          },
        },
      });
      await prisma.cycleTransition.create({
        data: { runId: run.id, fromState: 'PUBLISHED', toState: 'PUBLISHED', systemReason: MARKER },
      });
      created += 1;
    }
  }

  console.log(`field appeals demo: ${created} appeal(s) created against field1 inspections`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
