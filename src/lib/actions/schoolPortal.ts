'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ScholarshipScheme } from '@prisma/client';
import {
  isFeeDisclosureEligible,
  mandatoryDocTypesForSchool,
  SCHOLARSHIP_SCHEMES,
  type AssessmentStatus,
} from '@/lib/school/helpers';

async function requireSchoolSession() {
  const session = await auth();
  if (!session || session.user.role !== 'SCHOOL') return null;
  const schoolUdise = session.user.name!;
  return { session, schoolUdise, userId: session.user.id! };
}

export async function ensureMandatoryDocuments(schoolUdise: string, category: string) {
  const types = mandatoryDocTypesForSchool(category);
  for (const documentType of types) {
    await prisma.mandatoryDocument.upsert({
      where: { schoolUdise_documentType: { schoolUdise, documentType } },
      create: { schoolUdise, documentType, status: 'NOT_UPLOADED' },
      update: {},
    });
  }
}

export async function getAssessmentStatus(schoolUdise: string): Promise<AssessmentStatus> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return 'NOT_STARTED';

  const [sa, verification, result] = await Promise.all([
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    }),
    prisma.verificationSubmission.findFirst({
      where: { cycleId: cycle.id, schoolUdise },
    }),
    prisma.result.findUnique({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    }),
  ]);

  if (result?.verifierScorePercent != null || result?.finalScorePercent != null) return 'VERIFIED';
  if (verification?.status === 'SUBMITTED') return 'UNDER_REVIEW';
  if (verification || sa?.status === 'SUBMITTED') return 'UNDER_REVIEW';
  if (sa?.status === 'SUBMITTED') return 'SUBMITTED';
  if (sa?.startedAt || sa?.status === 'DRAFT') return 'IN_DRAFT';
  return 'NOT_STARTED';
}

export async function saveFeeDisclosure(data: {
  annualTuition: number;
  admissionFee: number;
  transportFee: number;
  otherCharges: number;
  scholarshipsSummary: string;
  scholarships: Record<ScholarshipScheme, boolean>;
}) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  const school = await prisma.school.findUnique({
    where: { udise: ctx.schoolUdise },
    select: { category: true },
  });
  if (!school || !isFeeDisclosureEligible(school.category)) {
    return { error: 'Fee disclosure not applicable' };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.feeDisclosure.upsert({
      where: { schoolUdise: ctx.schoolUdise },
      create: {
        schoolUdise: ctx.schoolUdise,
        annualTuition: data.annualTuition,
        admissionFee: data.admissionFee,
        transportFee: data.transportFee,
        otherCharges: data.otherCharges,
        scholarshipsSummary: data.scholarshipsSummary || null,
        lastUpdated: now,
      },
      update: {
        annualTuition: data.annualTuition,
        admissionFee: data.admissionFee,
        transportFee: data.transportFee,
        otherCharges: data.otherCharges,
        scholarshipsSummary: data.scholarshipsSummary || null,
        lastUpdated: now,
      },
    }),
    ...SCHOLARSHIP_SCHEMES.map((scheme) =>
      prisma.schoolScholarship.upsert({
        where: { schoolUdise_scheme: { schoolUdise: ctx.schoolUdise, scheme } },
        create: {
          schoolUdise: ctx.schoolUdise,
          scheme,
          available: data.scholarships[scheme] ?? false,
        },
        update: { available: data.scholarships[scheme] ?? false },
      }),
    ),
  ]);

  revalidatePath('/app/school/fee-disclosure');
  return { success: true };
}

export async function uploadMandatoryDocument(
  documentId: string,
  fileName: string,
) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  const doc = await prisma.mandatoryDocument.findFirst({
    where: { id: documentId, schoolUdise: ctx.schoolUdise },
  });
  if (!doc) return { error: 'Document not found' };

  const now = new Date();
  const validTill = new Date(now);
  validTill.setFullYear(validTill.getFullYear() + 1);

  // TODO: integrate Vercel Blob for actual file storage.
  await prisma.mandatoryDocument.update({
    where: { id: documentId },
    data: {
      fileUrl: `stub://${fileName}`,
      uploadedAt: now,
      validTill,
      status: 'UPLOADED',
    },
  });

  revalidatePath('/app/school/documents');
  return { success: true };
}

export async function stubUploadEvidence(data: {
  parameterId: string;
  fileName: string;
  saSubmissionId: string;
}) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  // TODO: integrate Vercel Blob for actual file storage.
  const asset = await prisma.evidenceAsset.create({
    data: {
      blobUrl: `stub://${data.fileName}`,
      fileName: data.fileName,
      fileType: 'application/pdf',
      fileSize: 0,
      uploadedByUserId: ctx.userId,
    },
  });

  await prisma.evidenceLink.create({
    data: {
      assetId: asset.id,
      kind: 'SELF_RESPONSE',
      saSubmissionId: data.saSubmissionId,
      parameterId: data.parameterId,
    },
  });

  revalidatePath('/app/school/evidence');
  revalidatePath('/app/school/sqaaf');
  return { success: true, id: asset.id };
}

export async function deleteStubEvidence(assetId: string) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  const asset = await prisma.evidenceAsset.findUnique({
    where: { id: assetId },
    include: { links: { include: { saSubmission: true } } },
  });
  if (!asset || asset.uploadedByUserId !== ctx.userId) return { error: 'Not found' };
  if (asset.links?.saSubmission?.schoolUdise !== ctx.schoolUdise) return { error: 'Forbidden' };

  await prisma.evidenceAsset.delete({ where: { id: assetId } });
  revalidatePath('/app/school/evidence');
  return { success: true };
}

export async function markNotificationRead(notificationId: string) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: ctx.userId },
    data: { read: true },
  });
  revalidatePath('/app/school/notifications');
  revalidatePath('/app/school');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.notification.updateMany({
    where: { userId: ctx.userId, read: false },
    data: { read: true },
  });
  revalidatePath('/app/school/notifications');
  revalidatePath('/app/school');
  return { success: true };
}

export async function saveNotificationPreferences(data: {
  emailAlerts: boolean;
  smsAlerts: boolean;
  disputeAlerts: boolean;
  cycleReminders: boolean;
}) {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.notificationPreference.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, ...data },
    update: data,
  });
  revalidatePath('/app/school/settings');
  return { success: true };
}

export async function savePreferredLocale(locale: 'en' | 'hi') {
  const ctx = await requireSchoolSession();
  if (!ctx) return { error: 'Unauthorized' };

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { preferredLocale: locale },
  });
  return { success: true };
}

export async function createDefaultMandatoryDocsForSchool(schoolUdise: string, category: string) {
  await ensureMandatoryDocuments(schoolUdise, category);
}
