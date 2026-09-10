import { prisma } from '@/lib/db';
import { bandForScore } from './bands';
import { getEscalationInbox } from '@/lib/actions/supervisor';

/**
 * The Decisions inbox: every ruling waiting on the admin, in one list.
 *
 * Three kinds of pending decision used to live on three sidebar pages that looked
 * identical because they are identical in shape — a heading over a list of things
 * one person must rule on. This assembles all three, worst first:
 *
 * - APPEAL: a school contests its verified result, after publication.
 * - ESCALATION: an online verifier cannot judge one indicator against the rubric,
 *   mid desk screening; the case is frozen until the ruling.
 * - DISCREPANCY: the pipeline found a signed-off field visit differing from the
 *   school's claim, before publication; the run cannot publish until ruled.
 *
 * Audit is deliberately absent: it is a blind re-check of finished work, and mixing
 * it in would put the primary findings a click away from the person meant not to
 * see them before submitting.
 */

export type AppealDecision = {
  kind: 'APPEAL';
  key: string;
  udise: string;
  school: string;
  district: string;
  block: string;
  selfScore: number | null;
  selfBand: string | null;
  verifiedScore: number | null;
  verifiedBand: string | null;
  /** Indicators the school is arguing, one AppealItem each. */
  contested: number;
  /** The school's written justification, first non-empty item, for the focus card.
   *  The full argument lives on the appeal screen. */
  grounds: string | null;
  /** Who signed off the verification being contested; null when unresolvable. */
  verifierName: string | null;
  waitingDays: number;
};

export type EscalationDecision = {
  kind: 'ESCALATION';
  key: string;
  runId: string;
  parameterId: string;
  parameterCode: string;
  parameterTitle: string;
  school: string;
  district: string;
  verifierName: string;
  rationale: string | null;
  claimedLevel: number | null;
  waitingDays: number;
};

export type DiscrepancyResponseState = 'RESPONDED' | 'WINDOW_OPEN' | 'WINDOW_CLOSED' | 'NOT_OPENED';

export type DiscrepancyDecision = {
  kind: 'DISCREPANCY';
  key: string;
  runId: string;
  school: string;
  district: string;
  /** Indicators the field visit found below the claim. */
  found: number;
  /** Indicators the visit checked in total; null when no signed-off visit resolved. */
  checked: number | null;
  fieldVerifierName: string | null;
  response: DiscrepancyResponseState;
  respondedDaysAgo: number | null;
  windowDaysLeft: number | null;
  /** The school's reply, for the card's quote slot; null when it has not replied. */
  responseBody: string | null;
  /** Set when the window closed unanswered, so the card can say when. */
  windowClosedOn: string | null;
  waitingDays: number;
};

export type DecisionRow = AppealDecision | EscalationDecision | DiscrepancyDecision;

/** The Overview tab's standing signals, all derived or counted cheaply. */
export type DecisionsOverview = {
  ageBands: { over14: number; oneToTwo: number; under7: number };
  ruledThisWeek: number;
  /** Districts carrying the queue, biggest first, capped at three. */
  districts: { name: string; count: number }[];
  otherDistrictsCount: number;
  appealsDecided: { decided: number; upheld: number; dismissed: number };
  /** Median days from submission to decision across this cycle's decided appeals. */
  medianDaysToDecideAppeal: number | null;
  mostEscalated: { code: string; title: string; times: number } | null;
};

export type DecisionsInboxData = {
  /** Sorted by waiting time, longest first. */
  rows: DecisionRow[];
  counts: {
    total: number;
    appeals: number;
    escalations: number;
    discrepancies: number;
    /** Discrepancies block publication; the summary line names them separately. */
    blocking: number;
    oldestDays: number;
  };
  overview: DecisionsOverview;
};

