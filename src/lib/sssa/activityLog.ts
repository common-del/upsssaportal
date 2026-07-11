import { prisma } from '@/lib/db';

export type ActivityCategory = 'Self Evaluation' | 'External Evaluation' | 'Dispute Resolution';

export type ActivityItem = {
  id: string;
  category: ActivityCategory;
  title: string;
  actor: string;
  context: string;
  description: string;
  createdAt: Date;
};

const DISPUTE_EVENT_TITLES: Record<string, string> = {
  CREATED: 'Dispute Raised',
  ESCALATED: 'Dispute Escalated',
  SCHOOL_RESPONDED: 'School Responded',
  NOTE: 'Note Added',
  RESOLVED: 'Dispute Resolved',
  REJECTED: 'Dispute Rejected',
};

export async function buildActivityLog(limit = 30) {
  const [selfEval, verifications, timeline] = await Promise.all([
    prisma.selfAssessmentSubmission.findMany({
      where: { OR: [{ submittedAt: { not: null } }, { startedAt: { not: null } }] },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { school: { select: { nameEn: true } }, cycle: { select: { name: true } } },
    }),
    prisma.verificationSubmission.findMany({
      where: { submittedAt: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        school: { select: { nameEn: true } },
        verifier: { select: { username: true } },
        cycle: { select: { name: true } },
      },
    }),
    prisma.ticketTimeline.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { ticket: { select: { school: { select: { nameEn: true } } } } },
    }),
  ]);

  const selfItems: ActivityItem[] = selfEval.map((s) => ({
    id: s.id,
    category: 'Self Evaluation',
    title: s.status === 'SUBMITTED' ? 'Submitted Self-Assessment' : 'Saved Draft',
    actor: s.school.nameEn,
    context: s.school.nameEn,
    description: `Self-assessment for Cycle ${s.cycle.name} ${s.status === 'SUBMITTED' ? 'submitted' : 'draft saved'}`,
    createdAt: s.submittedAt ?? s.updatedAt,
  }));

  const externalItems: ActivityItem[] = verifications.map((v) => ({
    id: v.id,
    category: 'External Evaluation',
    title: 'Submitted Verification',
    actor: v.verifier.username,
    context: v.school.nameEn,
    description: `Verification for Cycle ${v.cycle.name} submitted for ${v.school.nameEn}`,
    createdAt: v.submittedAt ?? v.updatedAt,
  }));

  const disputeItems: ActivityItem[] = timeline.map((t) => ({
    id: t.id,
    category: 'Dispute Resolution',
    title: DISPUTE_EVENT_TITLES[t.eventType] ?? 'Dispute Update',
    actor: t.actorRole ?? t.actorType,
    context: t.ticket.school.nameEn,
    description: t.message,
    createdAt: t.createdAt,
  }));

  const all = [...selfItems, ...externalItems, ...disputeItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    counts: {
      selfEvaluation: selfItems.length,
      externalEvaluation: externalItems.length,
      disputeResolution: disputeItems.length,
    },
    items: all.slice(0, limit),
  };
}
