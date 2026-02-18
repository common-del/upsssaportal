'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export async function getActiveFrameworkForSchool(schoolUdise: string) {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
  });
  if (!framework || framework.status !== 'PUBLISHED') return null;

  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) return null;

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';

  const fullFramework = await prisma.framework.findUnique({
    where: { id: framework.id },
    include: {
      cycle: { select: { id: true, name: true } },
      domains: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          subDomains: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: {
              parameters: {
                where: { isActive: true },
                orderBy: { order: 'asc' },
                include: {
                  options: { where: { isActive: true }, orderBy: { order: 'asc' } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!fullFramework) return null;

  // Filter parameters by applicability
  const filtered = {
    ...fullFramework,
    domains: fullFramework.domains.map((d) => ({
      ...d,
      subDomains: d.subDomains.map((sd) => ({
        ...sd,
        parameters: sd.parameters.filter((p) =>
          (p.applicability as string[]).includes(categoryCode),
        ),
      })).filter((sd) => sd.parameters.length > 0),
    })).filter((d) => d.subDomains.length > 0),
  };

  const totalApplicable = filtered.domains.reduce(
    (sum, d) => sum + d.subDomains.reduce((s2, sd) => s2 + sd.parameters.length, 0),
    0,
  );

  return { framework: filtered, cycleId: cycle.id, cycleName: cycle.name, categoryCode, totalApplicable };
}

export async function getOrCreateSubmission(
  cycleId: string,
  schoolUdise: string,
  frameworkId: string,
) {
  const existing = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    include: { responses: true },
  });
  if (existing) return existing;

  return prisma.selfAssessmentSubmission.create({
    data: { cycleId, schoolUdise, frameworkId, status: 'DRAFT' },
    include: { responses: true },
  });
}

export async function saveResponses(
  submissionId: string,
  schoolUdise: string,
  responses: { parameterId: string; selectedOptionKey: string; notes?: string }[],
): Promise<{ success: boolean; message?: string }> {
  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { success: false, message: 'Submission not found.' };
  if (submission.schoolUdise !== schoolUdise) return { success: false, message: 'Access denied.' };
  if (submission.status === 'SUBMITTED') return { success: false, message: 'Already submitted.' };

  const now = new Date();

  for (const r of responses) {
    if (!r.selectedOptionKey) continue;
    await prisma.selfAssessmentResponse.upsert({
      where: {
        submissionId_parameterId: { submissionId, parameterId: r.parameterId },
      },
      update: {
        selectedOptionKey: r.selectedOptionKey,
        notes: r.notes?.slice(0, 500) ?? null,
      },
      create: {
        submissionId,
        parameterId: r.parameterId,
        selectedOptionKey: r.selectedOptionKey,
        notes: r.notes?.slice(0, 500) ?? null,
      },
    });
  }

  if (!submission.startedAt) {
    await prisma.selfAssessmentSubmission.update({
      where: { id: submissionId },
      data: { startedAt: now },
    });
  }

  revalidatePath('/app/school/self-assessment');
  revalidatePath('/app/school');
  return { success: true };
}

export async function submitSubmission(
  submissionId: string,
  schoolUdise: string,
): Promise<{ success: boolean; errors?: { parameterCode: string; message: string }[]; message?: string }> {
  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      framework: {
        include: {
          parameters: {
            where: { isActive: true },
            select: { id: true, code: true, applicability: true },
          },
        },
      },
    },
  });
  if (!submission) return { success: false, message: 'Submission not found.' };
  if (submission.schoolUdise !== schoolUdise) return { success: false, message: 'Access denied.' };
  if (submission.status === 'SUBMITTED') return { success: false, message: 'Already submitted.' };

  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) return { success: false, message: 'School not found.' };

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';
  const applicableParams = submission.framework.parameters.filter((p) =>
    (p.applicability as string[]).includes(categoryCode),
  );

  const responses = await prisma.selfAssessmentResponse.findMany({
    where: { submissionId },
    select: { parameterId: true },
  });
  const answeredIds = new Set(responses.map((r) => r.parameterId));

  const missing = applicableParams.filter((p) => !answeredIds.has(p.id));
  if (missing.length > 0) {
    return {
      success: false,
      errors: missing.map((p) => ({
        parameterCode: p.code,
        message: 'Response required',
      })),
    };
  }

  await prisma.selfAssessmentSubmission.update({
    where: { id: submissionId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  revalidatePath('/app/school/self-assessment');
  revalidatePath('/app/school');
  return { success: true };
}

export async function getMonitoringStats() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return { totalSchools: 0, started: 0, submitted: 0, cycleName: null };

  const [totalSchools, started, submitted] = await Promise.all([
    prisma.school.count(),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, startedAt: { not: null } } }),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
  ]);

  return { totalSchools, started, submitted, cycleName: cycle.name };
}
