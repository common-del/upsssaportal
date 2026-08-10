/**
 * Gives verifiers a caseload big enough to say anything about.
 *
 * The register holds 32,579 schools but only 82 verifications had ever been
 * completed, spread across 14 verifiers — the largest caseload was 16. Two pages
 * depend on that number being realistic:
 *
 * "Appeals by verifier" only lists verifiers with at least 20 completed
 * verifications, so it stayed hidden however many appeals existed. That
 * threshold is not the problem — one appeal against three verifications is 33%
 * and means nothing, which is exactly what it is there to stop the page
 * claiming. The problem was that no verifier had done enough work to be measured.
 *
 * This walks the same pipeline a real school does: self-assessment, assignment,
 * verification, result. Scores are computed with the same domain-weighted
 * formula seed-dummy.ts uses, not filled in, so the numbers on the appeal rows
 * are the numbers those responses actually produce.
 *
 *   npx tsx prisma/seedVerificationActivity.ts --dry-run
 *   npx tsx prisma/seedVerificationActivity.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Enough to clear MIN_VERIFICATIONS_FOR_RATE in lib/sssa/appeals.ts with room
 *  over, so a verifier is measurable rather than borderline. */
const TARGET_PER_VERIFIER = 28;
/** Kept deliberately small. This is demo depth, not a load test, and every row
 *  written here is a self-assessment and a verification worth of responses. */
const VERIFIERS_TO_LOAD = 12;
const CHUNK = 2_000;

