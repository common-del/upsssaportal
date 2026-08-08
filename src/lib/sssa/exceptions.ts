import { prisma } from '@/lib/db';

/**
 * PLACEHOLDER THRESHOLDS — these are policy decisions, not design ones.
 *
 * Every number here changes who appears on the monitoring page and therefore who
 * gets chased. They are set to defensible starting values so the page works, but
 * they need sign-off from whoever runs the cycle. Set them wrong and the page
 * cries wolf, which is worse than not having it: officers learn to skip it.
 *
 * Deliberately all in one place so changing them is a one-line edit.
 */
export const EXCEPTION_THRESHOLDS = {
  /** A district at or below this average is in the Uday band. */
  udayCeiling: 55,
  /** Ignore districts with fewer scored results than this — an average of 0
   *  because nothing has been scored yet is missing data, not poor performance,
   *  and flagging it would bury the districts that genuinely are behind. */
  minScoredResultsPerDistrict: 5,
  /** Self-assessment minus verifier score, in points, that counts as a real
   *  disagreement rather than ordinary variation. */
  scoreGapPoints: 15,
};

export type ExceptionColumn = { key: string; label: string; numeric?: boolean };

export type ExceptionGroup = {
  id: string;
  /** The headline count — this number is itself the finding. */
  count: number;
  /** What the count is of, read straight after the number. */
  title: string;
  /** The action it implies, not a restatement of the title. */
  action: string;
  tone: 'critical' | 'warning' | 'info' | 'idle';
  columns: ExceptionColumn[];
  rows: Record<string, string | number>[];
  /** Shown instead of a table when the count is zero. */
  clearMessage: string;
};

const MAX_ROWS = 50;

/**
 * The four standing questions an officer already has, answered before they ask.
 *
 * Each is computed from a small result set rather than one query per district or
 * block — with a few hundred submissions statewide it is far cheaper to pull the
 * rows once and aggregate in memory than to issue 75 averages.
 */
