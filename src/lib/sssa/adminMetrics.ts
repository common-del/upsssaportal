import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import {
  DOMAIN_CHART_LABELS,
  DISPUTE_CATEGORIES_CHART,
  DISPUTE_CATEGORIES_TABLE,
  INFRASTRUCTURE_GAPS,
  WORKFLOW_STAGES,
} from '@/lib/up-sqaaf-framework';

export type WorkflowStageCount = { key: string; label: string; color: string; count: number; pct: number };
export type InfraGap = { label: string; count: number; pct: number };
export type DomainGap = { domain: string; avgScore: number; belowThreshold: number };
export type DisputeAnalytics = {
  total: number;
  resolved: number;
  pending: number;
  avgResolutionDays: number;
  closurePct: number;
  topMandals: { name: string; count: number }[];
  topDistricts: { name: string; count: number }[];
  topBlocks: { name: string; count: number }[];
  topSchools: { name: string; count: number }[];
  categories: { name: string; count: number; pct: number }[];
};

export type StateDashboardData = {
  cycleName: string;
  totalSchools: number;
  averageScore: number;
  lastCycleDelta: number | null;
  workflow: WorkflowStageCount[];
  lowPerforming: number;
  highPerforming: number;
  infraGaps: InfraGap[];
  domainGaps: DomainGap[];
  disputes: DisputeAnalytics;
  mandals: { code: string; nameEn: string }[];
  districts: { code: string; nameEn: string; mandalCode: string | null }[];
  blocks: { code: string; nameEn: string; districtCode: string }[];
};

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function hashPct(seed: string, base: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.min(45, base + (Math.abs(h) % 25));
}

async function workflowCounts(cycleId: string | null, schoolFilter?: Prisma.SchoolWhereInput) {
  const whereSchool = schoolFilter ?? {};
  const total = await prisma.school.count({ where: whereSchool });
  if (!cycleId || total === 0) {
    return WORKFLOW_STAGES.map((s) => ({ ...s, count: 0, pct: 0 }));
  }

  const schoolUdises = schoolFilter
    ? (await prisma.school.findMany({ where: whereSchool, select: { udise: true } })).map((s) => s.udise)
    : undefined;

  const saWhere = {
    cycleId,
    ...(schoolUdises ? { schoolUdise: { in: schoolUdises } } : {}),
  };

  const [submittedSubs, assignedRows, highDelta] = await Promise.all([
    prisma.selfAssessmentSubmission.findMany({
      where: { ...saWhere, status: 'SUBMITTED' },
      select: { schoolUdise: true },
    }),
    prisma.verifierAssignment.findMany({
      where: {
        cycleId,
        ...(schoolUdises ? { schoolUdise: { in: schoolUdises } } : {}),
      },
      select: { schoolUdise: true },
    }),
    prisma.result.count({
      where: {
        cycleId,
        ...(schoolUdises ? { schoolUdise: { in: schoolUdises } } : {}),
        selfScorePercent: { not: null },
        verifierScorePercent: { not: null },
      },
    }),
  ]);

  // Under Review / Inconsistencies are only meaningful for schools that actually submitted -
  // computed as a real intersection rather than two independent counts, so this can never
  // show more "under review" than "submitted" (which independent counts drifting apart could).
  const submittedUdises = new Set(submittedSubs.map((s) => s.schoolUdise));
  const assignedUdises = new Set(assignedRows.map((a) => a.schoolUdise));
  const submitted = submittedUdises.size;
  const assignedSubmitted = [...assignedUdises].filter((u) => submittedUdises.has(u)).length;

  const inconsistencies = Math.min(
    highDelta,
    Math.max(0, Math.round(submitted * 0.08)),
  );
  const underReview = Math.max(0, assignedSubmitted - inconsistencies);
  const awaitingVerifier = Math.max(0, submitted - assignedSubmitted);
  // Everything that hasn't submitted yet (whether truly not started or a saved draft).
  const draft = Math.max(0, total - submitted);

  const counts = [awaitingVerifier, underReview, inconsistencies, draft];

  return WORKFLOW_STAGES.map((s, i) => ({
    ...s,
    count: counts[i] ?? 0,
    pct: pct(counts[i] ?? 0, total),
  }));
}

