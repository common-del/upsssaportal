import { prisma } from '@/lib/db';

/**
 * Everything the Verification page needs, in one query pass.
 *
 * The page is three tabs over two lists: schools waiting to be checked, the same
 * list filtered to those with nobody assigned, and the verifiers themselves. All
 * three come from here so the counts on the tabs cannot disagree with the tables
 * under them.
 *
 * Evidence completeness used to travel with each row. It counted attachments
 * against indicators answered — useful to the verifier deciding how to approach a
 * school, useless to the person deciding who does the work, which is the only job
 * on this page. It belongs on the verifier's own screen.
 */

export type QueueRow = {
  udise: string;
  school: string;
  block: string;
  blockCode: string;
  district: string;
  districtCode: string;
  daysWaiting: number;
  /** Null when nobody is assigned — that is what the Unassigned tab selects on. */
  verifierId: string | null;
  verifierName: string | null;
  /** Needed to reassign; null when there is no assignment to move. */
  assignmentId: string | null;
};

export type VerifierSummary = {
  id: string;
  name: string;
  districtCode: string | null;
  district: string | null;
  capacity: number | null;
  assigned: number;
  verified: number;
};

/**
 * How a completed verification ended.
 *
 * Derived, never stored. A verification either matched the school's own scoring
 * or it did not, and the school either contested the difference or accepted it —
 * so the state falls out of two comparisons and needs no column of its own.
 */
export type VerifiedOutcome = 'CLEAN' | 'ACCEPTED' | 'APPEAL_OPEN' | 'APPEAL_DECIDED';

export type VerifiedRow = {
  udise: string;
  school: string;
  district: string;
  districtCode: string;
  block: string;
  blockCode: string;
  verifierId: string | null;
  verifierName: string | null;
  selfScore: number | null;
  selfBand: string | null;
  verifiedScore: number | null;
  verifiedBand: string | null;
  outcome: VerifiedOutcome;
};

export type VerificationQueue = {
  cycleId: string;
  waiting: number;
  unassigned: number;
  oldestDays: number;
  rows: QueueRow[];
  verifiers: VerifierSummary[];
  /** Completed verifications, whatever came of them. The queue's other tabs are
   *  work outstanding; this is the record of work done. */
  verified: VerifiedRow[];
  verifiedCounts: Record<VerifiedOutcome, number>;
};

/** Scores are held as floats and rounded to one decimal for display, so a
 *  difference smaller than this is representation noise, not a disagreement. */
const SCORE_EPSILON = 0.05;

/** The tabs filter client-side, so the whole queue ships rather than a page of it.
 *  Well within reason at a few hundred rows; revisit if a cycle ever leaves
 *  thousands unverified at once. */
const QUEUE_LIMIT = 500;

