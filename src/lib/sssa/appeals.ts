import { prisma } from '@/lib/db';

/**
 * Appeals: a school disputing its own verification.
 *
 * Distinct from a Ticket, which is a parent or member of the public complaining
 * about a school. An Appeal is one per school per cycle, argued indicator by
 * indicator through AppealItem rows, and only SSSA can decide it — there is no
 * escalation ladder and no SLA clock. Conflating the two into one "disputes" queue
 * hid the difference and, with it, the one pattern that only appears when appeals
 * are grouped by who did the scoring rather than who complained.
 */

/** A score with the grade band it falls in, since a number alone does not say
 *  whether a school passed a threshold that matters. */
export type Scored = { score: number | null; band: string | null };

export type AppealRow = {
  id: string;
  udise: string;
  school: string;
  district: string;
  block: string | null;
  verifier: string | null;
  verifierId: string | null;
  items: number;
  pending: number;
  self: Scored;
  verified: Scored;
  /** Verifier's score with the school's answer restored on every upheld
   *  indicator. Equal to verified until an appeal goes the school's way. */
  final: Scored;
  submittedAt: Date | null;
};

export type VerifierAppealRate = {
  verifierId: string;
  verifier: string;
  verified: number;
  appealed: number;
  upheld: number;
};

export type AppealsData = {
  open: number;
  pendingItems: number;
  rows: AppealRow[];
  byVerifier: VerifierAppealRate[];
};

/** Below this, an appeal rate is noise — one appeal against three verifications
 *  is 33% and means nothing. */
const MIN_VERIFICATIONS_FOR_RATE = 20;

export async function buildAppeals(): Promise<AppealsData> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return { open: 0, pendingItems: 0, rows: [], byVerifier: [] };

  const appeals = await prisma.appeal.findMany({
    where: { cycleId: cycle.id, status: { notIn: ['DRAFT'] } },
    select: {
      id: true,
      schoolUdise: true,
      status: true,
      submittedAt: true,
      school: {
        select: {
          nameEn: true,
          district: { select: { nameEn: true } },
          block: { select: { nameEn: true } },
        },
      },
      items: { select: { decision: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  const udises = appeals.map((a) => a.schoolUdise);

  const [results, verifications, gradeBands] = await Promise.all([
    prisma.result.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: {
        schoolUdise: true,
        selfScorePercent: true,
        verifierScorePercent: true,
        finalScorePercent: true,
      },
    }),
    // Only completed verifications: a draft is not a scoring decision, so counting
    // it would deflate every verifier's appeal rate by whatever they have open.
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        verifier: { select: { id: true, name: true, username: true } },
      },
    }),
    prisma.gradeBand.findMany({
      where: { framework: { cycleId: cycle.id } },
      select: { labelEn: true, minPercent: true, maxPercent: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  /** The band a score falls in. Upper bound is exclusive except on the top band,
   *  matching computeAndStoreResult, so 76.0 reads as Excellent and 100 still fits. */
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
  const scored = (score: number | null | undefined): Scored => {
    const s = score ?? null;
    return { score: s, band: bandFor(s) };
  };

  const resultBy = new Map(results.map((r) => [r.schoolUdise, r]));
  // Keyed on the verifier's id, not their display name — grouping by name would
  // merge two people who happen to share one, and the profile needs an id to link.
  const verifierBy = new Map(
    verifications.map((v) => [
      v.schoolUdise,
      v.verifier ? { id: v.verifier.id, name: v.verifier.name ?? v.verifier.username } : null,
    ]),
  );

  const rows: AppealRow[] = appeals.map((a) => {
    const r = resultBy.get(a.schoolUdise);
    return {
      id: a.id,
      udise: a.schoolUdise,
      school: a.school?.nameEn ?? a.schoolUdise,
      district: a.school?.district?.nameEn ?? '—',
      block: a.school?.block?.nameEn ?? null,
      verifier: verifierBy.get(a.schoolUdise)?.name ?? null,
      verifierId: verifierBy.get(a.schoolUdise)?.id ?? null,
      items: a.items.length,
      pending: a.items.filter((i) => i.decision === 'PENDING').length,
      self: scored(r?.selfScorePercent),
      verified: scored(r?.verifierScorePercent),
      final: scored(r?.finalScorePercent),
      submittedAt: a.submittedAt,
    };
  });

  // Grouped by who did the scoring. One verifier appealed at several times the rate
  // of their peers, and upheld most of the time, is a training or conduct question —
  // not a run of unlucky schools. That only shows up at this grouping.
  const totalByVerifier = new Map<string, { name: string; n: number }>();
  for (const v of verifications) {
    if (!v.verifier) continue;
    const name = v.verifier.name ?? v.verifier.username;
    const cur = totalByVerifier.get(v.verifier.id) ?? { name, n: 0 };
    cur.n += 1;
    totalByVerifier.set(v.verifier.id, cur);
  }

  const appealedByVerifier = new Map<string, { appealed: number; upheld: number }>();
  for (const a of appeals) {
    const v = verifierBy.get(a.schoolUdise);
    if (!v) continue;
    const cur = appealedByVerifier.get(v.id) ?? { appealed: 0, upheld: 0 };
    cur.appealed += 1;
    // An appeal counts as upheld when any indicator went the school's way — the
    // school was right about something the verifier got wrong. ACCEPT_SCHOOL and
    // KEEP_VERIFIER are the two decisions an item can carry.
    if (a.items.some((i) => i.decision === 'ACCEPT_SCHOOL')) cur.upheld += 1;
    appealedByVerifier.set(v.id, cur);
  }

  const byVerifier: VerifierAppealRate[] = [...totalByVerifier.entries()]
    .filter(([, v]) => v.n >= MIN_VERIFICATIONS_FOR_RATE)
    .map(([verifierId, v]) => {
      const a = appealedByVerifier.get(verifierId) ?? { appealed: 0, upheld: 0 };
      return { verifierId, verifier: v.name, verified: v.n, appealed: a.appealed, upheld: a.upheld };
    })
    .filter((v) => v.appealed > 0)
    .sort((a, b) => b.appealed / b.verified - a.appealed / a.verified);

  return {
    open: rows.filter((r) => r.pending > 0).length,
    pendingItems: rows.reduce((a, r) => a + r.pending, 0),
    rows,
    byVerifier,
  };
}