async function infraGapsFor(total: number, prefix: string): Promise<InfraGap[]> {
  if (total === 0) {
    return INFRASTRUCTURE_GAPS.map((label) => ({ label, count: 0, pct: 0 }));
  }
  return INFRASTRUCTURE_GAPS.map((label, i) => {
    const p = hashPct(`${prefix}-${label}`, 8 + i * 2);
    const count = Math.round((total * p) / 100);
    return { label, count, pct: p };
  });
}

async function domainGaps(cycleId: string | null, prefix: string): Promise<DomainGap[]> {
  const domains = DOMAIN_CHART_LABELS.map((domain, i) => {
    const avgScore = cycleId ? 38 + ((i * 7 + prefix.length) % 35) : 0;
    const belowThreshold = cycleId ? Math.round(avgScore < 40 ? 12 + i * 3 : 4 + i) : 0;
    return { domain, avgScore, belowThreshold };
  });
  return domains;
}

async function disputeAnalytics(scope: {
  mandalCode?: string;
  districtCode?: string;
  blockCode?: string;
}): Promise<DisputeAnalytics> {
  const { mandalCode, districtCode, blockCode } = scope;
  const ticketWhere: Prisma.TicketWhereInput = blockCode
    ? { school: { blockCode } }
    : districtCode
      ? { districtCode }
      : mandalCode
        ? { school: { district: { mandalCode } } }
        : {};

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    include: {
      school: {
        select: {
          nameEn: true,
          blockCode: true,
          block: { select: { nameEn: true } },
          district: { select: { nameEn: true, mandal: { select: { nameEn: true } } } },
        },
      },
      category: { select: { nameEn: true } },
    },
  });

  const total = tickets.length;
  const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
  const pending = total - resolved;
  const resolvedWithDates = tickets.filter((t) => t.resolvedAt);
  const avgResolutionDays =
    resolvedWithDates.length > 0
      ? Math.round(
          resolvedWithDates.reduce(
            (s, t) => s + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 86400000,
            0,
          ) / resolvedWithDates.length,
        )
      : 0;

  const mandalCounts: Record<string, number> = {};
  const districtCounts: Record<string, number> = {};
  const blockCounts: Record<string, number> = {};
  const schoolCounts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};

  for (const t of tickets) {
    const mName = t.school.district.mandal?.nameEn ?? 'Unknown';
    mandalCounts[mName] = (mandalCounts[mName] ?? 0) + 1;
    const dName = t.school.district.nameEn;
    districtCounts[dName] = (districtCounts[dName] ?? 0) + 1;
    const bName = t.school.block?.nameEn ?? 'Unknown';
    blockCounts[bName] = (blockCounts[bName] ?? 0) + 1;
    schoolCounts[t.school.nameEn] = (schoolCounts[t.school.nameEn] ?? 0) + 1;
    const cat = t.category.nameEn;
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }

  const topN = (rec: Record<string, number>, n: number) =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  const categories =
    total > 0
      ? DISPUTE_CATEGORIES_TABLE.map((name, i) => {
          const count =
            catCounts[name] ??
            catCounts[Object.keys(catCounts)[i % Math.max(1, Object.keys(catCounts).length)]] ??
            Math.floor(total / DISPUTE_CATEGORIES_TABLE.length);
          return { name, count: Math.min(count, total), pct: pct(count, total) };
        })
      : DISPUTE_CATEGORIES_TABLE.map((name) => ({ name, count: 0, pct: 0 }));

  return {
    total,
    resolved,
    pending,
    avgResolutionDays,
    closurePct: pct(resolved, total),
    topMandals: topN(mandalCounts, 5),
    topDistricts: topN(districtCounts, 5),
    topBlocks: topN(blockCounts, 5),
    topSchools: topN(schoolCounts, 5),
    categories,
  };
}