export async function buildVerificationQueue(): Promise<VerificationQueue | null> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const now = Date.now();

  const [submissions, assignments, completed, verifiers, districts, results, gradeBands, appeals] =
    await Promise.all([
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        submittedAt: true,
        school: {
          select: {
            nameEn: true,
            districtCode: true,
            blockCode: true,
            district: { select: { nameEn: true } },
            block: { select: { nameEn: true } },
          },
        },
      },
    }),
    prisma.verifierAssignment.findMany({
      where: { cycleId: cycle.id },
      select: {
        id: true,
        schoolUdise: true,
        verifier: { select: { id: true, name: true, username: true } },
      },
    }),
    // School and verifier travel with the submission rather than being looked up
    // through the assignment: a school whose self-assessment has moved past
    // SUBMITTED is absent from `submissions` above, so joining through that list
    // would drop it from the Verified tab.
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        verifier: { select: { id: true, name: true, username: true } },
        school: {
          select: {
            nameEn: true,
            districtCode: true,
            blockCode: true,
            district: { select: { nameEn: true } },
            block: { select: { nameEn: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: 'VERIFIER', active: true },
      select: { id: true, name: true, username: true, districtCode: true, verifierCapacity: true },
    }),
    prisma.district.findMany({ select: { code: true, nameEn: true } }),
    prisma.result.findMany({
      where: { cycleId: cycle.id },
      select: { schoolUdise: true, selfScorePercent: true, verifierScorePercent: true },
    }),
    prisma.gradeBand.findMany({
      where: { framework: { cycleId: cycle.id } },
      select: { labelEn: true, minPercent: true, maxPercent: true },
      orderBy: { order: 'asc' },
    }),
    prisma.appeal.findMany({
      where: { cycleId: cycle.id, status: { notIn: ['DRAFT'] } },
      select: { schoolUdise: true, items: { select: { decision: true } } },
    }),
    ]);

  const districtName = new Map(districts.map((d) => [d.code, d.nameEn]));
  const done = new Set(completed.map((c) => c.schoolUdise));
  const assignmentBy = new Map(assignments.map((a) => [a.schoolUdise, a]));
  const resultBy = new Map(results.map((r) => [r.schoolUdise, r]));
  const appealBy = new Map(appeals.map((a) => [a.schoolUdise, a]));

  /** Upper bound exclusive except on the top band, matching computeAndStoreResult. */
  const bandFor = (score: number | null): string | null => {
    if (score == null) return null;
    for (let i = 0; i < gradeBands.length; i++) {
      const b = gradeBands[i]!;
      const last = i === gradeBands.length - 1;
      if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) {
        return b.labelEn;
      }
    }
    return null;
  };

  const rows: QueueRow[] = submissions
    .filter((s) => !done.has(s.schoolUdise))
    .map((s) => {
      const a = assignmentBy.get(s.schoolUdise);
      return {
        udise: s.schoolUdise,
        school: s.school?.nameEn ?? s.schoolUdise,
        block: s.school?.block?.nameEn ?? '—',
        blockCode: s.school?.blockCode ?? '',
        district: s.school?.district?.nameEn ?? '—',
        districtCode: s.school?.districtCode ?? '',
        // Falls back to zero rather than guessing when submittedAt is missing, so a
        // missing timestamp reads as "just arrived" instead of inventing a wait.
        daysWaiting: s.submittedAt
          ? Math.max(0, Math.floor((now - s.submittedAt.getTime()) / 86_400_000))
          : 0,
        verifierId: a?.verifier?.id ?? null,
        verifierName: a?.verifier ? (a.verifier.name ?? a.verifier.username) : null,
        assignmentId: a?.id ?? null,
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  // Load counts every school on a verifier's plate, finished or not — that is what
  // "do they have room" means.
  const loadBy = new Map<string, number>();
  for (const a of assignments) {
    const id = a.verifier?.id;
    if (id) loadBy.set(id, (loadBy.get(id) ?? 0) + 1);
  }
  const verifiedBy = new Map<string, number>();
  for (const c of completed) {
    const id = c.verifier?.id ?? assignmentBy.get(c.schoolUdise)?.verifier?.id;
    if (id) verifiedBy.set(id, (verifiedBy.get(id) ?? 0) + 1);
  }

  const verified: VerifiedRow[] = completed
    .map((c) => {
      const r = resultBy.get(c.schoolUdise);
      const selfScore = r?.selfScorePercent ?? null;
      const verifiedScore = r?.verifierScorePercent ?? null;
      const appeal = appealBy.get(c.schoolUdise);

      // An appeal answers the question outright: the school disagreed and said so.
      // Only when there is none does the comparison decide, and a school that was
      // marked down without appealing has accepted the verifier's score — which is
      // what the process expects of it.
      const outcome: VerifiedOutcome = appeal
        ? appeal.items.some((i) => i.decision === 'PENDING')
          ? 'APPEAL_OPEN'
          : 'APPEAL_DECIDED'
        : selfScore != null &&
            verifiedScore != null &&
            Math.abs(selfScore - verifiedScore) < SCORE_EPSILON
          ? 'CLEAN'
          : selfScore == null || verifiedScore == null
            ? 'CLEAN'
            : 'ACCEPTED';

      return {
        udise: c.schoolUdise,
        school: c.school?.nameEn ?? c.schoolUdise,
        district: c.school?.district?.nameEn ?? '—',
        districtCode: c.school?.districtCode ?? '',
        block: c.school?.block?.nameEn ?? '—',
        blockCode: c.school?.blockCode ?? '',
        verifierId: c.verifier?.id ?? null,
        verifierName: c.verifier ? (c.verifier.name ?? c.verifier.username) : null,
        selfScore,
        selfBand: bandFor(selfScore),
        verifiedScore,
        verifiedBand: bandFor(verifiedScore),
        outcome,
      };
    })
    // Biggest drop first: a school that lost several points is the one worth a
    // second look, whether or not it thought to appeal.
    .sort((a, b) => {
      const dropA = (a.selfScore ?? 0) - (a.verifiedScore ?? 0);
      const dropB = (b.selfScore ?? 0) - (b.verifiedScore ?? 0);
      return dropB - dropA || a.school.localeCompare(b.school);
    });

  const verifiedCounts: Record<VerifiedOutcome, number> = {
    CLEAN: 0,
    ACCEPTED: 0,
    APPEAL_OPEN: 0,
    APPEAL_DECIDED: 0,
  };
  for (const v of verified) verifiedCounts[v.outcome]++;

  return {
    cycleId: cycle.id,
    waiting: rows.length,
    unassigned: rows.filter((r) => !r.verifierId).length,
    oldestDays: rows.length ? rows[0].daysWaiting : 0,
    rows: rows.slice(0, QUEUE_LIMIT),
    verifiers: verifiers
      .map((v) => ({
        id: v.id,
        name: v.name ?? v.username,
        districtCode: v.districtCode,
        district: v.districtCode ? (districtName.get(v.districtCode) ?? v.districtCode) : null,
        capacity: v.verifierCapacity,
        assigned: loadBy.get(v.id) ?? 0,
        verified: verifiedBy.get(v.id) ?? 0,
      }))
      // Emptiest first, so the list doubles as the answer to "who has room".
      .sort((a, b) => a.assigned - b.assigned || a.name.localeCompare(b.name)),
    verified,
    verifiedCounts,
  };
}
