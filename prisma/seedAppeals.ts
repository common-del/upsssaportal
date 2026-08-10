/**
 * Gives the Appeals page something to show.
 *
 * The page was empty because nothing had ever written an Appeal row. The only
 * code that creates one is lib/actions/finalization.ts, which runs when a school
 * files an appeal through the portal — and no school has. Not a bug in the page;
 * an empty table.
 *
 * Appeals are built out of disagreements that already exist in the data rather
 * than invented. A school only appeals an indicator where the verifier scored it
 * below what the school claimed, so this reads both sets of responses and takes
 * the parameters where the verifier's option is worth fewer rubric points. A
 * school with no such indicator has nothing to appeal and is skipped, which is
 * why the count below is smaller than the number of schools considered.
 *
 * One verifier is deliberately made an outlier — appealed against several times
 * more often than their peers, and upheld most of the time. That pattern is the
 * entire reason the "Appeals by verifier" table exists, and a demo where every
 * verifier looks identical shows the table without showing the point of it.
 *
 *   npx tsx prisma/seedAppeals.ts --dry-run
 *   npx tsx prisma/seedAppeals.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Mirrors MIN_VERIFICATIONS_FOR_RATE in lib/sssa/appeals.ts. Appeals are aimed
 *  at verifiers above this line, otherwise the by-verifier table stays empty
 *  however many appeals exist. */
const MIN_VERIFICATIONS_FOR_RATE = 20;

/** Roughly how many appeals to create. Deliberately small — every row lands on
 *  a page with no pagination, and a queue nobody could work through is not a
 *  more realistic queue. */
const TARGET_APPEALS = 30;

/** Share of the outlier's schools that appeal, against everyone else's. */
const OUTLIER_APPEAL_RATE = 0.3;
const NORMAL_APPEAL_RATE = 0.07;

/** Most indicators a school argues at once. Appeals in practice are narrow —
 *  a head teacher contests the two or three marks that moved their band. */
const MAX_ITEMS = 5;

/** Deterministic, so a re-run does not reshuffle who appealed what. Build steps
 *  run on every deploy and Math.random would rewrite the page each time. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 0–1 from a seed, for threshold comparisons. */
function unit(seed: string) {
  return (hash(seed) % 1000) / 1000;
}