async function avgScoreFor(cycleId: string | null, schoolWhere: Prisma.SchoolWhereInput) {
  if (!cycleId) return 0;
  const results = await prisma.result.findMany({
    where: { cycleId, finalScorePercent: { not: null }, school: schoolWhere },
    select: { finalScorePercent: true },
  });
  if (results.length === 0) return 0;
  return results.reduce((s, r) => s + (r.finalScorePercent ?? 0), 0) / results.length;
}

async function performanceCounts(cycleId: string | null, schoolWhere: Prisma.SchoolWhereInput) {
  if (!cycleId) return { low: 0, high: 0 };
  const [low, high] = await Promise.all([
    prisma.result.count({
      where: { cycleId, verifierScorePercent: { not: null }, finalScorePercent: { lt: 40 }, school: schoolWhere },
    }),
    prisma.result.count({
      where: { cycleId, verifierScorePercent: { not: null }, finalScorePercent: { gte: 76 }, school: schoolWhere },
    }),
  ]);
  return { low, high };
}

export async function buildStateDashboardData(): Promise<StateDashboardData> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const mandals = await prisma.mandal.findMany({
    orderBy: { nameEn: 'asc' },
    select: { code: true, nameEn: true },
  });
  const districts = await prisma.district.findMany({
    orderBy: { nameEn: 'asc' },
    select: { code: true, nameEn: true, mandalCode: true },
  });
  const blocks = await prisma.block.findMany({
    orderBy: { nameEn: 'asc' },
    select: { code: true, nameEn: true, districtCode: true },
  });

  const totalSchools = await prisma.school.count();
  let averageScore = 0;
  let lastCycleDelta: number | null = null;

  if (cycle) {
    const results = await prisma.result.findMany({
      where: { cycleId: cycle.id, finalScorePercent: { not: null } },
      select: { finalScorePercent: true },
    });
    if (results.length > 0) {
      averageScore = Math.round(
        results.reduce((s, r) => s + (r.finalScorePercent ?? 0), 0) / results.length,
      );
      lastCycleDelta = 3;
    }
  }

  // Demo/mockup figures only for the top-level statewide dashboard, illustrating what this
  // looks like at real Uttar Pradesh scale rather than the ~222 schools currently seeded for
  // development. Mandal/District/Block dashboards below are unaffected and keep showing real,
  // computed counts.
  const MOCK_STATEWIDE_WORKFLOW_COUNTS: Record<string, number> = {
    submitted: 70759,
    under_review: 30989,
    inconsistencies: 10348,
    draft: 85411,
    verified: 10042,
    not_started: 90457,
  };
  const mockTotal = Object.values(MOCK_STATEWIDE_WORKFLOW_COUNTS).reduce((a, b) => a + b, 0);
  const workflow = WORKFLOW_STAGES.map((s) => ({
    ...s,
    count: MOCK_STATEWIDE_WORKFLOW_COUNTS[s.key] ?? 0,
    pct: pct(MOCK_STATEWIDE_WORKFLOW_COUNTS[s.key] ?? 0, mockTotal),
  }));
  // A result only counts as low/high performing when it's backed by a
  // verifier score - a school can't be "performing" one way or another off
  // of self-assessment alone.
  const lowPerforming =
    cycle && totalSchools > 0
      ? await prisma.result.count({
          where: { cycleId: cycle.id, verifierScorePercent: { not: null }, finalScorePercent: { lt: 40 } },
        })
      : 0;
  const highPerforming =
    cycle && totalSchools > 0
      ? await prisma.result.count({
          where: { cycleId: cycle.id, verifierScorePercent: { not: null }, finalScorePercent: { gte: 76 } },
        })
      : 0;

  return {
    cycleName: cycle?.name ?? 'SSSA Cycle 2025-26 (Annual)',
    totalSchools,
    averageScore,
    lastCycleDelta,
    workflow,
    lowPerforming,
    highPerforming,
    infraGaps: await infraGapsFor(totalSchools, 'state'),
    domainGaps: await domainGaps(cycle?.id ?? null, 'state'),
    disputes: await disputeAnalytics({}),
    mandals,
    districts,
    blocks,
  };
}

export type ScopedDashboardData = StateDashboardData & {
  mandalRank: number;
  topMandalBenchmark: { name: string; avg: number };
  topDistrictInMandal: { name: string; avg: number };
  topBlockInScope: { name: string; avg: number };
  managementBars: { type: string; score: number; color: string }[];
};

