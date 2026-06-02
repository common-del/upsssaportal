import { prisma } from '@/lib/db';
import {
  assessmentStatusLabel,
  isFeeDisclosureEligible,
  isGovernmentSchool,
  mandatoryDocTypesForSchool,
  type AssessmentStatus,
} from '@/lib/school/helpers';
import { ensureMandatoryDocuments, getAssessmentStatus } from '@/lib/actions/schoolPortal';

export type PendingTask = { text: string; dotColor: string };

export type DashboardData = {
  school: {
    nameEn: string;
    udise: string;
    category: string;
    location: string;
  };
  showFeeDisclosure: boolean;
  assessmentStatus: AssessmentStatus;
  cycle: { name: string; deadline: string | null; completionPct: number } | null;
  pendingTasks: PendingTask[];
  docsUploaded: number;
  docsTotal: number;
  evidenceLinked: number;
  evidenceRequired: number;
  notifications: { id: string; title: string; body: string; createdAt: string; read: boolean }[];
  unreadCount: number;
};

export async function getSchoolDashboardData(
  schoolUdise: string,
  userId: string,
): Promise<DashboardData | null> {
  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: {
      nameEn: true,
      udise: true,
      category: true,
      block: { select: { nameEn: true } },
      district: { select: { nameEn: true } },
    },
  });
  if (!school) return null;

  await ensureMandatoryDocuments(schoolUdise, school.category);

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const framework = cycle
    ? await prisma.framework.findUnique({ where: { cycleId: cycle.id }, select: { id: true } })
    : null;

  const [assessmentStatus, saSubmission, mandatoryDocs, notifications, unreadCount] =
    await Promise.all([
      getAssessmentStatus(schoolUdise),
      cycle
        ? prisma.selfAssessmentSubmission.findUnique({
            where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
            include: { _count: { select: { responses: true } } },
          })
        : null,
      prisma.mandatoryDocument.findMany({ where: { schoolUdise } }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

  const evidenceLinks = saSubmission
    ? await prisma.evidenceLink.findMany({
        where: { kind: 'SELF_RESPONSE', saSubmissionId: saSubmission.id },
        select: { parameterId: true },
      })
    : [];

  let totalApplicable = 0;
  if (framework) {
    totalApplicable = await prisma.parameter.count({
      where: { frameworkId: framework.id, isActive: true },
    });
  }

  const answered = saSubmission?._count.responses ?? 0;
  const completionPct =
    totalApplicable > 0 ? Math.round((answered / totalApplicable) * 100) : 0;

  const docsTotal = mandatoryDocTypesForSchool(school.category).length;
  const docsUploaded = mandatoryDocs.filter(
    (d) => d.status === 'UPLOADED' || d.status === 'ACKNOWLEDGED',
  ).length;

  const evidenceRequired = totalApplicable;
  const evidenceLinked = new Set(evidenceLinks.map((e) => e.parameterId).filter(Boolean)).size;

  const pendingTasks: PendingTask[] = [];
  for (const doc of mandatoryDocs) {
    if (doc.status === 'EXPIRED') {
      pendingTasks.push({ text: `Upload ${doc.documentType} (Expired)`, dotColor: 'bg-red-500' });
    } else if (doc.status === 'NOT_UPLOADED') {
      pendingTasks.push({ text: `Upload ${doc.documentType}`, dotColor: 'bg-amber-500' });
    }
  }

  if (framework && saSubmission && saSubmission.status !== 'SUBMITTED') {
    const domains = await prisma.sqaafDomain.findMany({
      where: { frameworkId: framework.id, isActive: true },
      orderBy: { order: 'asc' },
      select: {
        order: true,
        titleEn: true,
        subDomains: {
          select: {
            parameters: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    });

    const answeredIds = new Set(
      (
        await prisma.selfAssessmentResponse.findMany({
          where: { submissionId: saSubmission.id },
          select: { parameterId: true },
        })
      ).map((r) => r.parameterId),
    );

    for (const domain of domains) {
      const params = domain.subDomains.flatMap((sd) => sd.parameters);
      const missing = params.some((p) => !answeredIds.has(p.id));
      if (missing) {
        pendingTasks.push({
          text: `Complete Domain ${domain.order} self-rating`,
          dotColor: 'bg-blue-500',
        });
        break;
      }
    }
  }

  const verification = cycle
    ? await prisma.verificationSubmission.findFirst({
        where: { cycleId: cycle.id, schoolUdise },
        include: {
          responses: {
            where: { notes: { not: null } },
            take: 1,
            include: {
              parameter: {
                select: {
                  subDomain: {
                    select: {
                      domain: { select: { order: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  if (verification?.responses.some((r) => r.notes)) {
    const domainOrder = verification.responses[0]?.parameter.subDomain.domain.order ?? 5;
    pendingTasks.push({
      text: `Acknowledge evaluator clarification on Domain ${domainOrder}`,
      dotColor: 'bg-purple-500',
    });
  }

  if (pendingTasks.length === 0) {
    pendingTasks.push({ text: 'No pending tasks — you are up to date', dotColor: 'bg-green-500' });
  }

  return {
    school: {
      nameEn: school.nameEn,
      udise: school.udise,
      category: school.category,
      location: [school.block?.nameEn, school.district?.nameEn].filter(Boolean).join(', '),
    },
    showFeeDisclosure: isFeeDisclosureEligible(school.category),
    assessmentStatus,
    cycle: cycle
      ? {
          name: cycle.name,
          deadline: cycle.endsAt?.toLocaleDateString('en-IN') ?? null,
          completionPct,
        }
      : null,
    pendingTasks: pendingTasks.slice(0, 5),
    docsUploaded,
    docsTotal,
    evidenceLinked,
    evidenceRequired,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toLocaleString('en-IN'),
      read: n.read,
    })),
    unreadCount,
  };
}

export { assessmentStatusLabel, isGovernmentSchool };
