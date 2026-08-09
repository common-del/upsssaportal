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

export type AppealRow = {
  id: string;
  udise: string;
  school: string;
  district: string;
  verifier: string | null;
  items: number;
  pending: number;
  selfScore: number | null;
  verifierScore: number | null;
  submittedAt: Date | null;
};

export type VerifierAppealRate = {
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
      school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
      items: { select: { decision: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  const udises = appeals.map((a) => a.schoolUdise);

  const [results, verifications] = await Promise.all([
    prisma.result.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: { schoolUdise: true, selfScorePercent: true, verifierScorePercent: true },
    }),
    // Only completed verifications: a draft is not a scoring decision, so counting
    // it would deflate every verifier's appeal rate by whatever they have open.
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: { schoolUdise: true, verifier: { select: { name: true, username: true } } },
    }),
  ]);

  const resultBy = new Map(results.map((r) => [r.schoolUdise, r]));
  const verifierBy = new Map(
    verifications.map((v) => [v.schoolUdise, v.verifier?.name ?? v.verifier?.username ?? null]),
  );

  const rows: AppealRow[] = appeals.map((a) => {
    const r = resultBy.get(a.schoolUdise);
    return {
      id: a.id,
      udise: a.schoolUdise,
      school: a.school?.nameEn ?? a.schoolUdise,
      district: a.school?.district?.nameEn ?? '—',
      verifier: verifierBy.get(a.schoolUdise) ?? null,
      items: a.items.length,
      pending: a.items.filter((i) => i.decision === 'PENDING').length,
      selfScore: r?.selfScorePercent ?? null,
      verifierScore: r?.verifierScorePercent ?? null,
      submittedAt: a.submittedAt,
    };
  });

  // Grouped by who did the scoring. One verifier appealed at several times the rate
  // of their peers, and upheld most of the time, is a training or conduct question —
  // not a run of unlucky schools. That only shows up at this grouping.
  const totalByVerifier = new Map<string, number>();
  for (const v of verifications) {
    const name = v.verifier?.name ?? v.verifier?.username;
    if (!name) continue;
    totalByVerifier.set(name, (totalByVerifier.get(name) ?? 0) + 1);
  }

  const appealedByVerifier = new Map<string, { appealed: number; upheld: number }>();
  for (const a of appeals) {
    const name = verifierBy.get(a.schoolUdise);
    if (!name) continue;
    const cur = appealedByVerifier.get(name) ?? { appealed: 0, upheld: 0 };
    cur.appealed += 1;
    // An appeal counts as upheld when any indicator went the school's way — the
    // school was right about something the verifier got wrong. ACCEPT_SCHOOL and
    // KEEP_VERIFIER are the two decisions an item can carry.
    if (a.items.some((i) => i.decision === 'ACCEPT_SCHOOL')) cur.upheld += 1;
    appealedByVerifier.set(name, cur);
  }

  const byVerifier: VerifierAppealRate[] = [...totalByVerifier.entries()]
    .filter(([, verified]) => verified >= MIN_VERIFICATIONS_FOR_RATE)
    .map(([verifier, verified]) => {
      const a = appealedByVerifier.get(verifier) ?? { appealed: 0, upheld: 0 };
      return { verifier, verified, appealed: a.appealed, upheld: a.upheld };
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
