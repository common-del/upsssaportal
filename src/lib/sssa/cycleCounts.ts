import { prisma } from '@/lib/db';

/**
 * Where every school stands in the cycle, as four counts that sum to the register.
 *
 * The previous funnel was cumulative — every Submitted school was also counted as
 * Started — which reads fine as a funnel but cannot answer "how many schools are
 * sitting in draft right now". These four are mutually exclusive and add up to the
 * total, so each number is a set of schools you could go and list.
 *
 *   notStarted  no SelfAssessmentSubmission row for the cycle
 *   draft       SelfAssessmentSubmission.status === 'DRAFT'
 *   finished    status === 'SUBMITTED', no verification yet
 *   verified    VerificationSubmission.status === 'SUBMITTED'
 */

export type CycleCounts = {
  cycleName: string;
  totalSchools: number;
  notStarted: number;
  draft: number;
  finished: number;
  verified: number;
};

export type BehindBlock = {
  code: string;
  name: string;
  district: string;
  schools: number;
  started: number;
  startedPct: number;
};

/** Blocks smaller than this rank badly on percentage alone — a two-school block at
 *  0% is not where the state should send anyone first. */
const MIN_SCHOOLS_FOR_BLOCK_RANK = 20;
const BEHIND_LIMIT = 8;

export async function buildCycleCounts(): Promise<CycleCounts | null> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const [totalSchools, draft, submitted, verified] = await Promise.all([
    prisma.school.count(),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'DRAFT' } }),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
    prisma.verificationSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
  ]);

  // A verified school still has a SUBMITTED self-assessment, so it would be counted
  // twice unless it is taken out of the finished bucket.
  const finished = Math.max(0, submitted - verified);
  const notStarted = Math.max(0, totalSchools - draft - submitted);

  return { cycleName: cycle.name, totalSchools, notStarted, draft, finished, verified };
}

/**
 * Blocks holding the most schools that have not opened the form.
 *
 * The counts say how many have not started; this says where they are. Sorted by the
 * number of schools yet to start rather than by percentage, because the state's
 * next action is a call to a block that unlocks hundreds of schools, not to whoever
 * happens to have the lowest ratio.
 */
export async function buildBehindBlocks(): Promise<BehindBlock[]> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return [];

  const [blocks, schoolsPerBlock, startedRows] = await Promise.all([
    prisma.block.findMany({
      select: { code: true, nameEn: true, district: { select: { nameEn: true } } },
    }),
    prisma.school.groupBy({ by: ['blockCode'], _count: { _all: true } }),
    // Distinct blocks touched, as a relation filter rather than pulling every
    // started UDISE back and passing them in an IN list — that list grows to tens
    // of thousands as the cycle fills.
    prisma.school.findMany({
      where: { selfAssessments: { some: { cycleId: cycle.id } } },
      select: { blockCode: true },
    }),
  ]);

  const totalBy = new Map(schoolsPerBlock.map((r) => [r.blockCode, r._count._all]));
  const startedBy = new Map<string, number>();
  for (const s of startedRows) startedBy.set(s.blockCode, (startedBy.get(s.blockCode) ?? 0) + 1);

  return blocks
    .map((b) => {
      const schools = totalBy.get(b.code) ?? 0;
      const started = startedBy.get(b.code) ?? 0;
      return {
        code: b.code,
        name: b.nameEn,
        district: b.district?.nameEn ?? '—',
        schools,
        started,
        startedPct: schools > 0 ? Math.round((started / schools) * 100) : 0,
      };
    })
    .filter((b) => b.schools >= MIN_SCHOOLS_FOR_BLOCK_RANK && b.started < b.schools)
    .sort((a, b) => b.schools - b.started - (a.schools - a.started))
    .slice(0, BEHIND_LIMIT);
}
