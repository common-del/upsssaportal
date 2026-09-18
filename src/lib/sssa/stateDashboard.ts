import { prisma } from '@/lib/db';
import { MANAGEMENT_CODES, MANAGEMENT_LABELS, type ManagementCode } from '@/lib/schoolManagement';
import {
  MIN_SCHOOLS_FOR_DISTRICT_RANK,
  districtsBelowMinimum,
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
 *
 * A district can be selected, and everything on the page narrows to it except the ranking itself.
 * The ranking is the one block that is about the districts rather than about a population of
 * schools, so narrowing it to one district would leave a table of one row. Everything else, the
 * banner, the four counts, management type and the two grade doors, is a question about a set of
 * schools and answers it for whichever set is chosen.
 */

export type ManagementRow = {
  code: ManagementCode;
  label: string;
  score: number;
  /** Schools of this type carrying a verified score. */
  verified: number;
  /** Schools of this type on the register, verified or not. The row reads one over the other,
   *  because 19,372 means little without the 24,015 it came out of. */
  total: number;
};

/** Where every school stands. The four counts sum to the register. */
export type CycleStanding = Standing;

export type DistrictRow = RankedDistrict;

export { MIN_SCHOOLS_FOR_DISTRICT_RANK };

/** A grade band and how many schools are in it, for the links out to the register. */
export type BandLink = { label: string; schools: number };

/** One entry in the district menu above the banner. */
export type DistrictOption = { code: string; name: string };

export type StateDashboard = {
  cycleName: string;
  averageScore: number | null;
  band: string | null;
  standing: CycleStanding;
  /** Every ranked district, in rank order, each carrying its own rank. The table shows them all
   *  and switches between rank order and alphabetical on the client. */
  districts: DistrictRow[];
  districtsRanked: number;
  /** How many the minimum-size rule left out, so the page states the rule only when it bit. */
  districtsExcluded: number;
  /** The menu, and what is chosen. Null is the whole state. */
  districtOptions: DistrictOption[];
  selectedDistrict: string | null;
  selectedDistrictName: string | null;
  management: ManagementRow[];
  /** True when no school has a management value yet, so the card can say so instead of
   *  rendering an empty list that looks like a bug. */
  managementUnpopulated: boolean;
  topBand: BandLink | null;
  bottomBand: BandLink | null;
};

function bandFor(score: number, bands: { key: string; label: string; min: number }[]): string | null {
  // Bands are ordered high to low, so the first one the score clears is its band.
  for (const b of bands) if (score >= b.min) return b.label;
  return bands.length ? bands[bands.length - 1].label : null;
}

function emptyStanding(totalSchools: number): CycleStanding {
  return standingFrom({ totalSchools, draft: 0, submitted: 0, verified: 0 });
}

export async function buildStateDashboard(districtCode?: string): Promise<StateDashboard> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });

  // Every narrowing on this page is the same clause, written once. A code that matches no
  // district falls through as the whole state rather than as an empty page, because a stale
  // bookmark should show the state rather than look broken.
  const districts = await prisma.district.findMany({
    orderBy: { nameEn: 'asc' },
    select: { code: true, nameEn: true },
  });
  const chosen = districts.find((d) => d.code === districtCode) ?? null;
  const schoolWhere = chosen ? { districtCode: chosen.code } : {};
  const viaSchool = chosen ? { school: { districtCode: chosen.code } } : {};
  const districtOptions: DistrictOption[] = districts.map((d) => ({ code: d.code, name: d.nameEn }));

  const [totalSchools, gradeBands] = await Promise.all([
    prisma.school.count({ where: schoolWhere }),
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
    districtsRanked: 0,
    districtsExcluded: 0,
    districtOptions,
    selectedDistrict: chosen?.code ?? null,
    selectedDistrictName: chosen?.nameEn ?? null,
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
  const [results, draftCount, submittedCount, managementTotals, districtTotals] = await Promise.all([
    prisma.result.findMany({
      where: { cycleId: cycle.id, finalScorePercent: { not: null }, ...viaSchool },
      select: {
        finalScorePercent: true,
        school: { select: { management: true, districtCode: true } },
      },
    }),
    prisma.selfAssessmentSubmission.count({
      where: { cycleId: cycle.id, status: 'DRAFT', ...viaSchool },
    }),
    prisma.selfAssessmentSubmission.count({
      where: { cycleId: cycle.id, status: 'SUBMITTED', ...viaSchool },
    }),
    // Every school of each type, not only the verified ones, so the card can say how far each
    // type has been covered rather than only how many of it happen to be done.
    prisma.school.groupBy({
      by: ['management'],
      where: chosen ? schoolWhere : undefined,
      _count: { _all: true },
    }),
    // Grouped in the database rather than by pulling 32,579 school rows and 26,000 submission
    // rows back to count them here. Prisma's groupBy cannot reach across the relation to the
    // district, so this is the one place the file drops to SQL.
    //
    // A school counts as finished on either evidence: a submitted self assessment, or a verified
    // result. The second half matters more than it sounds. On the register the portal runs on,
    // results were backfilled from responses without submission rows, so counting submissions
    // alone printed 0.0% against every district in the state while the same rows carried an
    // average score. Both joins are on unique keys, so neither multiplies the school count.
    prisma.$queryRaw<{ code: string; name: string; schools: number; finished: number }[]>`
      SELECT s."districtCode" AS code,
             d."nameEn"       AS name,
             COUNT(*)::int    AS schools,
             COUNT(*) FILTER (WHERE sub.id IS NOT NULL OR res.id IS NOT NULL)::int AS finished
      FROM "School" s
      JOIN "District" d ON d.code = s."districtCode"
      LEFT JOIN "SelfAssessmentSubmission" sub
        ON sub."schoolUdise" = s.udise
       AND sub."cycleId" = ${cycle.id}
       AND sub.status = 'SUBMITTED'
      LEFT JOIN "Result" res
        ON res."schoolUdise" = s.udise
       AND res."cycleId" = ${cycle.id}
       AND res."finalScorePercent" IS NOT NULL
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

  const totalByMgmt = new Map<string, number>(
    managementTotals.map((m) => [m.management ?? '', m._count._all]),
  );

  // Ranked on score, which is what the card is about. The bar beside each row is coverage,
  // verified over total, because the three scores sit a third of a point apart and the only
  // figure on the card that genuinely moves is how much of each type has been reached.
  const management: ManagementRow[] = [...byMgmt.entries()]
    .map(([code, v]) => ({
      code,
      label: MANAGEMENT_LABELS[code],
      score: round1(v.total / v.n),
      verified: v.n,
      total: Math.max(v.n, totalByMgmt.get(code) ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const highest = bands[0];
  const lowest = bands.length ? bands[bands.length - 1] : null;

  return {
    cycleName: cycle.name,
    averageScore,
    band: bandFor(averageScore, bands),
    standing,
    districts: ranked,
    districtsRanked: ranked.length,
    districtsExcluded: districtsBelowMinimum(districtTotals),
    districtOptions,
    selectedDistrict: chosen?.code ?? null,
    selectedDistrictName: chosen?.nameEn ?? null,
    management,
    managementUnpopulated: management.length === 0,
    topBand: highest ? { label: highest.label, schools: byBand.get(highest.label) ?? 0 } : null,
    bottomBand: lowest ? { label: lowest.label, schools: byBand.get(lowest.label) ?? 0 } : null,
  };
}