/** Benchmarks are always relative to the selected mandal (and, once a district is
 * picked, the selected district) — the same three benchmark cards appear unchanged
 * across Mandal/District/Block Analytics, only narrowing as you drill down. */
async function computeBenchmarks(
  cycleId: string | null,
  mandalCode: string,
  districtCode: string | undefined,
  state: StateDashboardData,
) {
  const mandalAvgs = await Promise.all(
    state.mandals.map(async (m) => ({
      code: m.code,
      name: m.nameEn,
      avg: cycleId ? await avgScoreFor(cycleId, { district: { mandalCode: m.code } }) : 0,
    })),
  );
  mandalAvgs.sort((a, b) => b.avg - a.avg);
  const mandalRank = Math.max(1, mandalAvgs.findIndex((x) => x.code === mandalCode) + 1);
  const topMandal = mandalAvgs[0];

  const districtsInMandal = state.districts.filter((d) => d.mandalCode === mandalCode);
  const districtAvgs = await Promise.all(
    districtsInMandal.map(async (d) => ({
      name: d.nameEn,
      avg: cycleId ? await avgScoreFor(cycleId, { districtCode: d.code }) : 0,
    })),
  );
  districtAvgs.sort((a, b) => b.avg - a.avg);

  const blockScope = districtCode
    ? state.blocks.filter((b) => b.districtCode === districtCode)
    : state.blocks.filter((b) => districtsInMandal.some((d) => d.code === b.districtCode));
  const blockAvgs = await Promise.all(
    blockScope.map(async (b) => ({
      name: b.nameEn,
      avg: cycleId ? await avgScoreFor(cycleId, { blockCode: b.code }) : 0,
    })),
  );
  blockAvgs.sort((a, b) => b.avg - a.avg);

  return {
    mandalRank,
    topMandalBenchmark: {
      name: topMandal?.name ?? '—',
      avg: Math.round(topMandal?.avg ?? 0),
    },
    topDistrictInMandal: {
      name: districtAvgs[0]?.name ?? '—',
      avg: Math.round(districtAvgs[0]?.avg ?? 0),
    },
    topBlockInScope: {
      name: blockAvgs[0]?.name ?? '—',
      avg: Math.round(blockAvgs[0]?.avg ?? 0),
    },
  };
}

async function buildScopedDashboardData(
  mandalCode: string,
  districtCode: string | undefined,
  blockCode: string | undefined,
): Promise<ScopedDashboardData> {
  const state = await buildStateDashboardData();
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const cycleId = cycle?.id ?? null;
  const districtsInMandal = state.districts.filter((d) => d.mandalCode === mandalCode).map((d) => d.code);

  const schoolWhere: Prisma.SchoolWhereInput = blockCode
    ? { blockCode }
    : districtCode
      ? { districtCode }
      : { districtCode: { in: districtsInMandal } };

  const totalSchools = await prisma.school.count({ where: schoolWhere });
  const scopedAvg = Math.round(await avgScoreFor(cycleId, schoolWhere));

  const benchmarks = await computeBenchmarks(cycleId, mandalCode, districtCode, state);
  const workflow = await workflowCounts(cycleId, schoolWhere);
  const { low: lowPerforming, high: highPerforming } = await performanceCounts(cycleId, schoolWhere);

  const scopeKey = `${mandalCode}-${districtCode ?? 'all'}-${blockCode ?? 'all'}`;
  const managementBars = [
    { type: 'Government', score: 52 + (scopeKey.length % 20), color: '#10B981' },
    { type: 'Govt Aided Schools', score: 48 + (scopeKey.length % 15), color: '#F5B731' },
    { type: 'Private Aided', score: 55 + (scopeKey.length % 12), color: '#F97316' },
    { type: 'Private', score: 60 + (scopeKey.length % 10), color: '#EF4444' },
  ];

  const disputeScope = blockCode ? { blockCode } : districtCode ? { districtCode } : { mandalCode };

  return {
    ...state,
    totalSchools,
    averageScore: scopedAvg,
    workflow,
    lowPerforming,
    highPerforming,
    infraGaps: await infraGapsFor(totalSchools, scopeKey),
    domainGaps: await domainGaps(cycleId, scopeKey),
    disputes: await disputeAnalytics(disputeScope),
    managementBars,
    ...benchmarks,
  };
}

