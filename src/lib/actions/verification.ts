'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export async function assignVerifiersForCycle({
  cycleId,
  districtCodes,
  deadlineAt,
  ignoreDistrictMapping,
}: {
  cycleId: string;
  districtCodes?: string[];
  deadlineAt?: string;
  ignoreDistrictMapping?: boolean;
}): Promise<{ assigned: number; skipped: number; error?: string }> {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return { assigned: 0, skipped: 0, error: 'Cycle not found.' };

  const schoolWhere: { districtCode?: { in: string[] } } = {};
  if (districtCodes && districtCodes.length > 0) {
    schoolWhere.districtCode = { in: districtCodes };
  }

  const schools = await prisma.school.findMany({
    where: schoolWhere,
    select: { udise: true, districtCode: true },
  });

  const existing = await prisma.verifierAssignment.findMany({
    where: { cycleId },
    select: { schoolUdise: true },
  });
  const existingSet = new Set(existing.map((a) => a.schoolUdise));

  const unassigned = schools.filter((s) => !existingSet.has(s.udise));
  if (unassigned.length === 0) return { assigned: 0, skipped: schools.length };

  const verifiers = await prisma.user.findMany({
    where: { role: 'VERIFIER', active: true },
    select: { id: true, verifierCapacity: true },
  });
  if (verifiers.length === 0) return { assigned: 0, skipped: 0, error: 'No active verifiers found.' };

  // Build district mapping: verifierId -> set of allowed district codes
  let verifierDistrictMap: Map<string, Set<string>> | null = null;
  if (!ignoreDistrictMapping) {
    const vds = await prisma.verifierDistrict.findMany({
      select: { verifierUserId: true, districtCode: true },
    });
    verifierDistrictMap = new Map();
    for (const vd of vds) {
      if (!verifierDistrictMap.has(vd.verifierUserId)) verifierDistrictMap.set(vd.verifierUserId, new Set());
      verifierDistrictMap.get(vd.verifierUserId)!.add(vd.districtCode);
    }
  }

  const assignmentCounts = await prisma.verifierAssignment.groupBy({
    by: ['verifierUserId'],
    where: { cycleId },
    _count: { _all: true },
  });
  const countMap = new Map(assignmentCounts.map((a) => [a.verifierUserId, a._count._all]));

  const deadline = deadlineAt ? new Date(deadlineAt) : null;
  let assigned = 0;

  for (const school of unassigned) {
    let bestVerifier: string | null = null;
    let bestRemaining = -1;

    for (const v of verifiers) {
      // District mapping filter
      if (verifierDistrictMap) {
        const allowed = verifierDistrictMap.get(v.id);
        if (!allowed || !allowed.has(school.districtCode)) continue;
      }

      const current = countMap.get(v.id) ?? 0;
      const capacity = v.verifierCapacity ?? 50;
      const remaining = capacity - current;
      if (remaining <= 0) continue;
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestVerifier = v.id;
      }
    }

    if (!bestVerifier) continue;

    await prisma.verifierAssignment.create({
      data: {
        cycleId,
        schoolUdise: school.udise,
        verifierUserId: bestVerifier,
        deadlineAt: deadline,
      },
    });

    countMap.set(bestVerifier, (countMap.get(bestVerifier) ?? 0) + 1);
    assigned++;
  }

  revalidatePath('/app/sssa/verification/assign');
  return { assigned, skipped: schools.length - unassigned.length };
}

export async function reassignVerifier(assignmentId: string, newVerifierUserId: string) {
  await prisma.verifierAssignment.update({
    where: { id: assignmentId },
    data: { verifierUserId: newVerifierUserId },
  });
  revalidatePath('/app/sssa/verification/assign');
}

export async function getVerifierAssignments(verifierUserId: string) {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return { assignments: [], cycleName: null };

  const assignments = await prisma.verifierAssignment.findMany({
    where: { cycleId: cycle.id, verifierUserId },
    include: {
      school: { select: { udise: true, nameEn: true, nameHi: true, category: true, districtCode: true, blockCode: true } },
      submission: { select: { status: true, startedAt: true, submittedAt: true } },
    },
    orderBy: { school: { nameEn: 'asc' } },
  });

  return { assignments, cycleName: cycle.name, cycleId: cycle.id };
}

