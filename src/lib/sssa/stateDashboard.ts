import { prisma } from '@/lib/db';
import { MANAGEMENT_CODES, MANAGEMENT_LABELS, type ManagementCode } from '@/lib/schoolManagement';
import {
  MIN_SCHOOLS_FOR_DISTRICT_RANK,
  rankDistricts,
  round1,
  standingFrom,
  type RankedDistrict,
  type Standing,
} from '@/lib/sssa/districtRanking';

/**
 * The state dashboard: how far the cycle has got, and what the verified half of it looks like.
 *
 * It used to be one score and who sat at each end of it. SSSA asked for the page to lead on
 * progress instead, so the banner now carries how many schools have finished their self
 * assessment before it carries the score, and the body opens on the four counts.
 *
 * Every score here rests on verified results only — a self-assessment nobody has checked is a
 * claim, not a score. That makes coverage part of the reading rather than a footnote, so the
 * counts travel with the average and the page states them together.
 *
 * The four counts are mutually exclusive and sum to the register, so each is a set somebody
 * could go and list. `verified` is Result rows carrying a final score, which is deliberately the
 * same set the average is computed from: a page that averaged one population and counted another
 * would contradict itself in two places at once. `buildCycleCounts`, which the Monitoring and
 * Schools funnels use, counts VerificationSubmission instead; the two agree in normal running and
 * this one is the right definition here because of what sits beside it.
 *
 * The district ranking is on self assessment finished, not on score. SSSA's reason is the one
 * that matters: a district that has not finished is a district somebody has to chase, and a
 * district's average score is not something the Authority acts on directly. The score stays as a
 * column so the ranking can be read against it.
 */

export type ManagementRow = { code: ManagementCode; label: string; score: number; schools: number };

/** Where every school stands. The four counts sum to the register. */
export type CycleStanding = Standing;

export type DistrictRow = RankedDistrict;

export { MIN_SCHOOLS_FOR_DISTRICT_RANK };

/** A grade band and how many schools are in it, for the links out to the register. */
export type BandLink = { label: string; schools: number };

export type StateDashboard = {
  cycleName: string;
  averageScore: number | null;
  band: string | null;
  standing: CycleStanding;
  /** The top ten, and the one at the bottom, so the page shows the range without 75 rows. */
  districts: DistrictRow[];
  districtBottom: DistrictRow | null;
  districtsRanked: number;
  management: ManagementRow[];
  /** True when no school has a management value yet, so the card can say so instead of
   *  rendering an empty list that looks like a bug. */
  managementUnpopulated: boolean;
  topBand: BandLink | null;
  bottomBand: BandLink | null;
};

const TOP_DISTRICTS = 10;

function bandFor(score: number, bands: { key: string; label: string; min: number }[]): string | null {
  // Bands are ordered high to low, so the first one the score clears is its band.
  for (const b of bands) if (score >= b.min) return b.label;
  return bands.length ? bands[bands.length - 1].label : null;
}

function emptyStanding(totalSchools: number): CycleStanding {
  return standingFrom({ totalSchools, draft: 0, submitted: 0, verified: 0 });
}

