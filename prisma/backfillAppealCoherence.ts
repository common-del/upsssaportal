/**
 * Makes the Appeals page hold only appeals.
 *
 * The process is: a school self-assesses, a verifier verifies, and if the two
 * agree there is nothing to decide. Where they differ the verifier's score
 * stands and the school is expected to accept it. Only when a school actively
 * contests a mark-down does the case reach SSSA. So the Appeals queue should
 * contain exactly one kind of row — a school arguing that it was marked down
 * wrongly.
 *
 * It did not. seedVerificationActivity moved a school's answer *up* on a quarter
 * of its disagreements, which produced two kinds of nonsense:
 *
 *   a verified score above the self score, with the school appealing — nobody
 *   appeals a mark in their own favour; and
 *
 *   up-moves cancelling down-moves, so a school sat on the queue with its self
 *   and verified scores identical and nothing in dispute at all.
 *
 * The seeder is fixed, but it will not re-run over schools it has already done.
 * So this repairs what exists, in the order the process itself implies:
 *
 *   1. A verifier response scoring above the school's is pulled back to the
 *      school's answer. Agreement, not a raise.
 *   2. Appeal items whose verifier answer is no longer worse are dropped —
 *      there is nothing left to argue about on that indicator.
 *   3. Appeals left with no items are deleted. A school with no contested
 *      indicator never appealed.
 *
 * backfillResultsFromResponses runs after this and recomputes every score from
 * the repaired answers.
 *
 *   npx tsx prisma/backfillAppealCoherence.ts --dry-run
 *   npx tsx prisma/backfillAppealCoherence.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('No active cycle. Nothing to do.');
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) return console.log('No framework for the active cycle. Nothing to do.');

  const rubrics = await prisma.rubricMapping.findMany({
    where: { frameworkId: framework.id },
    select: { parameterId: true, optionKey: true, score: true },
  });
  if (rubrics.length === 0) {
    return console.log('No rubric on this framework, so no answer can be compared. Nothing to do.');
  }
  const scoreOf = new Map(rubrics.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const worth = (parameterId: string, key: string) => scoreOf.get(`${parameterId}:${key}`) ?? 0;

  // ── 1. A verifier never scores a school above its own claim ────────────────
  const saSubs = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id },
    select: {
      schoolUdise: true,
      responses: { select: { parameterId: true, selectedOptionKey: true } },
    },
  });
  const selfBy = new Map(
    saSubs.map((s) => [s.schoolUdise, new Map(s.responses.map((r) => [r.parameterId, r.selectedOptionKey]))]),
  );

  const vSubs = await prisma.verificationSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED' },
    select: {
      schoolUdise: true,
      responses: { select: { id: true, parameterId: true, selectedOptionKey: true } },
    },
  });

  const raises: { id: string; to: string }[] = [];
  for (const v of vSubs) {
    const self = selfBy.get(v.schoolUdise);
    if (!self) continue;
    for (const r of v.responses) {
      const selfKey = self.get(r.parameterId);
      if (!selfKey || selfKey === r.selectedOptionKey) continue;
      if (worth(r.parameterId, r.selectedOptionKey) > worth(r.parameterId, selfKey)) {
        raises.push({ id: r.id, to: selfKey });
      }
    }
  }

  console.log(
    `${vSubs.length} verifications checked; ${raises.length} responses scored the school above its own answer.`,
  );
  if (!dryRun) {
    for (const r of raises) {
      await prisma.verificationResponse.update({
        where: { id: r.id },
        data: { selectedOptionKey: r.to },
      });
    }
  }

  // ── 2. Appeal items with nothing left to argue ─────────────────────────────
  // Re-read after the repair above, since an item's verifier answer may just
  // have changed.
  const appeals = await prisma.appeal.findMany({
    where: { cycleId: cycle.id },
    select: {
      id: true,
      schoolUdise: true,
      items: {
        select: { id: true, parameterId: true, schoolSelectedOptionKey: true, verifierSelectedOptionKey: true },
      },
    },
  });

  // The verifier's answers as they stand after step 1. Built from the rows
  // already in hand rather than re-queried per item, which would be one round
  // trip per indicator across every appeal.
  const raiseTo = new Map(raises.map((r) => [r.id, r.to]));
  const verifBy = new Map(
    vSubs.map((v) => [
      v.schoolUdise,
      new Map(v.responses.map((r) => [r.parameterId, raiseTo.get(r.id) ?? r.selectedOptionKey])),
    ]),
  );

  const deadItems: string[] = [];
  const emptyAppeals: string[] = [];
  for (const a of appeals) {
    const self = selfBy.get(a.schoolUdise);
    const verif = verifBy.get(a.schoolUdise);
    let live = 0;
    for (const item of a.items) {
      // The response row is the authority, not the item's stored copy — that copy
      // records what the school argued against, and step 1 may just have pulled
      // the verifier back to agreement.
      const effectiveVerifier = verif?.get(item.parameterId) ?? item.verifierSelectedOptionKey;
      const schoolKey = self?.get(item.parameterId) ?? item.schoolSelectedOptionKey;
      const stillWorse = worth(item.parameterId, effectiveVerifier) < worth(item.parameterId, schoolKey);
      if (stillWorse) {
        live++;
        continue;
      }
      deadItems.push(item.id);
    }
    if (live === 0) emptyAppeals.push(a.id);
  }

  console.log(
    `${appeals.length} appeals checked; ${deadItems.length} indicators no longer in dispute; ` +
      `${emptyAppeals.length} appeals left with nothing contested.`,
  );

  if (!dryRun) {
    if (deadItems.length > 0) {
      await prisma.appealItem.deleteMany({ where: { id: { in: deadItems } } });
    }
    // Items cascade on appeal delete, so the appeal goes last.
    if (emptyAppeals.length > 0) {
      await prisma.appeal.deleteMany({ where: { id: { in: emptyAppeals } } });
    }
    // Surviving items are re-stamped with the answers as they now stand, so
    // whoever opens the appeal sees the two options actually in dispute rather
    // than a snapshot taken before the repair.
    const dead = new Set(deadItems);
    const empty = new Set(emptyAppeals);
    for (const a of appeals) {
      if (empty.has(a.id)) continue;
      const self = selfBy.get(a.schoolUdise);
      const verif = verifBy.get(a.schoolUdise);
      for (const item of a.items) {
        if (dead.has(item.id)) continue;
        const schoolKey = self?.get(item.parameterId) ?? item.schoolSelectedOptionKey;
        const verifierKey = verif?.get(item.parameterId) ?? item.verifierSelectedOptionKey;
        if (
          schoolKey === item.schoolSelectedOptionKey &&
          verifierKey === item.verifierSelectedOptionKey
        ) {
          continue;
        }
        await prisma.appealItem.update({
          where: { id: item.id },
          data: { schoolSelectedOptionKey: schoolKey, verifierSelectedOptionKey: verifierKey },
        });
      }
    }
  }

  const remaining = appeals.length - emptyAppeals.length;
  console.log(`\n${remaining} appeals remain, every one a contested mark-down.`);
  if (dryRun) console.log('--dry-run: nothing written.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