/** School.category values, mapped to the applicability codes parameters carry. */
const CATEGORY_TO_LEVEL: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const unit = (seed: string) => (hash(seed) % 1000) / 1000;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('No active cycle. Nothing to do.');
  const framework = await prisma.framework.findUnique({
    where: { cycleId: cycle.id },
    select: { id: true },
  });
  if (!framework) return console.log('No framework for the active cycle. Nothing to do.');

  const [params, rubrics, domains, gradeBands] = await Promise.all([
    prisma.parameter.findMany({
      where: { frameworkId: framework.id, isActive: true },
      select: {
        id: true,
        applicability: true,
        subDomain: { select: { domainId: true } },
        options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { key: true } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.rubricMapping.findMany({
      where: { frameworkId: framework.id },
      select: { parameterId: true, optionKey: true, score: true },
    }),
    prisma.sqaafDomain.findMany({
      where: { frameworkId: framework.id, isActive: true },
      select: { id: true, weightPercent: true },
    }),
    prisma.gradeBand.findMany({ where: { frameworkId: framework.id }, orderBy: { order: 'asc' } }),
  ]);

  if (params.length === 0 || rubrics.length === 0) {
    // Without a rubric every computed score is null, and a page of dashes is
    // worse than a page that says nothing was verified.
    return console.log(
      `Framework has ${params.length} parameters and ${rubrics.length} rubric mappings. ` +
        'Scores would come back null, so nothing is written.',
    );
  }

  const scoreOf = new Map(rubrics.map((r) => [`${r.parameterId}:${r.optionKey}`, r.score]));
  const weightOf = new Map(domains.map((d) => [d.id, d.weightPercent ?? 0]));

  /** The same domain-weighted formula seed-dummy.ts computes results with. */
  function computeScore(responses: Map<string, string>, applicable: typeof params) {
    const groups = new Map<string, { achieved: number; possible: number }>();
    for (const p of applicable) {
      const domainId = p.subDomain.domainId;
      if (!groups.has(domainId)) groups.set(domainId, { achieved: 0, possible: 0 });
      const g = groups.get(domainId)!;
      g.possible += Math.max(0, ...p.options.map((o) => scoreOf.get(`${p.id}:${o.key}`) ?? 0));
      const key = responses.get(p.id);
      if (key) g.achieved += scoreOf.get(`${p.id}:${key}`) ?? 0;
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [domainId, g] of groups) {
      const w = weightOf.get(domainId) ?? 0;
      if (w > 0 && g.possible > 0) {
        weightedSum += (g.achieved / g.possible) * w;
        totalWeight += w;
      }
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;
  }

  const bandFor = (score: number | null) => {
    if (score == null) return null;
    for (let i = 0; i < gradeBands.length; i++) {
      const b = gradeBands[i]!;
      const last = i === gradeBands.length - 1;
      if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) return b.key;
    }
    return null;
  };

  // Verifiers who already carry the most work, so this deepens real caseloads
  // instead of scattering a few schools across everyone.
  const verifiers = await prisma.user.findMany({
    where: { role: 'VERIFIER', active: true },
    select: { id: true, districtCode: true, verifierAssignments: { where: { cycleId: cycle.id }, select: { id: true } } },
  });
  if (verifiers.length === 0) return console.log('No verifiers. Nothing to do.');

  const chosen = [...verifiers]
    .sort((a, b) => b.verifierAssignments.length - a.verifierAssignments.length || (a.id < b.id ? -1 : 1))
    .slice(0, VERIFIERS_TO_LOAD);

  // Schools that have not started, so nothing already submitted is overwritten.
  const started = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const assigned = await prisma.verifierAssignment.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const taken = new Set([...started, ...assigned].map((s) => s.schoolUdise));

  const need = chosen.reduce((n, v) => n + Math.max(0, TARGET_PER_VERIFIER - v.verifierAssignments.length), 0);
  if (need === 0) return console.log('Every chosen verifier already has a full caseload. Nothing to do.');

  // Queried per district rather than once across all of them. A UDISE carries its
  // district in the leading digits, so a single `districtCode: { in: [...] }`
  // ordered by udise returns the first district's schools and then stops — every
  // verifier after the first would find an empty pool.
  const byDistrict = new Map<string, { udise: string; category: string }[]>();
  for (const districtCode of new Set(chosen.map((v) => v.districtCode).filter((d): d is string => !!d))) {
    const rows = await prisma.school.findMany({
      // Verifiers work their own district, so schools are drawn from theirs.
      where: { districtCode },
      select: { udise: true, category: true },
      take: TARGET_PER_VERIFIER * 6,
      orderBy: { udise: 'asc' },
    });
    byDistrict.set(districtCode, rows.filter((s) => !taken.has(s.udise)));
  }

  const availableCount = [...byDistrict.values()].reduce((n, r) => n + r.length, 0);
  console.log(
    `${chosen.length} verifiers to load; ${need} verifications needed; ` +
      `${availableCount} unstarted schools across ${byDistrict.size} districts.`,
  );
  if (availableCount === 0) return console.log('No unstarted schools in those districts. Nothing to do.');

  type Work = { udise: string; category: string; verifierId: string };
  const work: Work[] = [];
  const used = new Set<string>();
  for (const v of chosen) {
    const want = Math.max(0, TARGET_PER_VERIFIER - v.verifierAssignments.length);
    // A verifier with no district is skipped rather than given schools from
    // someone else's — a caseload spanning the state is not a caseload.
    const local = v.districtCode ? (byDistrict.get(v.districtCode) ?? []) : [];
    let n = 0;
    for (const s of local) {
      if (n >= want) break;
      if (used.has(s.udise)) continue;
      used.add(s.udise);
      work.push({ udise: s.udise, category: s.category, verifierId: v.id });
      n++;
    }
    if (n < want) console.log(`  only ${n} of ${want} available in ${v.districtCode ?? 'no district'}`);
  }

  if (work.length === 0) return console.log('Nothing to assign. Nothing to do.');
  console.log(`Building ${work.length} school journeys…`);

  if (dryRun) {
    const per = new Map<string, number>();
    for (const w of work) per.set(w.verifierId, (per.get(w.verifierId) ?? 0) + 1);
    for (const [id, n] of per) console.log(`  verifier ${id.slice(0, 8)}… +${n}`);
    return console.log('\n--dry-run: nothing written.');
  }

  const applicableFor = (category: string) => {
    const level = CATEGORY_TO_LEVEL[category] ?? 'PRIMARY';
    return params.filter((p) => (p.applicability as string[]).includes(level));
  };

  /** Schools rate themselves optimistically — skewed to the top of the option
   *  list, which is ordered best-first by the framework. */
  const selfKeyFor = (p: (typeof params)[number], udise: string) => {
    const r = unit(`self:${udise}:${p.id}`);
    const idx = r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
    return p.options[Math.min(idx, p.options.length - 1)]?.key ?? null;
  };

  /** Verifiers agree, or they mark down. Never up.
   *
   *  This used to move a school's answer up a quarter of the time, which looked
   *  like realistic disagreement and broke the process. A verification that
   *  raises a school's score gives it nothing to contest, so the appeal built on
   *  top of it read as a school arguing against a mark in its own favour — and
   *  where up-moves cancelled down-moves, a school appeared on Appeals with its
   *  self and verified scores identical.
   *
   *  How often a verifier disagrees varies by verifier, so caseloads are not
   *  interchangeable and one of them can be an outlier. */
  const verifierKeyFor = (
    p: (typeof params)[number],
    selfKey: string | null,
    udise: string,
    verifierId: string,
  ) => {
    if (!selfKey || p.options.length === 0) return selfKey;
    const strictness = 0.12 + (hash(`strict:${verifierId}`) % 18) / 100; // 0.12–0.29
    if (unit(`agree:${udise}:${p.id}`) > strictness) return selfKey;
    const idx = p.options.findIndex((o) => o.key === selfKey);
    if (idx === -1) return selfKey;
    // Options are ordered best-first, so the next index is the weaker option.
    return p.options[Math.min(p.options.length - 1, idx + 1)]!.key;
  };

  const saRows: { submissionId: string; parameterId: string; selectedOptionKey: string }[] = [];
  const vRows: { submissionId: string; parameterId: string; selectedOptionKey: string }[] = [];
  const results: {
    cycleId: string;
    schoolUdise: string;
    frameworkId: string;
    selfScorePercent: number | null;
    verifierScorePercent: number | null;
    finalScorePercent: number | null;
    gradeBandCode: string | null;
    publishedAt: Date;
  }[] = [];

  let done = 0;
  for (const w of work) {
    const applicable = applicableFor(w.category);
    if (applicable.length === 0) continue;

    const submittedAt = new Date(Date.now() - (20 + (hash(`sa:${w.udise}`) % 40)) * 86_400_000);
    const verifiedAt = new Date(submittedAt.getTime() + (3 + (hash(`v:${w.udise}`) % 18)) * 86_400_000);

    const sa = await prisma.selfAssessmentSubmission.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: w.udise,
        frameworkId: framework.id,
        status: 'SUBMITTED',
        startedAt: new Date(submittedAt.getTime() - 5 * 86_400_000),
        submittedAt,
      },
      select: { id: true },
    });

    const assignment = await prisma.verifierAssignment.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: w.udise,
        verifierUserId: w.verifierId,
        deadlineAt: new Date(verifiedAt.getTime() + 14 * 86_400_000),
      },
      select: { id: true },
    });

    const vSub = await prisma.verificationSubmission.create({
      data: {
        cycleId: cycle.id,
        schoolUdise: w.udise,
        frameworkId: framework.id,
        assignmentId: assignment.id,
        verifierUserId: w.verifierId,
        status: 'SUBMITTED',
        startedAt: new Date(verifiedAt.getTime() - 2 * 86_400_000),
        submittedAt: verifiedAt,
      },
      select: { id: true },
    });

    const selfMap = new Map<string, string>();
    const verifMap = new Map<string, string>();
    for (const p of applicable) {
      const selfKey = selfKeyFor(p, w.udise);
      if (!selfKey) continue;
      selfMap.set(p.id, selfKey);
      saRows.push({ submissionId: sa.id, parameterId: p.id, selectedOptionKey: selfKey });

      const vKey = verifierKeyFor(p, selfKey, w.udise, w.verifierId);
      if (!vKey) continue;
      verifMap.set(p.id, vKey);
      vRows.push({ submissionId: vSub.id, parameterId: p.id, selectedOptionKey: vKey });
    }

    const selfScore = computeScore(selfMap, applicable);
    const verifierScore = computeScore(verifMap, applicable);
    results.push({
      cycleId: cycle.id,
      schoolUdise: w.udise,
      frameworkId: framework.id,
      selfScorePercent: selfScore,
      verifierScorePercent: verifierScore,
      // Verification is the score of record once a verifier has submitted,
      // matching computeAndStoreResult.
      finalScorePercent: verifierScore,
      gradeBandCode: bandFor(verifierScore),
      publishedAt: verifiedAt,
    });

    if (++done % 50 === 0) console.log(`  ${done} / ${work.length} schools`);
  }

  for (let i = 0; i < saRows.length; i += CHUNK) {
    await prisma.selfAssessmentResponse.createMany({
      data: saRows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < vRows.length; i += CHUNK) {
    await prisma.verificationResponse.createMany({
      data: vRows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }
  // Upserted, not createMany with skipDuplicates. seedMockPerformanceSchools has
  // already written a Result row for most of these schools carrying a random score
  // and a hardcoded band, so skipping duplicates left those figures in place under
  // the genuine responses created above — self and verified then disagreed with the
  // answers that were supposed to produce them.
  for (const r of results) {
    const { cycleId, schoolUdise, ...rest } = r;
    await prisma.result.upsert({
      where: { cycleId_schoolUdise: { cycleId, schoolUdise } },
      create: r,
      update: rest,
    });
  }

  console.log(
    `\n✓ ${done} schools verified — ${saRows.length} self-assessment responses, ` +
      `${vRows.length} verification responses, ${results.length} results.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