export async function buildStateDashboard(): Promise<StateDashboard> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });

  const [totalSchools, gradeBands] = await Promise.all([
    prisma.school.count(),
    cycle
      ? prisma.gradeBand.findMany({
          where: { framework: { cycleId: cycle.id } },
          orderBy: { order: 'asc' },
          select: { key: true, labelEn: true, minPercent: true },
        })
      : Promise.resolve([]),
  ]);

  const empty: StateDashboard = {
    cycleName: cycle?.name ?? '—',
    averageScore: null,
    band: null,
    standing: emptyStanding(totalSchools),
    districts: [],
    districtBottom: null,
    districtsRanked: 0,
    management: [],
    managementUnpopulated: true,
    topBand: null,
    bottomBand: null,
  };
  if (!cycle) return empty;

  // One pass over verified results, aggregated in memory. At a few thousand rows this is far
  // cheaper than issuing an average per district, and it keeps the district and management
  // figures consistent with the state average by construction — they are the same numbers
  // grouped three ways.
  const [results, draftCount, submittedCount, districtTotals] = await Promise.all([
    prisma.result.findMany({
      where: { cycleId: cycle.id, finalScorePercent: { not: null } },
      select: {
        finalScorePercent: true,
        school: { select: { management: true, districtCode: true } },
      },
    }),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'DRAFT' } }),
    prisma.selfAssessmentSubmission.count({ where: { cycleId: cycle.id, status: 'SUBMITTED' } }),
    // Grouped in the database rather than by pulling 32,579 school rows and 26,000 submission
    // rows back to count them here. Prisma's groupBy cannot reach across the relation to the
    // district, so this is the one place the file drops to SQL.
    prisma.$queryRaw<{ code: string; name: string; schools: number; finished: number }[]>`
      SELECT s."districtCode" AS code,
             d."nameEn"       AS name,
             COUNT(*)::int    AS schools,
             COUNT(sub.id)::int AS finished
      FROM "School" s
      JOIN "District" d ON d.code = s."districtCode"
      LEFT JOIN "SelfAssessmentSubmission" sub
        ON sub."schoolUdise" = s.udise
       AND sub."cycleId" = ${cycle.id}
       AND sub.status = 'SUBMITTED'
      GROUP BY s."districtCode", d."nameEn"
    `,
  ]);

  const verified = results.length;
  const standing = standingFrom({
    totalSchools,
    draft: draftCount,
    submitted: submittedCount,
    verified,
  });

  if (results.length === 0) return { ...empty, standing };

  const bands = [...gradeBands]
    .map((b) => ({ key: b.key, label: b.labelEn, min: b.minPercent }))
    .sort((a, b) => b.min - a.min);

  const sum = results.reduce((a, r) => a + (r.finalScorePercent ?? 0), 0);
  const averageScore = round1(sum / results.length);

  // ── scores by district, for the ranking's score column ──
  const scoreByDistrict = new Map<string, { total: number; n: number }>();
  const byBand = new Map<string, number>();
  const byMgmt = new Map<ManagementCode, { total: number; n: number }>();

  for (const r of results) {
    const score = r.finalScorePercent ?? 0;

    const dk = r.school.districtCode;
    const cur = scoreByDistrict.get(dk) ?? { total: 0, n: 0 };
    cur.total += score;
    cur.n += 1;
    scoreByDistrict.set(dk, cur);

    const label = bandFor(score, bands);
    if (label) byBand.set(label, (byBand.get(label) ?? 0) + 1);

    // Nulls are dropped rather than bucketed: a school whose management has not been imported
    // is missing data, and folding it into a group would move that group's average for no reason.
    const m = r.school.management as ManagementCode | null;
    if (m && (MANAGEMENT_CODES as readonly string[]).includes(m)) {
      const mv = byMgmt.get(m) ?? { total: 0, n: 0 };
      mv.total += score;
      mv.n += 1;
      byMgmt.set(m, mv);
    }
  }

  // ── the district ranking, on self assessment finished ──
  const ranked = rankDistricts(
    districtTotals,
    (code) => {
      const s = scoreByDistrict.get(code);
      return s && s.n > 0 ? round1(s.total / s.n) : null;
    },
    (score) => bandFor(score, bands),
  );

  const management: ManagementRow[] = [...byMgmt.entries()]
    .map(([code, v]) => ({
      code,
      label: MANAGEMENT_LABELS[code],
      score: round1(v.total / v.n),
      schools: v.n,
    }))
    .sort((a, b) => b.score - a.score);

  const highest = bands[0];
  const lowest = bands.length ? bands[bands.length - 1] : null;

  return {
    cycleName: cycle.name,
    averageScore,
    band: bandFor(averageScore, bands),
    standing,
    districts: ranked.slice(0, TOP_DISTRICTS),
    // Only when there is something below the ten already shown, so the last row is never a
    // repeat of the tenth.
    districtBottom: ranked.length > TOP_DISTRICTS ? ranked[ranked.length - 1] : null,
    districtsRanked: ranked.length,
    management,
    managementUnpopulated: management.length === 0,
    topBand: highest ? { label: highest.label, schools: byBand.get(highest.label) ?? 0 } : null,
    bottomBand: lowest ? { label: lowest.label, schools: byBand.get(lowest.label) ?? 0 } : null,
  };
}
