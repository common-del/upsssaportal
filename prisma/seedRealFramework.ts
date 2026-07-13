/**
 * One-time population of the real SQAAF framework content (domains, sub-domains,
 * parameters, rubric options, rubric scores, grade bands) from the government
 * SQAAF Checklist document, plus a designated "school" demo account with a real,
 * fully-answered and locked self-assessment so the login flow has something
 * meaningful to show as "already submitted".
 *
 * Idempotent (upsert-based). Run: npx tsx prisma/seedRealFramework.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { REAL_FRAMEWORK_DATA } from './realFrameworkData';

const prisma = new PrismaClient();

function pickOptionKey(): { key: string; score: number } {
  // Skews toward the higher-scoring levels so the demo account reads as a
  // reasonably (not perfectly) performing school.
  const r = Math.random();
  if (r < 0.15) return { key: 'LEVEL_1', score: 1 };
  if (r < 0.45) return { key: 'LEVEL_2', score: 2 };
  return { key: 'LEVEL_3', score: 3 };
}

async function main() {
  console.log('Populating real SQAAF framework content...');

  // 1. Resolve the two cycles seen in the earlier diagnostic and make sure only
  // one is active - the one that already has a framework attached.
  const targetCycle = await prisma.cycle.findFirst({ where: { name: 'SSSA Cycle 2025-26' } });
  if (!targetCycle) throw new Error('Expected cycle "SSSA Cycle 2025-26" not found.');

  const otherCycle = await prisma.cycle.findFirst({ where: { name: '2025-26' } });
  if (otherCycle && otherCycle.isActive) {
    await prisma.cycle.update({ where: { id: otherCycle.id }, data: { isActive: false } });
    console.log(`Deactivated duplicate active cycle "2025-26" (${otherCycle.id}).`);
  }
  if (!targetCycle.isActive) {
    await prisma.cycle.update({ where: { id: targetCycle.id }, data: { isActive: true } });
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: targetCycle.id } });
  if (!framework) throw new Error('Expected framework for "SSSA Cycle 2025-26" not found.');
  if (framework.status !== 'PUBLISHED') {
    await prisma.framework.update({ where: { id: framework.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  }
  console.log(`Target framework: ${framework.id} (cycle ${targetCycle.id})`);

  // 2. Domains -> sub-domains -> parameters -> options -> rubric mappings
  let domainCount = 0, subDomainCount = 0, paramCount = 0, optionCount = 0, rubricCount = 0;

  for (const d of REAL_FRAMEWORK_DATA) {
    const domain = await prisma.sqaafDomain.upsert({
      where: { frameworkId_code: { frameworkId: framework.id, code: d.code } },
      create: {
        frameworkId: framework.id,
        code: d.code,
        titleEn: d.titleEn,
        titleHi: d.titleHi,
        order: d.order,
        weightPercent: d.weightPercent,
      },
      update: { titleEn: d.titleEn, titleHi: d.titleHi, order: d.order, weightPercent: d.weightPercent },
    });
    domainCount++;

    for (const sd of d.subDomains) {
      const subDomain = await prisma.subDomain.upsert({
        where: { frameworkId_code: { frameworkId: framework.id, code: sd.code } },
        create: {
          frameworkId: framework.id,
          domainId: domain.id,
          code: sd.code,
          titleEn: sd.titleEn,
          titleHi: sd.titleHi,
          order: sd.order,
        },
        update: { domainId: domain.id, titleEn: sd.titleEn, titleHi: sd.titleHi, order: sd.order },
      });
      subDomainCount++;

      for (const p of sd.parameters) {
        const parameter = await prisma.parameter.upsert({
          where: { frameworkId_code: { frameworkId: framework.id, code: p.code } },
          create: {
            frameworkId: framework.id,
            subDomainId: subDomain.id,
            code: p.code,
            titleEn: p.titleEn,
            titleHi: p.titleHi,
            order: p.order,
            applicability: p.applicability,
            evidenceRequired: p.evidenceRequired,
          },
          update: {
            subDomainId: subDomain.id,
            titleEn: p.titleEn,
            titleHi: p.titleHi,
            order: p.order,
            applicability: p.applicability,
            evidenceRequired: p.evidenceRequired,
          },
        });
        paramCount++;

        for (const o of p.options) {
          await prisma.parameterOption.upsert({
            where: { parameterId_key: { parameterId: parameter.id, key: o.key } },
            create: { parameterId: parameter.id, key: o.key, labelEn: o.labelEn, labelHi: o.labelHi, order: o.order },
            update: { labelEn: o.labelEn, labelHi: o.labelHi, order: o.order },
          });
          optionCount++;

          await prisma.rubricMapping.upsert({
            where: { frameworkId_parameterId_optionKey: { frameworkId: framework.id, parameterId: parameter.id, optionKey: o.key } },
            create: { frameworkId: framework.id, parameterId: parameter.id, optionKey: o.key, score: o.score },
            update: { score: o.score },
          });
          rubricCount++;
        }
      }
    }
  }
  console.log(`Domains: ${domainCount}, SubDomains: ${subDomainCount}, Parameters: ${paramCount}, Options: ${optionCount}, RubricMappings: ${rubricCount}`);

  // 3. Grade bands (percent thresholds match the low/high-performing cutoffs
  // already used elsewhere in the app: <40 / >=76).
  const gradeBands = [
    { key: 'NEEDS_IMPROVEMENT', labelEn: 'Needs Improvement', labelHi: 'सुधार आवश्यक', minPercent: 0, maxPercent: 40, order: 1 },
    { key: 'SATISFACTORY', labelEn: 'Satisfactory', labelHi: 'संतोषजनक', minPercent: 40, maxPercent: 76, order: 2 },
    { key: 'EXCELLENT', labelEn: 'Excellent', labelHi: 'उत्कृष्ट', minPercent: 76, maxPercent: 100, order: 3 },
  ];
  for (const gb of gradeBands) {
    await prisma.gradeBand.upsert({
      where: { frameworkId_key: { frameworkId: framework.id, key: gb.key } },
      create: { frameworkId: framework.id, ...gb },
      update: gb,
    });
  }
  console.log(`Grade bands: ${gradeBands.length}`);

  // 4. Designated "school" demo account with a real, fully-answered, locked
  // self-assessment - so the "school"/any-password login shows something real.
  const district = await prisma.district.findFirst({ where: { code: 'LKO' } }) ?? await prisma.district.findFirst();
  if (!district) throw new Error('No district found to attach the demo school to.');
  const block = await prisma.block.findFirst({ where: { districtCode: district.code } });
  if (!block) throw new Error('No block found to attach the demo school to.');

  const demoSchool = await prisma.school.upsert({
    where: { udise: 'school' },
    create: {
      udise: 'school',
      nameEn: 'Demo School (Submitted & Locked)',
      nameHi: 'डेमो विद्यालय (सबमिट किया हुआ)',
      category: 'Primary',
      districtCode: district.code,
      blockCode: block.code,
      addressEn: 'Demo account for testing - not a real school.',
    },
    update: { category: 'Primary' },
  });

  const demoPwdHash = await bcrypt.hash('school-demo', 10);
  await prisma.user.upsert({
    where: { username: 'school' },
    create: {
      username: 'school',
      passwordHash: demoPwdHash,
      name: 'school',
      role: 'SCHOOL',
      districtCode: district.code,
    },
    update: {},
  });
  console.log(`Demo school account: udise=${demoSchool.udise}, district=${district.code}, block=${block.code}`);

  // 5. Real, fully-answered submission for the demo school - all 89 applicable
  // (PRIMARY) parameters get a real response, then the submission is locked.
  const applicableParams = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: { id: true, applicability: true },
  });
  const primaryParams = applicableParams.filter((p) => (p.applicability as string[]).includes('PRIMARY'));

  const submission = await prisma.selfAssessmentSubmission.upsert({
    where: { cycleId_schoolUdise: { cycleId: targetCycle.id, schoolUdise: 'school' } },
    create: {
      cycleId: targetCycle.id,
      schoolUdise: 'school',
      frameworkId: framework.id,
      status: 'SUBMITTED',
      startedAt: new Date(Date.now() - 20 * 86400000),
      submittedAt: new Date(Date.now() - 5 * 86400000),
    },
    update: { status: 'SUBMITTED', submittedAt: new Date(Date.now() - 5 * 86400000) },
  });

  const existingResponseCount = await prisma.selfAssessmentResponse.count({ where: { submissionId: submission.id } });
  const responseMap = new Map<string, string>();
  if (existingResponseCount === 0) {
    const rows = primaryParams.map((p) => {
      const choice = pickOptionKey();
      responseMap.set(p.id, choice.key);
      return { submissionId: submission.id, parameterId: p.id, selectedOptionKey: choice.key };
    });
    await prisma.selfAssessmentResponse.createMany({ data: rows, skipDuplicates: true });
    console.log(`Created ${rows.length} self-assessment responses for the demo school.`);
  } else {
    const existing = await prisma.selfAssessmentResponse.findMany({ where: { submissionId: submission.id } });
    for (const r of existing) responseMap.set(r.parameterId, r.selectedOptionKey);
    console.log(`Demo school already has ${existingResponseCount} responses - left as-is.`);
  }

  // 6. Compute a real self-score for the demo school's Result row (no verifier
  // yet - finalScorePercent stays null, matching the rest of the app's rule
  // that a final score requires a real verifier submission).
  const rubrics = await prisma.rubricMapping.findMany({ where: { frameworkId: framework.id }, select: { parameterId: true, optionKey: true, score: true } });
  const rubricMap = new Map<string, number>();
  for (const r of rubrics) rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);
  const domainWeights = await prisma.sqaafDomain.findMany({ where: { frameworkId: framework.id }, select: { id: true, weightPercent: true } });
  const domainWeightMap = new Map(domainWeights.map((d) => [d.id, d.weightPercent ?? 0]));
  const paramsWithDomain = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, id: { in: primaryParams.map((p) => p.id) } },
    select: { id: true, subDomain: { select: { domainId: true } } },
  });

  const domainGroups = new Map<string, { achieved: number; possible: number }>();
  for (const p of paramsWithDomain) {
    const domainId = p.subDomain.domainId;
    if (!domainGroups.has(domainId)) domainGroups.set(domainId, { achieved: 0, possible: 0 });
    const group = domainGroups.get(domainId)!;
    group.possible += 3; // max score per parameter (LEVEL_3)
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
  const selfScorePercent = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;

  await prisma.result.upsert({
    where: { cycleId_schoolUdise: { cycleId: targetCycle.id, schoolUdise: 'school' } },
    create: { cycleId: targetCycle.id, schoolUdise: 'school', frameworkId: framework.id, selfScorePercent, verifierScorePercent: null, finalScorePercent: null, gradeBandCode: null },
    update: { selfScorePercent },
  });
  console.log(`Demo school self-score: ${selfScorePercent}% (no verifier submission yet, so final score stays null).`);

  console.log('\nDone. Login as "school" with any password to see the submitted & locked demo account.');
  console.log('Log in with any real UDISE + its password (e.g. from seed.ts or seed-dummy.ts) to see a school that still needs to fill the SQAAF.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
