import { prisma } from '@/lib/db';

/**
 * What is waiting to be verified, and who is free to do it.
 *
 * Two facts that belong on the same page: schools have been waiting, and verifiers
 * are sitting idle. Neither is surprising alone; together they are a contradiction
 * with an obvious fix, and the assignment panel below can act on it immediately.
 *
 * Evidence completeness travels with each row because a submission answering forty
 * indicators with four attachments is a different job from one that documented
 * everything, and the verifier should know which they are picking up before they
 * start rather than after.
 */

export type QueueRow = {
  udise: string;
  school: string;
  district: string;
  daysWaiting: number;
  verifier: string | null;
  answered: number;
  evidenced: number;
};

export type IdleVerifier = {
  id: string;
  name: string;
  district: string | null;
  capacity: number | null;
  assigned: number;
};

export type VerificationQueue = {
  waiting: number;
  unassigned: number;
  oldestDays: number;
  rows: QueueRow[];
  idle: IdleVerifier[];
};

const QUEUE_LIMIT = 25;

export async function buildVerificationQueue(): Promise<VerificationQueue | null> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const now = Date.now();

  const [submissions, assignments, completed, verifiers] = await Promise.all([
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: {
        id: true,
        schoolUdise: true,
        submittedAt: true,
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
        _count: { select: { responses: true, evidenceLinks: true } },
      },
    }),
    prisma.verifierAssignment.findMany({
      where: { cycleId: cycle.id },
      select: {
        schoolUdise: true,
        verifier: { select: { id: true, name: true, username: true } },
      },
    }),
    // A school with a completed verification has left the queue.
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: { schoolUdise: true },
    }),
    prisma.user.findMany({
      where: { role: 'VERIFIER', active: true },
      select: {
        id: true,
        name: true,
        username: true,
        districtCode: true,
        verifierCapacity: true,
      },
    }),
  ]);

  const done = new Set(completed.map((c) => c.schoolUdise));
  const assignedTo = new Map(
    assignments.map((a) => [a.schoolUdise, a.verifier?.name ?? a.verifier?.username ?? null]),
  );

  const pending = submissions.filter((s) => !done.has(s.schoolUdise));

  const rows: QueueRow[] = pending
    .map((s) => ({
      udise: s.schoolUdise,
      school: s.school?.nameEn ?? s.schoolUdise,
      district: s.school?.district?.nameEn ?? '—',
      // Falls back to zero rather than guessing when submittedAt is missing, so a
      // missing timestamp reads as "just arrived" instead of inventing a wait.
      daysWaiting: s.submittedAt
        ? Math.max(0, Math.floor((now - s.submittedAt.getTime()) / 86_400_000))
        : 0,
      verifier: assignedTo.get(s.schoolUdise) ?? null,
      answered: s._count.responses,
      evidenced: s._count.evidenceLinks,
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  // Assignment load counts every school on a verifier's plate, finished or not —
  // that is what "do they have room" means. Idle is nobody assigned at all.
  const loadBy = new Map<string, number>();
  for (const a of assignments) {
    const id = a.verifier?.id;
    if (id) loadBy.set(id, (loadBy.get(id) ?? 0) + 1);
  }

  const idle: IdleVerifier[] = verifiers
    .map((v) => ({
      id: v.id,
      name: v.name ?? v.username,
      district: v.districtCode,
      capacity: v.verifierCapacity,
      assigned: loadBy.get(v.id) ?? 0,
    }))
    .filter((v) => v.assigned === 0)
    .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));

  return {
    waiting: rows.length,
    unassigned: rows.filter((r) => !r.verifier).length,
    oldestDays: rows.length ? rows[0].daysWaiting : 0,
    rows: rows.slice(0, QUEUE_LIMIT),
    idle,
  };
}