export async function buildExceptions(cycleId: string | null): Promise<ExceptionGroup[]> {
  if (!cycleId) return [];

  const [
    blocksWithSubmissionRows,
    allBlocks,
    schoolsByBlock,
    scoredResults,
    gapResults,
    verifiers,
    assignments,
  ] = await Promise.all([
    // Distinct blocks that have at least one submitted assessment. Done as a
    // relation filter rather than fetching every submitted UDISE and passing them
    // back as an IN list, which would grow to tens of thousands as the cycle fills.
    prisma.school.findMany({
      where: { selfAssessments: { some: { cycleId, status: 'SUBMITTED' } } },
      select: { blockCode: true },
      distinct: ['blockCode'],
    }),
    prisma.block.findMany({
      select: { code: true, nameEn: true, district: { select: { nameEn: true } } },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.school.groupBy({ by: ['blockCode'], _count: { _all: true } }),
    prisma.result.findMany({
      where: { cycleId, finalScorePercent: { not: null } },
      select: {
        finalScorePercent: true,
        school: { select: { districtCode: true, district: { select: { nameEn: true } } } },
      },
    }),
    prisma.result.findMany({
      where: { cycleId, selfScorePercent: { not: null }, verifierScorePercent: { not: null } },
      select: {
        selfScorePercent: true,
        verifierScorePercent: true,
        school: {
          select: { nameEn: true, block: { select: { nameEn: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: 'VERIFIER' },
      select: { id: true, username: true, verifierCapacity: true, districtCode: true },
    }),
    prisma.verifierAssignment.findMany({ where: { cycleId }, select: { verifierUserId: true } }),
  ]);

  const blockSchoolCount = new Map(schoolsByBlock.map((r) => [r.blockCode, r._count._all]));

  // 1. Blocks where nothing has been submitted at all.
  const blocksWithSubmissions = new Set(blocksWithSubmissionRows.map((s) => s.blockCode));
  const silentBlocks = allBlocks
    .filter((b) => !blocksWithSubmissions.has(b.code))
    .map((b) => ({
      block: b.nameEn,
      district: b.district.nameEn,
      schools: blockSchoolCount.get(b.code) ?? 0,
    }))
    .sort((a, b) => b.schools - a.schools);

  // 2. Districts sitting in the Uday band, ignoring those with too little data
  //    to judge. Averaged in memory from one query rather than 75.
  const byDistrict = new Map<string, { name: string; scores: number[] }>();
  for (const r of scoredResults) {
    const code = r.school.districtCode;
    const entry = byDistrict.get(code) ?? { name: r.school.district.nameEn, scores: [] };
    entry.scores.push(r.finalScorePercent ?? 0);
    byDistrict.set(code, entry);
  }
  const lowDistricts = [...byDistrict.values()]
    .filter((d) => d.scores.length >= EXCEPTION_THRESHOLDS.minScoredResultsPerDistrict)
    .map((d) => ({
      district: d.name,
      scored: d.scores.length,
      average: Math.round((d.scores.reduce((s, n) => s + n, 0) / d.scores.length) * 10) / 10,
    }))
    .filter((d) => d.average <= EXCEPTION_THRESHOLDS.udayCeiling)
    .sort((a, b) => a.average - b.average);

  // 3. Schools where the verifier's score is far from the school's own.
  const disagreements = gapResults
    .map((r) => {
      const self = r.selfScorePercent ?? 0;
      const verifier = r.verifierScorePercent ?? 0;
      return {
        school: r.school.nameEn,
        block: r.school.block.nameEn,
        self: Math.round(self),
        verifier: Math.round(verifier),
        gap: Math.round(Math.abs(self - verifier)),
      };
    })
    .filter((r) => r.gap >= EXCEPTION_THRESHOLDS.scoreGapPoints)
    .sort((a, b) => b.gap - a.gap);

  // 4. Verifiers holding capacity that is not being used.
  const assignedCounts = new Map<string, number>();
  for (const a of assignments) {
    assignedCounts.set(a.verifierUserId, (assignedCounts.get(a.verifierUserId) ?? 0) + 1);
  }
  const idleVerifiers = verifiers
    .filter((v) => (assignedCounts.get(v.id) ?? 0) === 0)
    .map((v) => ({
      verifier: v.username,
      district: v.districtCode ?? '—',
      capacity: v.verifierCapacity ?? 0,
      assigned: 0,
    }))
    .sort((a, b) => b.capacity - a.capacity);

  return [
    {
      id: 'silent-blocks',
      count: silentBlocks.length,
      title: 'blocks with no submissions at all',
      action: 'Needs chasing',
      tone: 'critical',
      columns: [
        { key: 'block', label: 'Block' },
        { key: 'district', label: 'District' },
        { key: 'schools', label: 'Schools', numeric: true },
      ],
      rows: silentBlocks.slice(0, MAX_ROWS),
      clearMessage: 'Every block has at least one submission.',
    },
    {
      id: 'low-districts',
      count: lowDistricts.length,
      title: `districts averaging ${EXCEPTION_THRESHOLDS.udayCeiling}% or below`,
      action: 'In the Uday band',
      tone: 'warning',
      columns: [
        { key: 'district', label: 'District' },
        { key: 'average', label: 'Average', numeric: true },
        { key: 'scored', label: 'Schools scored', numeric: true },
      ],
      rows: lowDistricts.slice(0, MAX_ROWS),
      clearMessage: `No district with at least ${EXCEPTION_THRESHOLDS.minScoredResultsPerDistrict} scored schools is in the Uday band.`,
    },
    {
      id: 'score-gaps',
      count: disagreements.length,
      title: `schools where evaluation differs by ${EXCEPTION_THRESHOLDS.scoreGapPoints} points or more`,
      action: 'Review needed',
      tone: 'info',
      columns: [
        { key: 'school', label: 'School' },
        { key: 'block', label: 'Block' },
        { key: 'self', label: 'Self', numeric: true },
        { key: 'verifier', label: 'Verifier', numeric: true },
        { key: 'gap', label: 'Gap', numeric: true },
      ],
      rows: disagreements.slice(0, MAX_ROWS),
      clearMessage: 'No school is far from its verifier’s score.',
    },
    {
      id: 'idle-verifiers',
      count: idleVerifiers.length,
      title: 'verifiers with nothing assigned',
      action: 'Capacity idle',
      tone: 'idle',
      columns: [
        { key: 'verifier', label: 'Verifier' },
        { key: 'district', label: 'District' },
        { key: 'capacity', label: 'Capacity', numeric: true },
        { key: 'assigned', label: 'Assigned', numeric: true },
      ],
      rows: idleVerifiers.slice(0, MAX_ROWS),
      clearMessage: 'Every verifier has at least one school assigned.',
    },
  ];
}