const JUSTIFICATIONS = [
  'The register and photographs submitted with the self-assessment were not examined during the visit.',
  'The facility was available on the date of assessment. The verifier visited during vacation when it was locked.',
  'Records for the full academic year were provided. The verifier appears to have seen only the current term.',
  'The school holds the certificate for this indicator and has attached it again with this appeal.',
  'Measurements were taken from the older block, which is no longer in use by students.',
  'The verifier noted this as absent, but it was relocated to the new building before the visit.',
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    console.log('No active cycle. Nothing to do.');
    return;
  }
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) {
    console.log(`No framework for cycle ${cycle.name}. Nothing to do.`);
    return;
  }

  const existing = await prisma.appeal.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const alreadyAppealed = new Set(existing.map((a) => a.schoolUdise));
  if (alreadyAppealed.size >= TARGET_APPEALS) {
    console.log(`${alreadyAppealed.size} appeals already exist. Nothing to do.`);
    return;
  }

  // Only completed verifications: a draft is not a scoring decision, and counting
  // one would understate the verifier's appeal rate on the page.
  const verifications = await prisma.verificationSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED' },
    select: { schoolUdise: true, verifierUserId: true },
  });
  if (verifications.length === 0) {
    console.log('No completed verifications. A school cannot appeal what was never verified.');
    return;
  }

  const byVerifier = new Map<string, string[]>();
  for (const v of verifications) {
    byVerifier.set(v.verifierUserId, [...(byVerifier.get(v.verifierUserId) ?? []), v.schoolUdise]);
  }

  const eligible = [...byVerifier.entries()]
    .filter(([, udises]) => udises.length >= MIN_VERIFICATIONS_FOR_RATE)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(
    `${verifications.length} completed verifications across ${byVerifier.size} verifiers; ` +
      `${eligible.length} have at least ${MIN_VERIFICATIONS_FOR_RATE}.`,
  );
  if (eligible.length === 0) {
    // Said plainly rather than fixed by lowering the threshold: one appeal against
    // three verifications is 33% and means nothing, which is what the threshold is
    // there to stop the page claiming.
    console.log(
      'The "Appeals by verifier" table needs at least one verifier above that line and will stay hidden.',
    );
  }

  // Sorted by id so the outlier is the same verifier on every run, not whoever
  // the query happened to return first.
  const pool = (eligible.length > 0 ? eligible : [...byVerifier.entries()]).sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  );
  const outlierId = pool[0]![0];

  const candidates: { udise: string; verifierId: string; isOutlier: boolean }[] = [];
  for (const [verifierId, udises] of pool) {
    const isOutlier = verifierId === outlierId;
    const rate = isOutlier ? OUTLIER_APPEAL_RATE : NORMAL_APPEAL_RATE;
    for (const udise of udises) {
      if (alreadyAppealed.has(udise)) continue;
      if (unit(`appeal:${udise}`) < rate) candidates.push({ udise, verifierId, isOutlier });
    }
  }
  // Outliers first so they survive the cut to TARGET_APPEALS — otherwise the
  // pattern the page exists to show can be trimmed away by the limit.
  candidates.sort((a, b) => Number(b.isOutlier) - Number(a.isOutlier));
  // Counted against appeals that already exist, not from zero. A first run that
  // creates fewer than the target — because some schools had nothing to contest —
  // would otherwise top up by a full target again on the next build, and the queue
  // would grow every deploy.
  const chosen = candidates.slice(0, Math.max(0, TARGET_APPEALS - alreadyAppealed.size));

  if (chosen.length === 0) {
    console.log('No schools to appeal. Nothing to do.');
    return;
  }

  const udises = chosen.map((c) => c.udise);
  const [rubric, saSubs, vSubs] = await Promise.all([
    prisma.rubricMapping.findMany({
      where: { frameworkId: framework.id },
      select: { parameterId: true, optionKey: true, score: true },
    }),
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: {
        schoolUdise: true,
        responses: { select: { parameterId: true, selectedOptionKey: true } },
      },
    }),
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        responses: { select: { parameterId: true, selectedOptionKey: true } },
      },
    }),
  ]);

  const scoreOf = new Map(rubric.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const selfBy = new Map(
    saSubs.map((s) => [s.schoolUdise, new Map(s.responses.map((r) => [r.parameterId, r.selectedOptionKey]))]),
  );
  const verifBy = new Map(
    vSubs.map((s) => [s.schoolUdise, new Map(s.responses.map((r) => [r.parameterId, r.selectedOptionKey]))]),
  );

  let created = 0;
  let itemsCreated = 0;
  let skippedNoDispute = 0;
  const tally = new Map<string, { appealed: number; upheld: number }>();

  for (const c of chosen) {
    const self = selfBy.get(c.udise);
    const verif = verifBy.get(c.udise);
    if (!self || !verif) {
      skippedNoDispute++;
      continue;
    }

    // The indicators the school actually lost points on. Anything the verifier
    // agreed with, or scored higher, is not something a school appeals.
    const contested = [...self.entries()]
      .map(([parameterId, schoolKey]) => {
        const verifierKey = verif.get(parameterId);
        if (!verifierKey || verifierKey === schoolKey) return null;
        const schoolScore = scoreOf.get(`${parameterId}:${schoolKey}`) ?? 0;
        const verifierScore = scoreOf.get(`${parameterId}:${verifierKey}`) ?? 0;
        return verifierScore < schoolScore ? { parameterId, schoolKey, verifierKey } : null;
      })
      .filter((x): x is { parameterId: string; schoolKey: string; verifierKey: string } => x !== null)
      // By parameter id, so the same school argues the same indicators each run.
      .sort((a, b) => (a.parameterId < b.parameterId ? -1 : 1))
      .slice(0, MAX_ITEMS);

    if (contested.length === 0) {
      skippedNoDispute++;
      continue;
    }

    // Roughly half the queue is still open, which is what an officer signing in
    // mid-cycle would find. The rest are decided so the by-verifier table has
    // upheld rates to report.
    const decided = unit(`decided:${c.udise}`) < 0.45;
    // The outlier is upheld far more often — that is what makes their appeal rate
    // a scoring problem rather than a run of aggrieved schools.
    const upheldChance = c.isOutlier ? 0.75 : 0.25;

    const submittedAt = new Date(
      Date.now() - (5 + (hash(`when:${c.udise}`) % 40)) * 86_400_000,
    );

    const t = tally.get(c.verifierId) ?? { appealed: 0, upheld: 0 };
    t.appealed += 1;

    const items = contested.map((item, i) => {
      const decision = !decided
        ? 'PENDING'
        : unit(`item:${c.udise}:${item.parameterId}`) < upheldChance
          ? 'ACCEPT_SCHOOL'
          : 'KEEP_VERIFIER';
      return {
        parameterId: item.parameterId,
        schoolSelectedOptionKey: item.schoolKey,
        verifierSelectedOptionKey: item.verifierKey,
        schoolJustification: JUSTIFICATIONS[hash(`why:${c.udise}:${i}`) % JUSTIFICATIONS.length]!,
        decision,
        decidedAt: decision === 'PENDING' ? null : submittedAt,
      };
    });

    if (decided && items.some((i) => i.decision === 'ACCEPT_SCHOOL')) t.upheld += 1;
    tally.set(c.verifierId, t);

    itemsCreated += items.length;
    created++;

    if (dryRun) continue;

    await prisma.appeal.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: c.udise,
        frameworkId: framework.id,
        status: decided ? 'DECIDED' : 'SUBMITTED',
        submittedAt,
        decidedAt: decided ? submittedAt : null,
        items: { create: items },
      },
    });
  }

  console.log(
    `${created} appeals over ${itemsCreated} indicators` +
      (skippedNoDispute > 0 ? `; ${skippedNoDispute} schools had nothing to contest` : ''),
  );
  for (const [verifierId, t] of tally) {
    const total = byVerifier.get(verifierId)?.length ?? 0;
    const marker = verifierId === outlierId ? '  ← outlier' : '';
    console.log(
      `  ${t.appealed}/${total} appealed (${Math.round((t.appealed / Math.max(1, total)) * 100)}%), ` +
        `${t.upheld} upheld${marker}`,
    );
  }

  if (dryRun) console.log('\n--dry-run: nothing written.');
  else console.log('\n✓ Appeals seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