export function daysSince(from: Date | string | null | undefined, now: number): number {
  if (!from) return 0;
  const t = typeof from === 'string' ? Date.parse(from) : from.getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

const EMPTY_OVERVIEW: DecisionsOverview = {
  ageBands: { over14: 0, oneToTwo: 0, under7: 0 },
  ruledThisWeek: 0,
  districts: [],
  otherDistrictsCount: 0,
  appealsDecided: { decided: 0, upheld: 0, dismissed: 0 },
  medianDaysToDecideAppeal: null,
  mostEscalated: null,
};

const EMPTY: DecisionsInboxData = {
  rows: [],
  counts: { total: 0, appeals: 0, escalations: 0, discrepancies: 0, blocking: 0, oldestDays: 0 },
  overview: EMPTY_OVERVIEW,
};

export async function buildDecisionsInbox(): Promise<DecisionsInboxData> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return EMPTY;
  const now = Date.now();

  const [appealRows, escalationRows, discrepancyRuns, config] = await Promise.all([
    // Pending means a decision is owed: mirrors the old Appeals tab exactly — an
    // appeal past DRAFT with at least one undecided item.
    prisma.appeal.findMany({
      where: { cycleId: cycle.id, status: { notIn: ['DRAFT'] }, items: { some: { decision: 'PENDING' } } },
      select: {
        schoolUdise: true,
        submittedAt: true,
        createdAt: true,
        items: { select: { schoolJustification: true } },
        school: {
          select: {
            nameEn: true,
            district: { select: { nameEn: true } },
            block: { select: { nameEn: true } },
          },
        },
      },
      take: 300,
    }),
    getEscalationInbox(),
    prisma.assessmentCycleRun.findMany({
      where: { state: { in: ['DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'] } },
      select: {
        id: true,
        state: true,
        enteredStateAt: true,
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
        discrepancies: { select: { id: true } },
        responses: { select: { submittedAt: true, body: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
        fieldVisits: {
          where: { signedOffAt: { not: null } },
          orderBy: { signedOffAt: 'desc' },
          take: 1,
          select: {
            findings: { select: { id: true } },
            profile: { select: { user: { select: { name: true, username: true } } } },
          },
        },
      },
      orderBy: { enteredStateAt: 'asc' },
      take: 300,
    }),
    prisma.programmeConfig.findUnique({
      where: { id: 'current' },
      select: { schoolResponseWindowDays: true },
    }),
  ]);

  const udises = appealRows.map((a) => a.schoolUdise);
  const [results, gradeBands, verifSubs] = udises.length
    ? await Promise.all([
        prisma.result.findMany({
          where: { cycleId: cycle.id, schoolUdise: { in: udises } },
          select: { schoolUdise: true, selfScorePercent: true, verifierScorePercent: true },
        }),
        prisma.gradeBand.findMany({
          where: { framework: { cycleId: cycle.id } },
          select: { labelEn: true, minPercent: true, maxPercent: true },
          orderBy: { order: 'asc' },
        }),
        prisma.verificationSubmission.findMany({
          where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: 'SUBMITTED' },
          select: { schoolUdise: true, verifier: { select: { name: true, username: true } } },
        }),
      ])
    : [[], [], []];

  const resultBy = new Map(results.map((r) => [r.schoolUdise, r]));
  const verifierBy = new Map(verifSubs.map((v) => [v.schoolUdise, v.verifier]));

  const appeals: AppealDecision[] = appealRows.map((a) => {
    const r = resultBy.get(a.schoolUdise);
    const verifier = verifierBy.get(a.schoolUdise);
    return {
      kind: 'APPEAL',
      key: `appeal:${a.schoolUdise}`,
      udise: a.schoolUdise,
      school: a.school.nameEn,
      district: a.school.district?.nameEn ?? '',
      block: a.school.block?.nameEn ?? '',
      selfScore: r?.selfScorePercent ?? null,
      selfBand: bandForScore(gradeBands, r?.selfScorePercent ?? null),
      verifiedScore: r?.verifierScorePercent ?? null,
      verifiedBand: bandForScore(gradeBands, r?.verifierScorePercent ?? null),
      contested: a.items.length,
      grounds: a.items.map((i) => i.schoolJustification?.trim()).find((j) => j) ?? null,
      verifierName: verifier ? (verifier.name ?? verifier.username) : null,
      waitingDays: daysSince(a.submittedAt ?? a.createdAt, now),
    };
  });

  const escalations: EscalationDecision[] = escalationRows.map((e) => ({
    kind: 'ESCALATION',
    key: `escalation:${e.runId}:${e.parameterId}`,
    runId: e.runId,
    parameterId: e.parameterId,
    parameterCode: e.parameterCode,
    parameterTitle: e.parameterTitle,
    school: e.schoolName,
    district: e.districtName,
    verifierName: e.verifierName,
    rationale: e.rationale,
    claimedLevel: e.claimedLevel,
    waitingDays: daysSince(e.escalatedAt, now),
  }));

  const windowDays = config?.schoolResponseWindowDays ?? 7;
  const discrepancies: DiscrepancyDecision[] = discrepancyRuns.map((r) => {
    const visit = r.fieldVisits[0];
    const response = r.responses[0];
    const closesAt = r.enteredStateAt.getTime() + windowDays * 86_400_000;

    let state: DiscrepancyResponseState;
    let respondedDaysAgo: number | null = null;
    let windowDaysLeft: number | null = null;
    let windowClosedOn: string | null = null;
    if (response) {
      state = 'RESPONDED';
      respondedDaysAgo = daysSince(response.submittedAt, now);
    } else if (r.state === 'SCHOOL_RESPONSE_WINDOW') {
      if (closesAt > now) {
        state = 'WINDOW_OPEN';
        windowDaysLeft = Math.max(0, Math.ceil((closesAt - now) / 86_400_000));
      } else {
        state = 'WINDOW_CLOSED';
        windowClosedOn = new Date(closesAt).toISOString();
      }
    } else {
      state = 'NOT_OPENED';
    }

    const user = visit?.profile.user;
    return {
      kind: 'DISCREPANCY',
      key: `discrepancy:${r.id}`,
      runId: r.id,
      school: r.school.nameEn,
      district: r.school.district?.nameEn ?? '',
      found: r.discrepancies.length,
      checked: visit ? visit.findings.length : null,
      fieldVerifierName: user ? (user.name ?? user.username) : null,
      response: state,
      respondedDaysAgo,
      windowDaysLeft,
      responseBody: response?.body ?? null,
      windowClosedOn,
      waitingDays: daysSince(r.enteredStateAt, now),
    } satisfies DiscrepancyDecision;
  });

  const rows: DecisionRow[] = [...appeals, ...escalations, ...discrepancies].sort(
    (a, b) => b.waitingDays - a.waitingDays || a.school.localeCompare(b.school),
  );

  // ── The Overview's standing signals ────────────────────────────────────────
  const weekAgo = new Date(now - 7 * 86_400_000);
  const [decidedAppeals, ruledEscalationsThisWeek, ruledDiscrepancyRuns, escalationHistory] =
    await Promise.all([
      prisma.appeal.findMany({
        where: { cycleId: cycle.id, status: 'DECIDED', decidedAt: { not: null } },
        select: { decidedAt: true, submittedAt: true, items: { select: { decision: true } } },
        take: 1000,
      }),
      // A resolved escalation keeps its escalatedAt and loses its flag; updatedAt is when
      // the ruling landed.
      prisma.deskScreeningDecision.count({
        where: { escalated: false, escalatedAt: { not: null }, updatedAt: { gte: weekAgo } },
      }),
      prisma.discrepancy.findMany({
        where: { upheldAt: { gte: weekAgo } },
        select: { runId: true },
        distinct: ['runId'],
      }),
      prisma.deskScreeningDecision.findMany({
        where: { escalatedAt: { not: null }, run: { cycleId: cycle.id } },
        select: { parameterId: true, parameter: { select: { code: true, titleEn: true } } },
        take: 500,
      }),
    ]);

  const ageBands = { over14: 0, oneToTwo: 0, under7: 0 };
  for (const r of rows) {
    if (r.waitingDays >= 14) ageBands.over14 += 1;
    else if (r.waitingDays >= 7) ageBands.oneToTwo += 1;
    else ageBands.under7 += 1;
  }

  const byDistrict = new Map<string, number>();
  for (const r of rows) {
    const name = r.district || 'Unknown';
    byDistrict.set(name, (byDistrict.get(name) ?? 0) + 1);
  }
  const districtsSorted = [...byDistrict.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  // Upheld means at least one indicator went the school's way.
  const upheld = decidedAppeals.filter((a) =>
    a.items.some((i) => i.decision === 'ACCEPT_SCHOOL'),
  ).length;

  const decideDurations = decidedAppeals
    .filter((a) => a.decidedAt && a.submittedAt)
    .map((a) => Math.max(0, Math.floor((a.decidedAt!.getTime() - a.submittedAt!.getTime()) / 86_400_000)))
    .sort((a, b) => a - b);
  const mid = decideDurations.length;
  const medianDaysToDecideAppeal =
    mid === 0
      ? null
      : mid % 2
        ? decideDurations[(mid - 1) / 2]!
        : Math.round((decideDurations[mid / 2 - 1]! + decideDurations[mid / 2]!) / 2);

  const escCounts = new Map<string, { code: string; title: string; times: number }>();
  for (const e of escalationHistory) {
    const cur = escCounts.get(e.parameterId) ?? {
      code: e.parameter.code,
      title: e.parameter.titleEn,
      times: 0,
    };
    cur.times += 1;
    escCounts.set(e.parameterId, cur);
  }
  const mostEscalated =
    [...escCounts.values()].sort((a, b) => b.times - a.times || a.code.localeCompare(b.code))[0] ??
    null;

  const overview: DecisionsOverview = {
    ageBands,
    ruledThisWeek:
      decidedAppeals.filter((a) => a.decidedAt && a.decidedAt >= weekAgo).length +
      ruledEscalationsThisWeek +
      ruledDiscrepancyRuns.length,
    districts: districtsSorted.slice(0, 3).map(([name, count]) => ({ name, count })),
    otherDistrictsCount: districtsSorted.slice(3).reduce((sum, [, count]) => sum + count, 0),
    appealsDecided: {
      decided: decidedAppeals.length,
      upheld,
      dismissed: decidedAppeals.length - upheld,
    },
    medianDaysToDecideAppeal,
    mostEscalated,
  };

  return {
    rows,
    counts: {
      total: rows.length,
      appeals: appeals.length,
      escalations: escalations.length,
      discrepancies: discrepancies.length,
      blocking: discrepancies.length,
      oldestDays: rows[0]?.waitingDays ?? 0,
    },
    overview,
  };
}

/** The sidebar badge: how many rulings are waiting, cheaply. Same predicates as the
 *  full build, counted instead of fetched. */
export async function countDecisions(): Promise<number> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return 0;
  const [appeals, escalations, discrepancies] = await Promise.all([
    prisma.appeal.count({
      where: { cycleId: cycle.id, status: { notIn: ['DRAFT'] }, items: { some: { decision: 'PENDING' } } },
    }),
    prisma.deskScreeningDecision.count({ where: { escalated: true } }),
    prisma.assessmentCycleRun.count({
      where: { state: { in: ['DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'] } },
    }),
  ]);
  return appeals + escalations + discrepancies;
}