export async function getActiveFrameworkForVerification(schoolUdise: string) {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return null;

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
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
                include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
              },
            },
          },
        },
      },
    },
  });
  if (!fullFramework) return null;

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

export async function getOrCreateVerificationSubmission(
  assignmentId: string,
  cycleId: string,
  schoolUdise: string,
  frameworkId: string,
  verifierUserId: string,
) {
  const existing = await prisma.verificationSubmission.findUnique({
    where: { assignmentId },
    include: { responses: true },
  });
  if (existing) return existing;

  return prisma.verificationSubmission.create({
    data: { cycleId, schoolUdise, frameworkId, assignmentId, verifierUserId, status: 'DRAFT' },
    include: { responses: true },
  });
}

export async function saveVerificationResponses(
  submissionId: string,
  verifierUserId: string,
  responses: { parameterId: string; selectedOptionKey: string; notes?: string }[],
): Promise<{ success: boolean; message?: string }> {
  const submission = await prisma.verificationSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return { success: false, message: 'Submission not found.' };
  if (submission.verifierUserId !== verifierUserId) return { success: false, message: 'Access denied.' };
  if (submission.status === 'SUBMITTED') return { success: false, message: 'Already submitted.' };

  for (const r of responses) {
    if (!r.selectedOptionKey) continue;
    await prisma.verificationResponse.upsert({
      where: { submissionId_parameterId: { submissionId, parameterId: r.parameterId } },
      update: { selectedOptionKey: r.selectedOptionKey, notes: r.notes?.slice(0, 500) ?? null },
      create: { submissionId, parameterId: r.parameterId, selectedOptionKey: r.selectedOptionKey, notes: r.notes?.slice(0, 500) ?? null },
    });
  }

  if (!submission.startedAt) {
    await prisma.verificationSubmission.update({ where: { id: submissionId }, data: { startedAt: new Date() } });
  }

  revalidatePath('/app/verifier');
  return { success: true };
}

export async function submitVerification(
  submissionId: string,
  verifierUserId: string,
): Promise<{ success: boolean; errors?: { parameterCode: string; message: string }[]; message?: string }> {
  const submission = await prisma.verificationSubmission.findUnique({
    where: { id: submissionId },
    include: { framework: { include: { parameters: { where: { isActive: true }, select: { id: true, code: true, applicability: true, evidenceRequired: true } } } } },
  });
  if (!submission) return { success: false, message: 'Submission not found.' };
  if (submission.verifierUserId !== verifierUserId) return { success: false, message: 'Access denied.' };
  if (submission.status === 'SUBMITTED') return { success: false, message: 'Already submitted.' };

  const school = await prisma.school.findUnique({ where: { udise: submission.schoolUdise }, select: { category: true } });
  if (!school) return { success: false, message: 'School not found.' };

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';
  const applicableParams = submission.framework.parameters.filter((p) =>
    (p.applicability as string[]).includes(categoryCode),
  );

  const responses = await prisma.verificationResponse.findMany({
    where: { submissionId },
    select: { parameterId: true },
  });
  const answeredIds = new Set(responses.map((r) => r.parameterId));

  const errors: { parameterCode: string; message: string }[] = [];
  const missing = applicableParams.filter((p) => !answeredIds.has(p.id));
  for (const p of missing) errors.push({ parameterCode: p.code, message: 'Response required' });

  const evidenceRequired = applicableParams.filter((p) => p.evidenceRequired);
  if (evidenceRequired.length > 0) {
    const evidenceLinks = await prisma.evidenceLink.findMany({
      where: { kind: 'VERIFICATION_RESPONSE', vSubmissionId: submissionId },
      select: { parameterId: true },
    });
    const hasEvidence = new Set(evidenceLinks.map((l) => l.parameterId));
    for (const p of evidenceRequired) {
      if (!hasEvidence.has(p.id)) errors.push({ parameterCode: p.code, message: 'Evidence required' });
    }
  }

  if (errors.length > 0) return { success: false, errors };

  await prisma.verificationSubmission.update({
    where: { id: submissionId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  revalidatePath('/app/verifier');
  return { success: true };
}
