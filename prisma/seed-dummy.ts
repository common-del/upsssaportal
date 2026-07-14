/**
 * Dummy data seed for UP SSSA portal.
 * Idempotent (upsert-based). Batched in groups of 50.
 * Run: npx tsx prisma/seed-dummy.ts
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Config ────────────────────────────────────────────────────────────────────

const DISTRICTS = [
  { code: 'LKO', nameEn: 'Lucknow', nameHi: 'लखनऊ' },
  { code: 'VNS', nameEn: 'Varanasi', nameHi: 'वाराणसी' },
  { code: 'PRG', nameEn: 'Prayagraj', nameHi: 'प्रयागराज' },
  { code: 'KNP', nameEn: 'Kanpur Nagar', nameHi: 'कानपुर नगर' },
  { code: 'GKP', nameEn: 'Gorakhpur', nameHi: 'गोरखपुर' },
];

const BLOCK_NAMES: Record<string, string[]> = {
  LKO: ['Bakshi Ka Talab', 'Mal', 'Mohan Lalganj', 'Sarojini Nagar'],
  VNS: ['Arajiline', 'Harhua', 'Cholapur', 'Badagaon'],
  PRG: ['Allahabad', 'Manda', 'Shankargarh', 'Soraon'],
  KNP: ['Bilhaur', 'Ghatampur', 'Kalpee', 'Sarsaul'],
  GKP: ['Campierganj', 'Chargawan', 'Jungle Kauria', 'Pipraich'],
};

const SCHOOL_TYPES = ['GOVT', 'GOVT_AIDED', 'PRIVATE_AIDED', 'PRIVATE'] as const;
const SCHOOL_TYPE_WEIGHTS = [0.6, 0.15, 0.15, 0.1]; // cumulative

const LEVELS = ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'] as const;

// Mirrors src/lib/actions/selfAssessment.ts's CATEGORY_TO_CODE. Note this script's
// School.category values (GOVT/GOVT_AIDED/PRIVATE_AIDED/PRIVATE, an ownership type)
// don't match these keys ('Primary'/'Upper Primary'/'Secondary', a grade level) - that's
// a pre-existing overload of the same field elsewhere in the app, not something this
// script introduces. It falls back to PRIMARY for every school here, exactly like
// production does for any school whose category isn't one of these three labels.
const CATEGORY_TO_CODE_LEVEL: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

const DISPUTE_CATEGORY_CODES = [
  { code: 'EVD_MISMATCH', nameEn: 'Evidence Mismatch', nameHi: 'साक्ष्य बेमेल' },
  { code: 'SCORE_MISMATCH', nameEn: 'Score Mismatch', nameHi: 'स्कोर बेमेल' },
  { code: 'DOC_CONFLICT', nameEn: 'Documentation Conflict', nameHi: 'दस्तावेज़ विवाद' },
  { code: 'PROCEDURAL', nameEn: 'Procedural', nameHi: 'प्रक्रियात्मक' },
  { code: 'EVAL_OBS', nameEn: 'Evaluator Observation Conflict', nameHi: 'मूल्यांकनकर्ता अवलोकन विवाद' },
];

const DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'CLARIFICATION_PENDING', 'RESOLVED'];
const DISPUTE_STATUS_WEIGHTS = [0.3, 0.25, 0.2, 0.25];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i]!;
    if (r < cum) return items[i]!;
  }
  return items[items.length - 1]!;
}

async function hashPwd(pwd: string) {
  return bcrypt.hash(pwd, 10);
}

function udise(districtIdx: number, blockIdx: number, serial: number) {
  const d = String(districtIdx + 1).padStart(2, '0');
  const b = String(blockIdx + 1).padStart(2, '0');
  const s = String(serial).padStart(5, '0');
  return `09${d}${b}${s}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting dummy seed…');

  // 0. Ensure dispute categories exist
  for (const cat of DISPUTE_CATEGORY_CODES) {
    await prisma.disputeCategory.upsert({
      where: { code: cat.code },
      create: cat,
      update: { nameEn: cat.nameEn, nameHi: cat.nameHi },
    });
  }
  console.log('✓ Dispute categories');

  // 1. Districts
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { code: d.code },
      create: d,
      update: { nameEn: d.nameEn, nameHi: d.nameHi },
    });
  }
  console.log('✓ Districts');

  // 2. Blocks
  const blockRecords: { code: string; districtCode: string; nameEn: string; nameHi: string }[] = [];
  for (const [di, dist] of DISTRICTS.entries()) {
    for (const [bi, bName] of BLOCK_NAMES[dist.code]!.entries()) {
      const code = `${dist.code}_B${bi + 1}`;
      blockRecords.push({ code, districtCode: dist.code, nameEn: bName, nameHi: bName });
    }
  }
  for (const b of blockRecords) {
    await prisma.block.upsert({
      where: { code: b.code },
      create: b,
      update: { nameEn: b.nameEn },
    });
  }
  console.log('✓ Blocks');

  // 3. Schools — 40 per district × 5 = 200
  const schoolUdises: string[] = [];
  const schoolDistrictMap: Record<string, string> = {};
  const schoolNameMap: Record<string, string> = {};
  let schoolRecords: Parameters<typeof prisma.school.upsert>[0]['create'][] = [];

  for (const [di, dist] of DISTRICTS.entries()) {
    const distBlocks = blockRecords.filter((b) => b.districtCode === dist.code);
    for (let si = 0; si < 40; si++) {
      const bi = si % distBlocks.length;
      const block = distBlocks[bi]!;
      const udiseCode = udise(di, bi, si + 1);
      const category = weightedPick([...SCHOOL_TYPES], SCHOOL_TYPE_WEIGHTS);
      const level = pick([...LEVELS]);
      const nameEn = `${faker.company.name()} School, ${dist.nameEn}`;
      schoolUdises.push(udiseCode);
      schoolDistrictMap[udiseCode] = dist.code;
      schoolNameMap[udiseCode] = nameEn;
      schoolRecords.push({
        udise: udiseCode,
        nameEn,
        nameHi: nameEn,
        category,
        districtCode: dist.code,
        blockCode: block.code,
        addressEn: faker.location.streetAddress(),
      });
    }
  }

  for (const batch of chunk(schoolRecords, 50)) {
    await prisma.$transaction(
      batch.map((s) =>
        prisma.school.upsert({
          where: { udise: s.udise },
          create: s,
          update: { nameEn: s.nameEn, category: s.category },
        }),
      ),
    );
  }
  console.log(`✓ Schools (${schoolRecords.length})`);

  // 4. School users (1 per school)
  const schoolUserPwd = await hashPwd('school123');
  for (const batch of chunk(schoolUdises, 50)) {
    await prisma.$transaction(
      batch.map((udise) =>
        prisma.user.upsert({
          where: { username: udise },
          create: {
            username: udise,
            passwordHash: schoolUserPwd,
            name: `School ${udise}`,
            role: 'SCHOOL',
            districtCode: schoolDistrictMap[udise],
          },
          update: {},
        }),
      ),
    );
  }
  console.log('✓ School users');

  // 5. Verifiers — 3 per district = 15
  const verifierPwd = await hashPwd('verifier123');
  const verifierIds: Record<string, string[]> = {};
  for (const dist of DISTRICTS) {
    verifierIds[dist.code] = [];
    for (let n = 1; n <= 3; n++) {
      const username = `verifier_${dist.code.toLowerCase()}_${n}`;
      const v = await prisma.user.upsert({
        where: { username },
        create: {
          username,
          passwordHash: verifierPwd,
          name: `Verifier ${dist.nameEn} ${n}`,
          role: 'VERIFIER',
          districtCode: dist.code,
        },
        update: { districtCode: dist.code },
      });
      verifierIds[dist.code]!.push(v.id);
    }
  }
  console.log('✓ Verifiers');

  // 6. District admins — 1 per district
  const districtPwd = await hashPwd('district123');
  for (const dist of DISTRICTS) {
    const username = `district_${dist.nameEn.toLowerCase().replace(/\s/g, '_')}`;
    await prisma.user.upsert({
      where: { username },
      create: {
        username,
        passwordHash: districtPwd,
        name: `District Admin ${dist.nameEn}`,
        role: 'DISTRICT_ADMIN',
        districtCode: dist.code,
      },
      update: { districtCode: dist.code },
    });
  }
  console.log('✓ District admins');

  // 7. Cycle
  // Diagnostic (read-only): surface every cycle/framework and how many domains each
  // framework has, so an empty active framework is obvious in the logs instead of
  // silently producing empty self-assessments for every school.
  const allCyclesDiag = await prisma.cycle.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      frameworks: { select: { id: true, status: true, domains: { select: { id: true } } } },
    },
  });
  for (const c of allCyclesDiag) {
    console.log(
      `ℹ Cycle "${c.name}" (${c.id}) isActive=${c.isActive}: framework=${c.frameworks?.id ?? 'none'} ` +
      `status=${c.frameworks?.status ?? 'n/a'} domains=${c.frameworks?.domains.length ?? 0}`,
    );
  }
  const allFrameworksDiag = await prisma.framework.findMany({
    select: { id: true, cycleId: true, status: true, domains: { select: { id: true } } },
  });
  console.log(`ℹ Total frameworks in DB: ${allFrameworksDiag.length}`);
  for (const f of allFrameworksDiag) {
    console.log(`  - framework ${f.id} (cycleId=${f.cycleId}, status=${f.status}): ${f.domains.length} domains`);
  }

  let cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    cycle = await prisma.cycle.upsert({
      where: { name: 'SSSA Cycle 2025-26' },
      create: {
        name: 'SSSA Cycle 2025-26',
        isActive: true,
        startsAt: new Date('2025-04-01'),
        endsAt: new Date('2026-03-31'),
      },
      update: { isActive: true },
    });
  }

  // Need a framework for self assessments
  let framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) {
    framework = await prisma.framework.create({
      data: { cycleId: cycle.id, status: 'PUBLISHED', publishedAt: new Date() },
    });
  }
  console.log('✓ Cycle + Framework');

  const schoolCategoryMap: Record<string, string> = {};
  for (const s of schoolRecords) schoolCategoryMap[s.udise] = s.category;

  // Real framework parameters + rubric/weights, used to (a) generate responses that
  // actually exist for schools this script marks SUBMITTED/UNDER_REVIEW/VERIFIED, and
  // (b) score them with the exact same formula the app uses everywhere else, so no
  // Result row here ever shows a number that wasn't actually computed from real
  // responses (mirrors src/lib/actions/finalization.ts's computeAndStoreResult).
  const allParams = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: {
      id: true,
      applicability: true,
      subDomain: { select: { domainId: true } },
      options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { key: true } },
    },
  });
  const rubrics = await prisma.rubricMapping.findMany({
    where: { frameworkId: framework.id },
    select: { parameterId: true, optionKey: true, score: true },
  });
  const domainWeights = await prisma.sqaafDomain.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: { id: true, weightPercent: true },
  });
  const gradeBands = await prisma.gradeBand.findMany({ where: { frameworkId: framework.id }, orderBy: { order: 'asc' } });

  console.log(
    `ℹ Framework ${framework.id}: ${allParams.length} active parameters, ${rubrics.length} rubric mappings, ` +
    `${domainWeights.length} weighted domains, ${gradeBands.length} grade bands.`,
  );
  if (allParams.length === 0) {
    console.log('⚠ No active parameters on this framework — self-assessment/verification response backfill will be a no-op.');
  }
  if (rubrics.length === 0) {
    console.log('⚠ No rubric mappings on this framework — computed scores will come back null until scoring is configured.');
  }

  const rubricMap = new Map<string, number>();
  for (const r of rubrics) rubricMap.set(`${r.parameterId}:${r.optionKey}`, r.score);
  const domainWeightMap = new Map<string, number>();
  for (const d of domainWeights) domainWeightMap.set(d.id, d.weightPercent ?? 0);

  function applicableParamsFor(schoolCategory: string) {
    const categoryCode = CATEGORY_TO_CODE_LEVEL[schoolCategory] ?? 'PRIMARY';
    return allParams.filter((p) => (p.applicability as string[]).includes(categoryCode));
  }

  function computeScore(responseMap: Map<string, string>, applicable: typeof allParams) {
    const domainGroups = new Map<string, { achieved: number; possible: number }>();
    for (const p of applicable) {
      const domainId = p.subDomain.domainId;
      if (!domainGroups.has(domainId)) domainGroups.set(domainId, { achieved: 0, possible: 0 });
      const group = domainGroups.get(domainId)!;
      const maxScore = Math.max(0, ...p.options.map((o) => rubricMap.get(`${p.id}:${o.key}`) ?? 0));
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

  // Skews toward the higher-scoring end of a parameter's options (assumed ordered
  // low -> high) so demo schools read as reasonably-performing rather than random noise.
  function pickOptionKey(options: { key: string }[]): string | null {
    if (options.length === 0) return null;
    const weights = options.map((_, i) => i + 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const r = Math.random() * total;
    let cum = 0;
    for (let i = 0; i < options.length; i++) {
      cum += weights[i]!;
      if (r < cum) return options[i]!.key;
    }
    return options[options.length - 1]!.key;
  }

  // Verifier mostly agrees with the school, occasionally picks a neighboring option —
  // gives the dispute/appeal flows something realistic to disagree about.
  function verifierPickOptionKey(options: { key: string }[], selfKey: string | null): string | null {
    if (options.length === 0) return null;
    const idx = selfKey ? options.findIndex((o) => o.key === selfKey) : -1;
    if (idx === -1) return pickOptionKey(options);
    if (Math.random() < 0.7) return selfKey;
    const dir = Math.random() < 0.5 ? -1 : 1;
    return options[Math.min(options.length - 1, Math.max(0, idx + dir))]!.key;
  }

  // 8. Self assessments — distribute statuses across 200 schools
  const SA_STATUSES = ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'] as const;
  const SA_WEIGHTS = [0.3, 0.2, 0.25, 0.15, 0.1];

  const saStatusMap: Record<string, string> = {};
  const saIdMap: Record<string, string> = {};

  const submittedSchools: string[] = [];
  const underReviewSchools: string[] = [];
  const verifiedSchools: string[] = [];

  const saRecords: { udise: string; status: string }[] = schoolUdises.map((udise) => {
    const status = weightedPick([...SA_STATUSES], SA_WEIGHTS);
    saStatusMap[udise] = status;
    if (status === 'SUBMITTED') submittedSchools.push(udise);
    if (status === 'UNDER_REVIEW') underReviewSchools.push(udise);
    if (status === 'VERIFIED') verifiedSchools.push(udise);
    return { udise, status };
  });

  const submittableStatuses = new Set(['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED']);
  const submittedOrLaterUdises = [...submittedSchools, ...underReviewSchools, ...verifiedSchools];

  for (const batch of chunk(saRecords, 50)) {
    const upserted = await prisma.$transaction(
      batch
        .filter((r) => r.status !== 'NOT_STARTED')
        .map((r) =>
          prisma.selfAssessmentSubmission.upsert({
            where: { cycleId_schoolUdise: { cycleId: cycle!.id, schoolUdise: r.udise } },
            create: {
              cycleId: cycle!.id,
              schoolUdise: r.udise,
              frameworkId: framework!.id,
              status: submittableStatuses.has(r.status) ? 'SUBMITTED' : 'DRAFT',
              startedAt: new Date(Date.now() - faker.number.int({ min: 10, max: 60 }) * 86400000),
              submittedAt: submittableStatuses.has(r.status) ? new Date(Date.now() - faker.number.int({ min: 1, max: 30 }) * 86400000) : null,
            },
            update: {},
          }),
        ),
    );
    for (const s of upserted) saIdMap[s.schoolUdise] = s.id;
  }
  console.log('✓ Self Assessments');

  // 8b. Backfill real responses for every school whose SelfAssessmentSubmission is actually
  // SUBMITTED in the database but that doesn't have any responses yet (previously these were
  // fake-submitted with zero underlying answers, so a school's own read-only view had nothing
  // to show). Sourced from the DB rather than this run's freshly-randomized saStatusMap/
  // submittedOrLaterUdises, since those are re-rolled with Math.random() on every run and the
  // upserts above use `update: {}` - a school SUBMITTED by a previous run stays SUBMITTED in the
  // DB even when this run's re-roll no longer picks it, and it must still get backfilled.
  const actualSubmittedSubs = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED' },
    select: { id: true, schoolUdise: true },
  });
  const actualSubmittedUdises = actualSubmittedSubs.map((s) => s.schoolUdise);
  for (const s of actualSubmittedSubs) saIdMap[s.schoolUdise] = s.id;

  const saResponseMaps: Record<string, Map<string, string>> = {};
  let saBackfilled = 0;
  if (allParams.length > 0) {
    const submissionIds = actualSubmittedUdises.map((u) => saIdMap[u]).filter((id): id is string => !!id);
    const existingCounts = await prisma.selfAssessmentResponse.groupBy({
      by: ['submissionId'],
      where: { submissionId: { in: submissionIds } },
      _count: { id: true },
    });
    const alreadyAnswered = new Set(existingCounts.filter((c) => c._count.id > 0).map((c) => c.submissionId));

    for (const udise of actualSubmittedUdises) {
      const submissionId = saIdMap[udise];
      if (!submissionId || alreadyAnswered.has(submissionId)) continue;

      const responseMap = new Map<string, string>();
      const rows = allParams
        .map((p) => {
          const key = pickOptionKey(p.options);
          if (key) responseMap.set(p.id, key);
          return key ? { submissionId, parameterId: p.id, selectedOptionKey: key } : null;
        })
        .filter((r): r is { submissionId: string; parameterId: string; selectedOptionKey: string } => !!r);

      if (rows.length > 0) {
        await prisma.selfAssessmentResponse.createMany({ data: rows, skipDuplicates: true });
        saResponseMaps[udise] = responseMap;
        saBackfilled++;
      }
    }
  }
  console.log(`✓ Self-Assessment responses backfilled for ${saBackfilled} schools`);

  // 9. Verifier assignments — for UNDER_REVIEW + VERIFIED, distribute among verifiers in same district
  const allAssignableUdises = [...underReviewSchools, ...verifiedSchools];
  const assignmentIdMap: Record<string, string> = {};

  for (const batch of chunk(allAssignableUdises, 50)) {
    const upserted = await prisma.$transaction(
      batch.map((udise) => {
        const distCode = schoolDistrictMap[udise]!;
        const distVerifiers = verifierIds[distCode]!;
        const verifierIdx = Math.floor(Math.random() * distVerifiers.length);
        const verifierUserId = distVerifiers[verifierIdx]!;
        return prisma.verifierAssignment.upsert({
          where: { cycleId_schoolUdise: { cycleId: cycle!.id, schoolUdise: udise } },
          create: {
            cycleId: cycle!.id,
            schoolUdise: udise,
            verifierUserId,
            deadlineAt: new Date(Date.now() + 30 * 86400000),
          },
          update: {},
        });
      }),
    );
    for (const a of upserted) assignmentIdMap[a.schoolUdise] = a.id;
  }
  console.log('✓ Verifier Assignments');

  // 9b. Backfill verification submissions + responses for UNDER_REVIEW/VERIFIED schools
  // that don't have one yet — mirrors the school's self-assessment with some deliberate
  // disagreement, instead of a Result row with a verifierScorePercent but no verifier
  // submission behind it.
  let verificationBackfilled = 0;
  if (allParams.length > 0) {
    const existingVSubs = await prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: allAssignableUdises } },
      select: { schoolUdise: true },
    });
    const alreadyVerified = new Set(existingVSubs.map((v) => v.schoolUdise));

    for (const udise of allAssignableUdises) {
      if (alreadyVerified.has(udise)) continue;
      const assignmentId = assignmentIdMap[udise];
      const assignment = assignmentId
        ? await prisma.verifierAssignment.findUnique({ where: { id: assignmentId } })
        : null;
      if (!assignment) continue;

      const vSubmission = await prisma.verificationSubmission.create({
        data: {
          cycleId: cycle.id,
          schoolUdise: udise,
          frameworkId: framework.id,
          assignmentId: assignment.id,
          verifierUserId: assignment.verifierUserId,
          status: 'SUBMITTED',
          startedAt: new Date(Date.now() - faker.number.int({ min: 5, max: 25 }) * 86400000),
          submittedAt: new Date(Date.now() - faker.number.int({ min: 1, max: 10 }) * 86400000),
        },
      });

      const selfMap = saResponseMaps[udise];
      const rows = allParams
        .map((p) => {
          const key = verifierPickOptionKey(p.options, selfMap?.get(p.id) ?? null);
          return key ? { submissionId: vSubmission.id, parameterId: p.id, selectedOptionKey: key } : null;
        })
        .filter((r): r is { submissionId: string; parameterId: string; selectedOptionKey: string } => !!r);

      if (rows.length > 0) {
        await prisma.verificationResponse.createMany({ data: rows, skipDuplicates: true });
        verificationBackfilled++;
      }
    }
  }
  console.log(`✓ Verification submissions backfilled for ${verificationBackfilled} schools`);

  // 10. Results — computed from the real responses above with the same formula the
  // rest of the app uses, for every school that has a self-assessment submission.
  // finalScorePercent (and gradeBandCode) only get set when a verifier submission
  // exists — no self-assessment-only fallback, matching computeAndStoreResult.
  let resultsComputed = 0;
  let resultsWithFinalScore = 0;
  for (const udise of actualSubmittedUdises) {
    const applicable = applicableParamsFor(schoolCategoryMap[udise] ?? '');

    // Read responses back from the DB rather than the in-memory saResponseMaps cache -
    // that cache only holds entries for schools backfilled *this run*, so a school backfilled
    // by an earlier run would otherwise fall back to an empty map and score as 0.
    const submissionId = saIdMap[udise];
    const saResponseRows = submissionId
      ? await prisma.selfAssessmentResponse.findMany({
          where: { submissionId },
          select: { parameterId: true, selectedOptionKey: true },
        })
      : [];
    const saMap = new Map(saResponseRows.map((r) => [r.parameterId, r.selectedOptionKey]));
    const selfScorePercent = computeScore(saMap, applicable);

    let verifierScorePercent: number | null = null;
    let finalScorePercent: number | null = null;
    const vSub = await prisma.verificationSubmission.findFirst({
      where: { cycleId: cycle.id, schoolUdise: udise, status: 'SUBMITTED' },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    });
    if (vSub) {
      const vMap = new Map(vSub.responses.map((r) => [r.parameterId, r.selectedOptionKey]));
      verifierScorePercent = computeScore(vMap, applicable);
      finalScorePercent = verifierScorePercent;
    }

    let gradeBandCode: string | null = null;
    if (finalScorePercent != null && gradeBands.length > 0) {
      for (let i = 0; i < gradeBands.length; i++) {
        const band = gradeBands[i]!;
        const isLast = i === gradeBands.length - 1;
        if (finalScorePercent >= band.minPercent && (isLast ? finalScorePercent <= band.maxPercent : finalScorePercent < band.maxPercent)) {
          gradeBandCode = band.key;
          break;
        }
      }
    }

    await prisma.result.upsert({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
      create: { cycleId: cycle.id, schoolUdise: udise, frameworkId: framework.id, selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode, publishedAt: new Date() },
      update: { selfScorePercent, verifierScorePercent, finalScorePercent, gradeBandCode },
    });
    resultsComputed++;
    if (finalScorePercent != null) resultsWithFinalScore++;
  }
  console.log(`✓ Results computed for ${resultsComputed} schools (${resultsWithFinalScore} with a real final score)`);

  // 11. Disputes — 25 linked to VERIFIED schools
  const disputeSchools = faker.helpers.arrayElements(verifiedSchools, Math.min(25, verifiedSchools.length));

  const disputeArg = () =>
    `${faker.lorem.sentence()} ${faker.lorem.sentence()} The school believes the score does not reflect actual conditions.`;
  const verifierRes = () =>
    `${faker.lorem.sentence()} ${faker.lorem.sentence()} The verifier's assessment was based on documented evidence.`;

  const thirtyDaysAgo = Date.now() - 30 * 86400000;

  for (const [idx, udise] of disputeSchools.entries()) {
    const cat = pick(DISPUTE_CATEGORY_CODES);
    const status = weightedPick(DISPUTE_STATUSES, DISPUTE_STATUS_WEIGHTS);
    const createdAt = new Date(thirtyDaysAgo + faker.number.int({ min: 0, max: 30 * 86400000 }));
    const resolvedAt = status === 'RESOLVED' ? new Date(createdAt.getTime() + faker.number.int({ min: 86400000, max: 7 * 86400000 })) : null;

    const submitterName = faker.person.fullName();

    const ticket = await prisma.ticket.upsert({
      where: { id: `dummy_dispute_${idx + 1}` },
      create: {
        id: `dummy_dispute_${idx + 1}`,
        schoolUdise: udise,
        categoryCode: cat.code,
        districtCode: schoolDistrictMap[udise]!,
        description: disputeArg(),
        schoolArgument: disputeArg(),
        verifierResponse: status !== 'OPEN' ? verifierRes() : null,
        submitterName,
        submitterMobile: `9${faker.string.numeric(9)}`,
        status,
        handlerLevel: status === 'OPEN' ? 'SCHOOL' : 'DISTRICT',
        resolvedAt,
        closedReason: resolvedAt ? faker.lorem.sentence() : null,
        createdAt,
        updatedAt: createdAt,
      },
      update: {},
    });

    // Dispute history — filing event for all; additional entries for resolved
    const filedNotes = `Filed by: ${schoolNameMap[udise] ?? udise} / ${submitterName}`;
    await prisma.disputeHistory.upsert({
      where: { id: `dummy_history_${idx + 1}_filed` },
      create: {
        id: `dummy_history_${idx + 1}_filed`,
        ticketId: ticket.id,
        actorUserId: null,
        actionType: 'FILED',
        notes: filedNotes,
        createdAt,
      },
      update: {},
    });

    if (status === 'RESOLVED') {
      const histEntries = [
        { actionType: 'NUDGE_SCHOOL', notes: 'School asked to provide additional evidence.', offset: 1 },
        { actionType: 'RESOLVED', notes: ticket.closedReason, offset: 3 },
      ];
      for (const h of histEntries) {
        const hDate = new Date(createdAt.getTime() + h.offset * 86400000);
        await prisma.disputeHistory.upsert({
          where: { id: `dummy_history_${idx + 1}_${h.offset}` },
          create: {
            id: `dummy_history_${idx + 1}_${h.offset}`,
            ticketId: ticket.id,
            actorUserId: null,
            actionType: h.actionType,
            notes: h.notes ?? null,
            createdAt: hDate,
          },
          update: {},
        });
      }
    }
  }
  console.log('✓ Disputes + History');

  // 12. Fee Disclosure (private/aided schools only)
  const feeEligibleTypes = ['PRIVATE', 'PRIVATE_AIDED', 'GOVT_AIDED'];
  const feeSchools = schoolRecords.filter((s) => feeEligibleTypes.includes(s.category));
  for (const batch of chunk(feeSchools, 50)) {
    await prisma.$transaction(
      batch.map((s) =>
        prisma.feeDisclosure.upsert({
          where: { schoolUdise: s.udise },
          create: {
            schoolUdise: s.udise,
            annualTuition: faker.number.int({ min: 5000, max: 80000 }),
            admissionFee: faker.number.int({ min: 1000, max: 15000 }),
            transportFee: faker.number.int({ min: 0, max: 12000 }),
            otherCharges: faker.number.int({ min: 500, max: 8000 }),
            scholarshipsSummary: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
            lastUpdated: faker.date.recent({ days: 60 }),
          },
          update: {},
        }),
      ),
    );
  }
  console.log(`✓ Fee Disclosure (${feeSchools.length} schools)`);

  // 13. School Scholarships
  const schemes = ['MERIT', 'EWS', 'SPORTS', 'SC_ST', 'MINORITY', 'DIFFERENTLY_ABLED'] as const;
  for (const batch of chunk(feeSchools, 50)) {
    await prisma.$transaction(
      batch.flatMap((s) =>
        schemes.map((scheme) =>
          prisma.schoolScholarship.upsert({
            where: { schoolUdise_scheme: { schoolUdise: s.udise, scheme } },
            create: {
              schoolUdise: s.udise,
              scheme,
              available: faker.datatype.boolean({ probability: 0.4 }),
            },
            update: {},
          }),
        ),
      ),
    );
  }
  console.log('✓ School Scholarships');

  // 14. Mandatory Documents (6 per school)
  const baseDocs = [
    'Fire Safety Certificate',
    'Building Safety Certificate',
    'SMC Constitution Order',
    'Sanitation & Drinking Water Certificate',
    'Boundary Wall & Playground Certificate',
  ];
  const privateDoc = 'RTE Compliance Certificate';
  const docStatuses = ['NOT_UPLOADED', 'UPLOADED', 'EXPIRED', 'ACKNOWLEDGED'] as const;

  for (const batch of chunk(schoolUdises, 50)) {
    await prisma.$transaction(
      batch.flatMap((udise) => {
        const cat = schoolRecords.find((s) => s.udise === udise)?.category ?? 'GOVT';
        const types = cat === 'GOVT' ? baseDocs : [...baseDocs, privateDoc];
        return types.map((documentType) => {
          const status = weightedPick([...docStatuses], [0.2, 0.45, 0.15, 0.2]);
          const uploadedAt = status !== 'NOT_UPLOADED' ? faker.date.recent({ days: 90 }) : null;
          const validTill = uploadedAt
            ? new Date(uploadedAt.getTime() + faker.number.int({ min: -30, max: 365 }) * 86400000)
            : null;
          const finalStatus = validTill && validTill < new Date() && status === 'UPLOADED' ? 'EXPIRED' : status;
          return prisma.mandatoryDocument.upsert({
            where: { schoolUdise_documentType: { schoolUdise: udise, documentType } },
            create: {
              schoolUdise: udise,
              documentType,
              status: finalStatus,
              fileUrl: finalStatus !== 'NOT_UPLOADED' ? `stub://${documentType.replace(/\s/g, '_')}.pdf` : null,
              uploadedAt,
              validTill,
            },
            update: {},
          });
        });
      }),
    );
  }
  console.log('✓ Mandatory Documents');

  // 15. Notifications + Preferences for school users
  const notifTemplates = [
    { type: 'CYCLE_OPENED' as const, title: 'Assessment Cycle Opened', body: 'The active SQAAF assessment cycle is now open. Please complete your self-assessment before the deadline.' },
    { type: 'SUBMISSION_RECEIVED' as const, title: 'Submission Received', body: 'Your self-assessment submission has been received and is under review.' },
    { type: 'REVIEW_COMMENT' as const, title: 'Evaluator Comment', body: 'An evaluator has left a clarification request on Domain 3. Please review and respond.' },
    { type: 'DEADLINE_REMINDER' as const, title: 'Deadline Reminder', body: 'Your SQAAF submission deadline is approaching in 7 days.' },
    { type: 'DISPUTE_FILED' as const, title: 'Dispute Update', body: 'A dispute related to your assessment has been logged for review.' },
  ];

  const schoolUsers = await prisma.user.findMany({
    where: { role: 'SCHOOL' },
    select: { id: true, username: true },
  });

  for (const batch of chunk(schoolUsers, 50)) {
    await prisma.$transaction(
      batch.flatMap((user) => {
        const count = faker.number.int({ min: 3, max: 5 });
        const picks = faker.helpers.arrayElements(notifTemplates, count);
        return picks.map((tpl, ni) =>
          prisma.notification.upsert({
            where: { id: `dummy_notif_${user.username}_${ni}` },
            create: {
              id: `dummy_notif_${user.username}_${ni}`,
              userId: user.id,
              type: tpl.type,
              title: tpl.title,
              body: tpl.body,
              read: ni > 1,
              createdAt: faker.date.recent({ days: 14 }),
            },
            update: {},
          }),
        );
      }),
    );
  }
  for (const batch of chunk(schoolUsers, 50)) {
    await prisma.$transaction(
      batch.map((user) =>
        prisma.notificationPreference.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            emailAlerts: true,
            smsAlerts: faker.datatype.boolean({ probability: 0.2 }),
            disputeAlerts: true,
            cycleReminders: true,
          },
          update: {},
        }),
      ),
    );
  }
  console.log(`✓ Notifications + Preferences (${schoolUsers.length} users)`);

  console.log('\n🎉 Dummy seed complete!');
  console.log('Credentials:');
  console.log('  School users: <UDISE> / school123');
  console.log('  Verifiers: verifier_lko_1 / verifier123  (and similar for VNS, PRG, KNP, GKP)');
  console.log('  District admins: district_lucknow / district123  (etc.)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
