'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const APPEAL_WINDOW_DAYS = 5;
const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

// ─── Appeal Eligibility ───

export async function getAppealEligibility(cycleId: string, schoolUdise: string) {
  const vSub = await prisma.verificationSubmission.findFirst({
    where: { cycleId, schoolUdise, status: 'SUBMITTED' },
    select: { submittedAt: true },
  });
  if (!vSub || !vSub.submittedAt) return { eligible: false as const, reason: 'no_verification' as const };

  const deadline = new Date(vSub.submittedAt.getTime() + APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const expired = now > deadline;

  const existing = await prisma.appeal.findUnique({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    select: { id: true, status: true },
  });

  return {
    eligible: !expired || !!existing,
    expired,
    deadline,
    verifierSubmittedAt: vSub.submittedAt,
    existingAppeal: existing,
  };
}

// ─── Get Differing Parameters ───

export async function getDifferingParameters(cycleId: string, schoolUdise: string, frameworkId: string) {
  const school = await prisma.school.findUnique({ where: { udise: schoolUdise }, select: { category: true } });
  const catCode = CATEGORY_TO_CODE[school?.category ?? 'Primary'] ?? 'PRIMARY';

  const [saSubmission, vSubmission, parameters] = await Promise.all([
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.verificationSubmission.findFirst({
      where: { cycleId, schoolUdise, status: 'SUBMITTED' },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.parameter.findMany({
      where: { frameworkId, isActive: true },
      select: {
        id: true, code: true, titleEn: true, titleHi: true, applicability: true,
        options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { key: true, labelEn: true, labelHi: true } },
        subDomain: { select: { domain: { select: { titleEn: true, titleHi: true } } } },
      },
    }),
  ]);

  const saMap = new Map<string, string>();
  if (saSubmission) for (const r of saSubmission.responses) saMap.set(r.parameterId, r.selectedOptionKey);

  const vMap = new Map<string, string>();
  if (vSubmission) for (const r of vSubmission.responses) vMap.set(r.parameterId, r.selectedOptionKey);

  const applicable = parameters.filter((p) => (p.applicability as string[]).includes(catCode));

  const diffs = applicable
    .filter((p) => {
      const sa = saMap.get(p.id);
      const v = vMap.get(p.id);
      return sa && v && sa !== v;
    })
    .map((p) => ({
      parameterId: p.id,
      code: p.code,
      titleEn: p.titleEn,
      titleHi: p.titleHi,
      domainTitleEn: p.subDomain.domain.titleEn,
      domainTitleHi: p.subDomain.domain.titleHi,
      schoolSelectedOptionKey: saMap.get(p.id)!,
      verifierSelectedOptionKey: vMap.get(p.id)!,
      options: p.options,
    }));

  return { diffs, totalApplicable: applicable.length };
}

// ─── School: Create/Update Appeal Draft ───

export async function saveAppealDraft(
  schoolUdise: string,
  cycleId: string,
  frameworkId: string,
  items: { parameterId: string; schoolJustification: string }[],
) {
  const elig = await getAppealEligibility(cycleId, schoolUdise);
  if (!elig.eligible) return { success: false, error: 'Not eligible for appeal.' };
  if (elig.existingAppeal?.status === 'SUBMITTED' || elig.existingAppeal?.status === 'DECIDED') {
    return { success: false, error: 'Appeal already submitted.' };
  }

  const diffs = await getDifferingParameters(cycleId, schoolUdise, frameworkId);

  const appeal = await prisma.appeal.upsert({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    create: { cycleId, schoolUdise, frameworkId, status: 'DRAFT' },
    update: {},
  });

  for (const item of items) {
    const diff = diffs.diffs.find((d) => d.parameterId === item.parameterId);
    if (!diff) continue;
    await prisma.appealItem.upsert({
      where: { appealId_parameterId: { appealId: appeal.id, parameterId: item.parameterId } },
      create: {
        appealId: appeal.id,
        parameterId: item.parameterId,
        schoolSelectedOptionKey: diff.schoolSelectedOptionKey,
        verifierSelectedOptionKey: diff.verifierSelectedOptionKey,
        schoolJustification: (item.schoolJustification || '').slice(0, 1000),
      },
      update: { schoolJustification: (item.schoolJustification || '').slice(0, 1000) },
    });
  }

  revalidatePath('/app/school/appeals');
  return { success: true };
}

// ─── School: Submit Appeal ───

export async function submitAppeal(schoolUdise: string, cycleId: string) {
  const elig = await getAppealEligibility(cycleId, schoolUdise);
  if (!elig.eligible || elig.expired) return { success: false, error: 'Appeal window closed.' };
  if (elig.existingAppeal?.status !== 'DRAFT' && !elig.existingAppeal) {
    return { success: false, error: 'No draft appeal found.' };
  }

  const appeal = await prisma.appeal.findUnique({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    include: { items: { include: { parameter: { select: { evidenceRequired: true, code: true } } } } },
  });
  if (!appeal || appeal.status !== 'DRAFT') return { success: false, error: 'Appeal not in draft.' };
  if (appeal.items.length === 0) return { success: false, error: 'No appeal items.' };

  // Check evidence for items where parameter.evidenceRequired
  const itemsNeedingEvidence = appeal.items.filter((i) => i.parameter.evidenceRequired);
  if (itemsNeedingEvidence.length > 0) {
    const evidenceLinks = await prisma.evidenceLink.findMany({
      where: { kind: 'APPEAL_ITEM', appealItemId: { in: itemsNeedingEvidence.map((i) => i.id) } },
      select: { appealItemId: true },
    });
    const hasEvidence = new Set(evidenceLinks.map((l) => l.appealItemId));
    const missing = itemsNeedingEvidence.filter((i) => !hasEvidence.has(i.id));
    if (missing.length > 0) {
      return {
        success: false,
        error: `Evidence required for: ${missing.map((m) => m.parameter.code).join(', ')}`,
      };
    }
  }

  await prisma.appeal.update({
    where: { id: appeal.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  revalidatePath('/app/school/appeals');
  return { success: true };
}

// ─── SSSA: Decide Appeal ───

export async function decideAppeal(
  actorUserId: string,
  appealId: string,
  decisions: { appealItemId: string; decision: 'ACCEPT_SCHOOL' | 'KEEP_VERIFIER' }[],
) {
  const appeal = await prisma.appeal.findUnique({
    where: { id: appealId },
    include: { items: true },
  });
  if (!appeal) return { success: false, error: 'Appeal not found.' };
  if (appeal.status === 'DECIDED') return { success: false, error: 'Already decided.' };

  const now = new Date();
  for (const d of decisions) {
    await prisma.appealItem.update({
      where: { id: d.appealItemId },
      data: { decision: d.decision, decidedAt: now },
    });
  }

  await prisma.appeal.update({
    where: { id: appealId },
    data: { status: 'DECIDED', decidedAt: now, decidedByUserId: actorUserId },
  });

  revalidatePath('/app/sssa/finalization');
  return { success: true };
}

// ─── Compute Final Score for One School ───

export async function computeAndStoreResult(cycleId: string, schoolUdise: string, frameworkId: string) {
  const school = await prisma.school.findUnique({ where: { udise: schoolUdise }, select: { category: true } });
  const catCode = CATEGORY_TO_CODE[school?.category ?? 'Primary'] ?? 'PRIMARY';

  const [saSubmission, vSubmission, rubrics, domains, parameters, appeal, gradeBands] = await Promise.all([
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.verificationSubmission.findFirst({
      where: { cycleId, schoolUdise, status: 'SUBMITTED' },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.rubricMapping.findMany({ where: { frameworkId }, select: { parameterId: true, optionKey: true, score: true } }),
    prisma.sqaafDomain.findMany({ where: { frameworkId, isActive: true }, select: { id: true, weightPercent: true } }),
    prisma.parameter.findMany({
      where: { frameworkId, isActive: true },
      select: { id: true, applicability: true, subDomain: { select: { domainId: true } } },
    }),
    prisma.appeal.findUnique({
      where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
      include: { items: { where: { decision: 'ACCEPT_SCHOOL' } } },
    }),
    prisma.gradeBand.findMany({ where: { frameworkId }, orderBy: { order: 'asc' } }),
  ]);

  const rubricMap = new Map<string, number>();
  for (const r of rubrics) rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);

  const domainWeightMap = new Map<string, number>();
  for (const d of domains) domainWeightMap.set(d.id, d.weightPercent ?? 0);

  const applicableParams = parameters.filter((p) => (p.applicability as string[]).includes(catCode));

  function computeScore(responseMap: Map<string, string>) {
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
      const key = responseMap.get(p.id);
      if (key) group.achieved += rubricMap.get(`${p.id}:${key}`) ?? 0;
    }
    let weightedSum = 0, totalWeight = 0;
    for (const [domainId, group] of domainGroups) {
      const weight = domainWeightMap.get(domainId) ?? 0;
      if (weight > 0 && group.possible > 0) {
        weightedSum += (group.achieved / group.possible) * weight;
        totalWeight += weight;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;
  }

  // SA score
  const saMap = new Map<string, string>();
  if (saSubmission) for (const r of saSubmission.responses) saMap.set(r.parameterId, r.selectedOptionKey);
  const selfScorePercent = saSubmission ? computeScore(saMap) : null;

  // Verifier score — null when no verifier submission
  const vMap = new Map<string, string>();
  if (vSubmission) for (const r of vSubmission.responses) vMap.set(r.parameterId, r.selectedOptionKey);
  const verifierScorePercent = vSubmission ? computeScore(vMap) : null;

  // Final = verifier + appeal overrides, or SA if no verifier (pilot mode)
  let finalMap: Map<string, string>;
  if (vSubmission) {
    finalMap = new Map(vMap);
    if (appeal) {
      for (const item of appeal.items) {
        finalMap.set(item.parameterId, item.schoolSelectedOptionKey);
      }
    }
  } else {
    finalMap = new Map(saMap);
  }
  const finalScorePercent = (saSubmission || vSubmission) ? computeScore(finalMap) : null;

  // Grade band
  let gradeBandCode: string | null = null;
  if (finalScorePercent != null && gradeBands.length > 0) {
    for (let i = 0; i < gradeBands.length; i++) {
      const band = gradeBands[i];
      const isLast = i === gradeBands.length - 1;
      if (finalScorePercent >= band.minPercent && (isLast ? finalScorePercent <= band.maxPercent : finalScorePercent < band.maxPercent)) {
        gradeBandCode = band.key;
        break;
      }
    }
  }

  await prisma.result.upsert({
    where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
    create: { cycleId, schoolUdise, frameworkId, selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode },
    update: { selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode },
  });

  revalidatePath('/app/sssa/finalization');
  return { selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode };
}

// ─── SSSA: Finalize All Schools ───

export async function finalizeAllResults(cycleId: string) {
  const framework = await prisma.framework.findUnique({ where: { cycleId }, select: { id: true, status: true } });
  if (!framework || framework.status !== 'PUBLISHED') return { success: false, error: 'No published framework.' };

  // Only compute for schools that have at least an SA submission
  const submissions = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId },
    select: { schoolUdise: true },
  });
  const udises = [...new Set(submissions.map((s) => s.schoolUdise))];
  let computed = 0;
  for (const udise of udises) {
    await computeAndStoreResult(cycleId, udise, framework.id);
    computed++;
  }

  revalidatePath('/app/sssa/finalization');
  return { success: true, computed };
}

// ─── SSSA: Publish Results ───

export async function publishResults(cycleId: string) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return { success: false, error: 'Cycle not found.' };

  const resultCount = await prisma.result.count({ where: { cycleId } });
  if (resultCount === 0) return { success: false, error: 'No results computed yet. Finalize first.' };

  const now = new Date();
  await prisma.result.updateMany({
    where: { cycleId, publishedAt: null },
    data: { publishedAt: now },
  });

  await prisma.cycle.update({
    where: { id: cycleId },
    data: { resultsPublished: true, resultsPublishedAt: now },
  });

  revalidatePath('/app/sssa/finalization');
  revalidatePath('/public/directory');
  return { success: true };
}

// ─── Get Finalization Summary for SSSA ───

export async function getFinalizationSummary(cycleId: string, frameworkId: string) {
  const { getBatchSelfAssessmentScores, getBatchVerificationScores } = await import('@/lib/scoring');

  const [schools, results, appeals, vSubmissions, saSubmissions] = await Promise.all([
    prisma.school.findMany({ select: { udise: true, nameEn: true, nameHi: true, districtCode: true, category: true } }),
    prisma.result.findMany({ where: { cycleId } }),
    prisma.appeal.findMany({ where: { cycleId }, select: { schoolUdise: true, status: true, items: { select: { decision: true } } } }),
    prisma.verificationSubmission.findMany({
      where: { cycleId, status: 'SUBMITTED' },
      select: { schoolUdise: true },
    }),
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId, status: 'SUBMITTED' },
      select: { schoolUdise: true },
    }),
  ]);

  const udises = schools.map((s) => s.udise);
  const [saScores, vScores] = await Promise.all([
    getBatchSelfAssessmentScores(cycleId, frameworkId, udises),
    getBatchVerificationScores(cycleId, frameworkId, udises),
  ]);

  const resultMap = new Map(results.map((r) => [r.schoolUdise, r]));
  const appealMap = new Map(appeals.map((a) => [a.schoolUdise, a]));
  const verifiedSet = new Set(vSubmissions.map((v) => v.schoolUdise));
  const submittedSaSet = new Set(saSubmissions.map((s) => s.schoolUdise));

  const rows = schools.map((s) => {
    const result = resultMap.get(s.udise);
    const appeal = appealMap.get(s.udise);
    const saLive = submittedSaSet.has(s.udise) ? (saScores[s.udise]?.scorePercent ?? null) : null;
    const vLive = verifiedSet.has(s.udise) ? (vScores[s.udise]?.scorePercent ?? null) : null;
    return {
      udise: s.udise,
      nameEn: s.nameEn,
      nameHi: s.nameHi,
      districtCode: s.districtCode,
      verified: verifiedSet.has(s.udise),
      selfScore: saLive,
      verifierScore: vLive,
      delta: saLive != null && vLive != null ? Math.abs(saLive - vLive) : null,
      appealStatus: appeal?.status ?? null,
      finalScore: result?.finalScorePercent ?? null,
      gradeBand: result?.gradeBandCode ?? null,
      published: !!result?.publishedAt,
    };
  });

  return rows;
}
