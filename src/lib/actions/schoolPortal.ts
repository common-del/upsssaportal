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


export async function createDefaultMandatoryDocsForSchool(schoolUdise: string, category: string) {
  await ensureMandatoryDocuments(schoolUdise, category);
}

/**
 * Saves the school's public contact details.
 *
 * The first write to School.addressEn and School.publicPhone anywhere in the
 * application. Both fields have existed since the schema was written and only seed
 * scripts ever set them — by row number, `i % 2` for address and `i % 3` for phone —
 * while the officials' Compliance page marked schools Pending for leaving them blank.
 *
 * Scoped to the signed-in school's own UDISE, never a value from the form. A school
 * editing its own profile has no business naming which school that is.
 */
export async function saveSchoolProfile(input: {
  addressEn: string;
  addressHi: string;
  publicPhone: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireSchoolSession();
  if (!ctx) return { ok: false, error: 'Not signed in as a school.' };

  const addressEn = input.addressEn.trim();
  const addressHi = input.addressHi.trim();
  const publicPhone = input.publicPhone.trim();

  // Deliberately loose: Indian public numbers are written as +91 XXXXX XXXXX, with
  // STD codes, with hyphens, and schools often list a landline and a mobile. Rejecting
  // anything but ten digits would turn a real number into an error message. Only
  // obvious nonsense is refused.
  if (publicPhone && !/^[\d\s+()-]{6,24}$/.test(publicPhone)) {
    return { ok: false, error: 'That does not look like a phone number.' };
  }
  if (addressEn.length > 300 || addressHi.length > 300) {
    return { ok: false, error: 'Address is too long.' };
  }

  // Empty means not supplied, so it is stored as null rather than an empty string —
  // the completeness check reads "has an address", and "" is not one.
  await prisma.school.update({
    where: { udise: ctx.schoolUdise },
    data: {
      addressEn: addressEn || null,
      addressHi: addressHi || null,
      publicPhone: publicPhone || null,
    },
  });

  revalidatePath('/app/school/profile');
  revalidatePath('/app/school');
  revalidatePath(`/public/schools/${ctx.schoolUdise}`);

  return { ok: true };
}
