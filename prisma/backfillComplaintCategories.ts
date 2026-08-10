/**
 * Moves complaints off the appeal vocabulary they were seeded with.
 *
 * seed-dummy.ts filed its mock tickets under Evidence Mismatch, Score Mismatch,
 * Documentation Conflict, Procedural and Evaluator Observation Conflict. Those
 * describe a school disputing its own verification, which is what Appeals is
 * for. Complaints come from the public, so the SSSA page ended up reporting
 * "Documentation Conflict" as the public's leading concern — a category no
 * member of the public can now select.
 *
 * There is no meaning-preserving translation between the two lists. They are not
 * two wordings of one idea; they are two mechanisms with different filers. So
 * this does not attempt a semantic mapping. It spreads the affected mock rows
 * across the public categories deterministically, which makes the chart
 * self-consistent without claiming these complaints ever said anything.
 *
 * Only rows carrying one of the five retired codes are touched, so a complaint
 * a real person filed through the public form keeps whatever they chose. Once it
 * has run, no ticket holds a retired code and a second run does nothing.
 *
 *   npx tsx prisma/backfillComplaintCategories.ts --dry-run
 *   npx tsx prisma/backfillComplaintCategories.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Written by seed-dummy.ts, retired from the public form by seed.ts. */
const RETIRED = [
  'EVD_MISMATCH',
  'SCORE_MISMATCH',
  'DOC_CONFLICT',
  'PROCEDURAL',
  'EVAL_OBS',
];

/** Stable across runs and across machines, so re-running cannot reshuffle the
 *  chart. Math.random would make every deploy tell a slightly different story. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const target = await prisma.disputeCategory.findMany({
    where: { isActive: true },
    select: { code: true, nameEn: true },
    orderBy: { code: 'asc' },
  });
  if (target.length === 0) {
    console.log('No active complaint categories. Run seed.ts first.');
    return;
  }

  const stale = await prisma.ticket.findMany({
    where: { categoryCode: { in: RETIRED } },
    select: { id: true, categoryCode: true },
  });

  if (stale.length === 0) {
    console.log('No complaints are filed under an appeal category. Nothing to do.');
    return;
  }
  console.log(`${stale.length} complaints carry an appeal category.`);

  // Grouped so each category is one UPDATE rather than one per ticket.
  const byCode = new Map<string, string[]>();
  for (const t of stale) {
    const code = target[hash(t.id) % target.length]!.code;
    byCode.set(code, [...(byCode.get(code) ?? []), t.id]);
  }

  for (const [code, ids] of byCode) {
    const label = target.find((c) => c.code === code)!.nameEn;
    console.log(`  ${ids.length} → ${label}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  for (const [code, ids] of byCode) {
    await prisma.ticket.updateMany({ where: { id: { in: ids } }, data: { categoryCode: code } });
  }
  console.log(`\n✓ ${stale.length} complaints moved onto the public categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
