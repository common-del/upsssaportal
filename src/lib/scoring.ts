import { prisma } from '@/lib/db';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export type SchoolScoreResult = {
  scorePercent: number | null;
  answered: number;
  applicable: number;
};

/**
 * Compute self-assessment score % for a batch of schools.
 * Uses domain weights and rubric mappings from the published framework.
 * Returns a map of schoolUdise -> score result.
 */
export async function getBatchSelfAssessmentScores(
  cycleId: string,
  frameworkId: string,
  schoolUdises: string[],
): Promise<Record<string, SchoolScoreResult>> {
  if (schoolUdises.length === 0) return {};

  const [submissions, rubrics, domains, parameters, schools] = await Promise.all([
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId, schoolUdise: { in: schoolUdises } },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.rubricMapping.findMany({
      where: { frameworkId },
      select: { parameterId: true, optionKey: true, score: true },
    }),
    prisma.sqaafDomain.findMany({
      where: { frameworkId, isActive: true },
      select: { id: true, weightPercent: true },
    }),
    prisma.parameter.findMany({
      where: { frameworkId, isActive: true },
      select: { id: true, applicability: true, subDomain: { select: { domainId: true } } },
    }),
    prisma.school.findMany({
      where: { udise: { in: schoolUdises } },
      select: { udise: true, category: true },
    }),
  ]);

  const rubricMap = new Map<string, number>();
  for (const r of rubrics) {
    rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);
  }

  const domainWeightMap = new Map<string, number>();
  for (const d of domains) {
    domainWeightMap.set(d.id, d.weightPercent ?? 0);
  }

  const schoolCategoryMap = new Map<string, string>();
  for (const s of schools) {
    schoolCategoryMap.set(s.udise, CATEGORY_TO_CODE[s.category] ?? 'PRIMARY');
  }

  const submissionMap = new Map<string, typeof submissions[0]>();
  for (const sub of submissions) {
    submissionMap.set(sub.schoolUdise, sub);
  }

  const results: Record<string, SchoolScoreResult> = {};

  for (const udise of schoolUdises) {
    const catCode = schoolCategoryMap.get(udise) ?? 'PRIMARY';
    const sub = submissionMap.get(udise);

    const applicableParams = parameters.filter(
      (p) => (p.applicability as string[]).includes(catCode),
    );

    if (!sub || applicableParams.length === 0) {
      results[udise] = { scorePercent: null, answered: 0, applicable: applicableParams.length };
      continue;
    }

    const responseMap = new Map<string, string>();
    for (const r of sub.responses) {
      responseMap.set(r.parameterId, r.selectedOptionKey);
    }

    const answered = applicableParams.filter((p) => responseMap.has(p.id)).length;

    // Group applicable params by domain
    const domainGroups = new Map<string, { achieved: number; possible: number }>();
    for (const p of applicableParams) {
      const domainId = p.subDomain.domainId;
      if (!domainGroups.has(domainId)) domainGroups.set(domainId, { achieved: 0, possible: 0 });
      const group = domainGroups.get(domainId)!;

      const maxScore = Math.max(
        rubricMap.get(`${p.id}:LEVEL_1`) ?? 0,
        rubricMap.get(`${p.id}:LEVEL_2`) ?? 0,
        rubricMap.get(`${p.id}:LEVEL_3`) ?? 0,
      );
      group.possible += maxScore;

      const selectedKey = responseMap.get(p.id);
      if (selectedKey) {
        group.achieved += rubricMap.get(`${p.id}:${selectedKey}`) ?? 0;
      }
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (const [domainId, group] of domainGroups) {
      const weight = domainWeightMap.get(domainId) ?? 0;
      if (weight > 0 && group.possible > 0) {
        weightedSum += (group.achieved / group.possible) * weight;
        totalWeight += weight;
      }
    }

    const scorePercent = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : null;
    results[udise] = { scorePercent, answered, applicable: applicableParams.length };
  }

  return results;
}

/**
 * Compute verification score % for a batch of schools.
 * Same formula as self-assessment but reads from VerificationResponse.
 */
export async function getBatchVerificationScores(
  cycleId: string,
  frameworkId: string,
  schoolUdises: string[],
): Promise<Record<string, SchoolScoreResult>> {
  if (schoolUdises.length === 0) return {};

  const [submissions, rubrics, domains, parameters, schools] = await Promise.all([
    prisma.verificationSubmission.findMany({
      where: { cycleId, schoolUdise: { in: schoolUdises } },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.rubricMapping.findMany({
      where: { frameworkId },
      select: { parameterId: true, optionKey: true, score: true },
    }),
    prisma.sqaafDomain.findMany({
      where: { frameworkId, isActive: true },
      select: { id: true, weightPercent: true },
    }),
    prisma.parameter.findMany({
      where: { frameworkId, isActive: true },
      select: { id: true, applicability: true, subDomain: { select: { domainId: true } } },
    }),
    prisma.school.findMany({
      where: { udise: { in: schoolUdises } },
      select: { udise: true, category: true },
    }),
  ]);

  const rubricMap = new Map<string, number>();
  for (const r of rubrics) rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);

  const domainWeightMap = new Map<string, number>();
  for (const d of domains) domainWeightMap.set(d.id, d.weightPercent ?? 0);

  const schoolCategoryMap = new Map<string, string>();
  for (const s of schools) schoolCategoryMap.set(s.udise, CATEGORY_TO_CODE[s.category] ?? 'PRIMARY');

  const submissionMap = new Map<string, typeof submissions[0]>();
  for (const sub of submissions) submissionMap.set(sub.schoolUdise, sub);

  const results: Record<string, SchoolScoreResult> = {};

  for (const udise of schoolUdises) {
    const catCode = schoolCategoryMap.get(udise) ?? 'PRIMARY';
    const sub = submissionMap.get(udise);
    const applicableParams = parameters.filter((p) => (p.applicability as string[]).includes(catCode));

    if (!sub || applicableParams.length === 0) {
      results[udise] = { scorePercent: null, answered: 0, applicable: applicableParams.length };
      continue;
    }

    const responseMap = new Map<string, string>();
    for (const r of sub.responses) responseMap.set(r.parameterId, r.selectedOptionKey);

    const answered = applicableParams.filter((p) => responseMap.has(p.id)).length;

    const domainGroups = new Map<string, { achieved: number; possible: number }>();
    for (const p of applicableParams) {
      const domainId = p.subDomain.domainId;
      if (!domainGroups.has(domainId)) domainGroups.set(domainId, { achieved: 0, possible: 0 });
      const group = domainGroups.get(domainId)!;
      const maxScore = Math.max(
        rubricMap.get(`${p.id}:LEVEL_1`) ?? 0,
        rubricMap.get(`${p.id}:LEVEL_2`) ?? 0,
        rubricMap.get(`${p.id}:LEVEL_3`) ?? 0,
      );
      group.possible += maxScore;
      const selectedKey = responseMap.get(p.id);
      if (selectedKey) group.achieved += rubricMap.get(`${p.id}:${selectedKey}`) ?? 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (const [domainId, group] of domainGroups) {
      const weight = domainWeightMap.get(domainId) ?? 0;
      if (weight > 0 && group.possible > 0) {
        weightedSum += (group.achieved / group.possible) * weight;
        totalWeight += weight;
      }
    }

    const scorePercent = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : null;
    results[udise] = { scorePercent, answered, applicable: applicableParams.length };
  }

  return results;
}
