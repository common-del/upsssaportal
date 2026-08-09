import { prisma } from '@/lib/db';
import { MANAGEMENT_CODES, MANAGEMENT_LABELS, type ManagementCode } from '@/lib/schoolManagement';

/**
 * The state dashboard: one score, and who is at each end of it.
 *
 * Every figure here rests on verified results only — a self-assessment nobody has
 * checked is a claim, not a score. That makes coverage part of the reading rather
 * than a footnote, so `verified` and `totalSchools` travel with the average and the
 * page states them together. At 20% coverage the state figure is the average of the
 * fifth that has been reached, and the verified fifth is unlikely to be a random
 * fifth, so it is reported as such.
 */

export type Leader = { name: string; score: number; schools: number; band: string | null };
export type ManagementRow = { code: ManagementCode; label: string; score: number; schools: number };

export type StateDashboard = {
  cycleName: string;
  totalSchools: number;
  verified: number;
  averageScore: number | null;
  band: string | null;
  topDistrict: Leader | null;
  bottomDistrict: Leader | null;
  topSchool: Leader | null;
  bottomSchool: Leader | null;
  management: ManagementRow[];
  /** True when no school has a management value yet, so the card can say so
   *  instead of rendering an empty chart that looks like a bug. */
  managementUnpopulated: boolean;
};

/** Ranking a group on one or two results is noise, not a finding. */
const MIN_SCHOOLS_FOR_DISTRICT_RANK = 5;

function bandFor(score: number, bands: { key: string; label: string; min: number }[]): string | null {
  // Bands are ordered high to low, so the first one the score clears is its band.
  for (const b of bands) if (score >= b.min) return b.label;
  return bands.length ? bands[bands.length - 1].label : null;
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
    totalSchools,
    verified: 0,
    averageScore: null,
    band: null,
    topDistrict: null,
    bottomDistrict: null,
    topSchool: null,
    bottomSchool: null,
    management: [],
    managementUnpopulated: true,
  };
  if (!cycle) return empty;

  // One pass over verified results, aggregated in memory. At a few thousand rows
  // this is far cheaper than issuing an average per district, and it keeps the
  // school-level and district-level rankings consistent with each other by
  // construction — they are literally the same numbers grouped two ways.
  const results = await prisma.result.findMany({
    where: { cycleId: cycle.id, finalScorePercent: { not: null } },
    select: {
      finalScorePercent: true,
      schoolUdise: true,
      school: {
        select: {
          nameEn: true,
          management: true,
          districtCode: true,
          district: { select: { nameEn: true } },
        },
      },
    },
  });

  if (results.length === 0) return empty;

  const bands = [...gradeBands]
    .map((b) => ({ key: b.key, label: b.labelEn, min: b.minPercent }))
    .sort((a, b) => b.min - a.min);

  const sum = results.reduce((a, r) => a + (r.finalScorePercent ?? 0), 0);
  const averageScore = Math.round((sum / results.length) * 10) / 10;

  // ── districts ──
  const byDistrict = new Map<string, { name: string; total: number; n: number }>();
  for (const r of results) {
    const key = r.school.districtCode;
    const cur = byDistrict.get(key) ?? { name: r.school.district?.nameEn ?? key, total: 0, n: 0 };
    cur.total += r.finalScorePercent ?? 0;
    cur.n += 1;
    byDistrict.set(key, cur);
  }
  const districtRanked = [...byDistrict.values()]
    .filter((d) => d.n >= MIN_SCHOOLS_FOR_DISTRICT_RANK)
    .map((d) => {
      const score = Math.round((d.total / d.n) * 10) / 10;
      return { name: d.name, score, schools: d.n, band: bandFor(score, bands) };
    })
    .sort((a, b) => b.score - a.score);

  // ── schools ──
  const schoolRanked = results
    .map((r) => {
      const score = Math.round((r.finalScorePercent ?? 0) * 10) / 10;
      return {
        name: r.school.nameEn,
        score,
        schools: 1,
        band: bandFor(score, bands),
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── management ──
  // Nulls are dropped rather than bucketed: a school whose management has not been
  // imported is missing data, and folding it into a group would move that group's
  // average for no reason.
  const byMgmt = new Map<ManagementCode, { total: number; n: number }>();
  for (const r of results) {
    const m = r.school.management as ManagementCode | null;
    if (!m || !(MANAGEMENT_CODES as readonly string[]).includes(m)) continue;
    const cur = byMgmt.get(m) ?? { total: 0, n: 0 };
    cur.total += r.finalScorePercent ?? 0;
    cur.n += 1;
    byMgmt.set(m, cur);
  }
  const management: ManagementRow[] = [...byMgmt.entries()]
    .map(([code, v]) => ({
      code,
      label: MANAGEMENT_LABELS[code],
      score: Math.round((v.total / v.n) * 10) / 10,
      schools: v.n,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    cycleName: cycle.name,
    totalSchools,
    verified: results.length,
    averageScore,
    band: bandFor(averageScore, bands),
    topDistrict: districtRanked[0] ?? null,
    bottomDistrict: districtRanked.length > 1 ? districtRanked[districtRanked.length - 1] : null,
    topSchool: schoolRanked[0] ?? null,
    bottomSchool: schoolRanked.length > 1 ? schoolRanked[schoolRanked.length - 1] : null,
    management,
    managementUnpopulated: management.length === 0,
  };
}