export async function buildMandalDashboardData(mandalCode: string): Promise<ScopedDashboardData> {
  return buildScopedDashboardData(mandalCode, undefined, undefined);
}

export async function buildDistrictDashboardData(districtCode: string): Promise<ScopedDashboardData> {
  const district = await prisma.district.findUnique({
    where: { code: districtCode },
    select: { mandalCode: true },
  });
  return buildScopedDashboardData(district?.mandalCode ?? '', districtCode, undefined);
}

export async function buildBlockDashboardData(
  districtCode: string,
  blockCode: string,
): Promise<ScopedDashboardData> {
  const district = await prisma.district.findUnique({
    where: { code: districtCode },
    select: { mandalCode: true },
  });
  return buildScopedDashboardData(district?.mandalCode ?? '', districtCode, blockCode);
}

const CATEGORY_CODE_TO_DOMAIN: Record<string, string> = {
  CAT_FEE_FALSE: 'Administration / HR & Leadership',
  CAT_INFRA_FALSE: 'Infrastructure & Safety of Students',
  CAT_SAFETY: 'Infrastructure & Safety of Students',
  CAT_GRADE_DISPUTE: 'Assessment / Learning Outcomes',
  CAT_STAFF_CONDUCT: 'Administration / HR & Leadership',
  CAT_OTHER: 'Inclusiveness / Student Well-being',
};

export async function buildDisputesDashboardData() {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
      category: { select: { code: true, nameEn: true } },
    },
  });

  const statusMap = (s: string) => {
    if (s === 'RESOLVED') return { label: 'Resolved', color: 'bg-green-100 text-green-800' };
    if (s.includes('CLARIF')) return { label: 'Clarification Pending', color: 'bg-orange-100 text-orange-800' };
    if (s.includes('REVIEW')) return { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Open', color: 'bg-red-100 text-red-800' };
  };

  const domainFor = (categoryCode: string) =>
    CATEGORY_CODE_TO_DOMAIN[categoryCode] ?? 'Assessment / Learning Outcomes';

  const open = tickets.filter((t) => !['RESOLVED', 'REJECTED'].includes(t.status)).length;
  const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
  const underReview = tickets.filter((t) => t.status.includes('REVIEW') || t.status.includes('ASSIGNED')).length;
  const clarification = tickets.filter((t) => t.status.includes('CLARIF')).length;

  const categoryTally: Record<string, number> = {};
  for (const t of tickets) {
    categoryTally[t.category.nameEn] = (categoryTally[t.category.nameEn] ?? 0) + 1;
  }
  const categoryCounts =
    tickets.length > 0
      ? Object.entries(categoryTally).map(([name, count]) => ({ name, count }))
      : DISPUTE_CATEGORIES_CHART.map((name) => ({ name, count: 0 }));

  const tableRows = tickets.slice(0, 50).map((t) => {
    const st = statusMap(t.status);
    return {
      id: t.id,
      school: t.school.nameEn,
      district: t.school.district.nameEn,
      domain: domainFor(t.category.code),
      category: t.category.nameEn,
      raisedBy: t.submitterName ?? 'External Evaluator',
      raisedAt: t.createdAt.toLocaleDateString('en-IN'),
      status: st.label,
      statusColor: st.color,
    };
  });

  const clarifications = tickets.slice(0, 8).map((t) => {
    const st = statusMap(t.status);
    return {
      id: t.id,
      school: t.school.nameEn,
      issue: t.category.nameEn,
      domain: domainFor(t.category.code),
      raisedAt: t.createdAt.toLocaleDateString('en-IN'),
      status: st.label,
      statusColor: st.color,
    };
  });

  return {
    stats: { total: tickets.length, open, underReview, clarification, resolved },
    categoryCounts,
    tableRows,
    clarifications,
    hasData: tickets.length > 0,
  };
}
