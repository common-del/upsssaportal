import { prisma } from '@/lib/db';
import {
  assessmentStatusLabel,
  isFeeDisclosureEligible,
  isGovernmentSchool,
  mandatoryDocTypesForSchool,
  type AssessmentStatus,
} from '@/lib/school/helpers';
import { ensureMandatoryDocuments, getAssessmentStatus } from '@/lib/actions/schoolPortal';
import { getSchoolProfileStatus, PROFILE_STATUS_LABEL } from '@/lib/school/profileStatus';

export type PendingTask = { text: string; dotColor: string };

/**
 * Where the school stands, which its own dashboard did not say.
 *
 * A parent could read this school's score and level on the public profile and SSSA
 * could read all three columns, while the school's home page showed document counts
 * and a progress bar. `bandChanged` is the reason this is here at all: a school that
 * dropped a level on a verifier's judgement should meet that fact on the page it
 * lands on, with the appeal route beside it, rather than discovering it later.
 */
export type ScoreSummary = {
  selfPercent: number | null;
  selfBand: string | null;
  verifiedPercent: number | null;
  verifiedBand: string | null;
  /** Null until a verifier has submitted. */
  verifiedOn: string | null;
  /** Verified minus self, negative when the verifier marked the school down. */
  delta: number | null;
  /** True when self and verified fall in different bands. */
  bandChanged: boolean;
  /** Indicators where the verifier's answer differs from the school's. */
  disputedCount: number;
};

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
  scores: ScoreSummary;
  /** Complaints filed about this school that it has not answered. */
  openComplaints: number;
  /** Profile completeness, by the same rules the officials' Compliance page uses. */
  profile: {
    status: string;
    label: string;
    done: number;
    total: number;
    missingLabels: string[];
  };
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

  // Scores, bands and the two counts the dashboard was missing. Grade bands come from
  // the framework rather than hardcoded thresholds — the published table is
  // Uday/Unnat/Utkarsh and it has been changed once already.
  const [result, gradeBands, openComplaints, disputedCount] = await Promise.all([
    cycle
      ? prisma.result.findUnique({
          where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
          select: { selfScorePercent: true, verifierScorePercent: true },
        })
      : null,
    framework
      ? prisma.gradeBand.findMany({
          where: { frameworkId: framework.id },
          select: { labelEn: true, minPercent: true, maxPercent: true },
          orderBy: { order: 'asc' },
        })
      : [],
    prisma.ticket.count({
      where: { schoolUdise, status: { notIn: ['RESOLVED', 'REJECTED'] } },
    }),
    // Indicators where the verifier chose a different option from the school. This is
    // what an appeal is argued over, so the count belongs beside the score.
    verification && saSubmission
      ? countDisputedIndicators(saSubmission.id, verification.id)
      : 0,
  ]);

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

  const selfPercent = result?.selfScorePercent ?? null;
  const verifiedPercent = result?.verifierScorePercent ?? null;
  const selfBand = bandFor(selfPercent);
  const verifiedBand = bandFor(verifiedPercent);

  const scores: ScoreSummary = {
    selfPercent,
    selfBand,
    verifiedPercent,
    verifiedBand,
    verifiedOn:
      verification?.status === 'SUBMITTED'
        ? (verification.submittedAt ?? verification.updatedAt)?.toLocaleDateString('en-IN') ?? null
        : null,
    delta:
      selfPercent != null && verifiedPercent != null
        ? Math.round((verifiedPercent - selfPercent) * 10) / 10
        : null,
    // Both bands must exist. A school with no verification has not changed band, it
    // simply has not been checked.
    bandChanged: selfBand != null && verifiedBand != null && selfBand !== verifiedBand,
    disputedCount,
  };

  if (openComplaints > 0) {
    pendingTasks.unshift({
      text: `Answer ${openComplaints} open ${openComplaints === 1 ? 'complaint' : 'complaints'}`,
      dotColor: 'bg-red-500',
    });
  }

  if (pendingTasks.length === 0) {
    pendingTasks.push({ text: 'No pending tasks — you are up to date', dotColor: 'bg-green-500' });
  }

  const profileStatus = await getSchoolProfileStatus(schoolUdise);

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
    scores,
    openComplaints,
    profile: {
      status: profileStatus?.status ?? 'EMPTY',
      label: PROFILE_STATUS_LABEL[profileStatus?.status ?? 'EMPTY'],
      done: profileStatus?.done ?? 0,
      total: profileStatus?.total ?? 4,
      missingLabels:
        profileStatus?.parts.filter((p) => !p.done).map((p) => p.label.toLowerCase()) ?? [],
    },
  };
}

/**
 * How many indicators the verifier answered differently from the school.
 *
 * Compares selected options rather than scores: two options can carry the same weight
 * on a parameter, and a school arguing an appeal is arguing about the answer, not the
 * arithmetic. Only counts parameters the school actually answered — a verifier filling
 * a gap the school left blank is not a disagreement.
 */
async function countDisputedIndicators(
  saSubmissionId: string,
  vSubmissionId: string,
): Promise<number> {
  const [selfResponses, verifierResponses] = await Promise.all([
    prisma.selfAssessmentResponse.findMany({
      where: { submissionId: saSubmissionId },
      select: { parameterId: true, selectedOptionKey: true },
    }),
    prisma.verificationResponse.findMany({
      where: { submissionId: vSubmissionId },
      select: { parameterId: true, selectedOptionKey: true },
    }),
  ]);

  const selfBy = new Map(selfResponses.map((r) => [r.parameterId, r.selectedOptionKey]));
  let disputed = 0;
  for (const v of verifierResponses) {
    const own = selfBy.get(v.parameterId);
    if (own != null && own !== v.selectedOptionKey) disputed++;
  }
  return disputed;
}

export { assessmentStatusLabel, isGovernmentSchool };
