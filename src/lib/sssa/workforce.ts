import { prisma } from '@/lib/db';
import type { RosterRow } from '@/lib/actions/supervisor';

/**
 * The workforce board: how verification is going, and who is doing it.
 *
 * One screen replaced three. Quality Sample and De-empanelment were separate tabs asking
 * questions about individual verifiers from a list of everybody, which meant you arrived at
 * them already knowing whose record you wanted and then looked for that person. Both are now
 * sections of a verifier's own page, reached from this table, and what they contributed to the
 * whole-roster view survives as columns: a flag count, and a removal recommendation.
 *
 * The filtering is pure so it can be tested. Everything it decides is a judgement somebody will
 * argue with later, particularly what a district filter means.
 */

export type WorkforceRow = RosterRow & {
  /** District names from their roster. Empty means no roster, which the eligibility rule reads
   *  as statewide rather than as nowhere. */
  districts: string[];
  /** Either de-empanelment rule is over its line. Null when they are not empanelled staff, so
   *  the rules do not apply to them at all. */
  removalRecommended: boolean | null;
};

export type WorkforceFilterValues = {
  q: string;
  cell: string;
  district: string;
  status: string;
};

export const EMPTY_FILTERS: WorkforceFilterValues = {
  q: '',
  cell: '',
  district: '',
  status: '',
};

const isSet = (v: string) => v.trim() !== '';

/** The three states a row can be in, in the order they matter to somebody staffing a district. */
export function statusOf(row: Pick<WorkforceRow, 'certification' | 'deEmpanelledAt'>): string {
  if (row.deEmpanelledAt) return 'DE_EMPANELLED';
  return row.certification === 'CERTIFIED' ? 'CERTIFIED' : 'NOT_CERTIFIED';
}

/**
 * Whether this verifier can work in that district.
 *
 * Deliberately "can work in" rather than "is rostered to". An empty roster means statewide
 * everywhere else in the codebase, and a filter that answered the narrower question would hide
 * exactly the people you are looking for when a district turns out to have nobody. The cost is
 * that in a deployment where nobody has a roster, the filter returns everybody, and the district
 * column says "Statewide" on every row so that is visible rather than mysterious.
 */
export function coversDistrict(districts: string[], districtName: string): boolean {
  return districts.length === 0 || districts.includes(districtName);
}

export function filterWorkforce(
  rows: WorkforceRow[],
  filters: WorkforceFilterValues,
): WorkforceRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (q !== '' && !r.name.toLowerCase().includes(q) && !r.username.toLowerCase().includes(q)) {
      return false;
    }
    if (isSet(filters.cell) && r.cell !== filters.cell) return false;
    if (isSet(filters.district) && !coversDistrict(r.districts, filters.district)) return false;
    if (isSet(filters.status) && statusOf(r) !== filters.status) return false;
    return true;
  });
}

/** Removed last, then uncertified, then by open caseload. The people who cannot take work, and
 *  the people carrying most, are the two ends anybody staffing a district looks at first. */
export function sortWorkforce(rows: WorkforceRow[]): WorkforceRow[] {
  const rank = (r: WorkforceRow) => (r.deEmpanelledAt ? 2 : r.certification === 'CERTIFIED' ? 0 : 1);
  return rows
    .slice()
    .sort((a, b) => rank(a) - rank(b) || b.openCount - a.openCount || a.name.localeCompare(b.name));
}

export type WorkforceKpis = {
  /** Schools with a published result, against this year's intake. */
  verified: number;
  intake: number;
  /** Desk cases with no verifier, plus cohort schools with nobody going to them. */
  waitingDesk: number;
  waitingField: number;
  /** Mean days, by cell, over the cases each cell has finished. Null when a cell has none. */
  avgDeskDays: number | null;
  avgFieldDays: number | null;
  working: number;
  onRoster: number;
};

/**
 * The four numbers at the top.
 *
 * They answer "how is verification going" rather than "how big is the workforce", because the
 * workforce question is the table underneath and a tile that repeats it is a wasted tile. The
 * waiting figure names both halves: a desk backlog and a field staffing gap need different
 * people to fix them, and one combined number hides which one you have.
 */
export async function buildWorkforceKpis(roster: RosterRow[]): Promise<WorkforceKpis> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) {
    return {
      verified: 0,
      intake: 0,
      waitingDesk: 0,
      waitingField: 0,
      avgDeskDays: null,
      avgFieldDays: null,
      working: roster.filter((r) => r.certification === 'CERTIFIED' && !r.deEmpanelledAt).length,
      onRoster: roster.length,
    };
  }

  const inCycle = { cycleId: cycle.id };
  const [verified, intake, waitingDesk, waitingField] = await Promise.all([
    prisma.assessmentCycleRun.count({ where: { ...inCycle, state: 'PUBLISHED' } }),
    prisma.assessmentCycleRun.count({ where: inCycle }),
    prisma.assessmentCycleRun.count({
      where: { ...inCycle, state: 'DESK_SCREENING', deskAssigneeProfileId: null },
    }),
    prisma.assessmentCycleRun.count({
      where: { ...inCycle, state: 'FIELD_COHORT', fieldVisits: { none: { recusedAt: null } } },
    }),
  ]);

  // Averaged over the people, not over the cases, because the roster rows already hold one mean
  // each and re-deriving a case-weighted mean here would need every case again for a tile.
  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
  const daysIn = (cell: 'ONLINE' | 'FIELD') =>
    roster
      .filter((r) => r.cell === cell && r.avgTurnaroundDays !== null)
      .map((r) => r.avgTurnaroundDays!);

  return {
    verified,
    intake,
    waitingDesk,
    waitingField,
    avgDeskDays: mean(daysIn('ONLINE')),
    avgFieldDays: mean(daysIn('FIELD')),
    working: roster.filter((r) => r.certification === 'CERTIFIED' && !r.deEmpanelledAt).length,
    onRoster: roster.length,
  };
}

/** District names per verifier profile, and the list of districts anybody is rostered to. */
export async function districtsByProfile(
  profileIds: string[],
): Promise<{ byProfile: Map<string, string[]>; rostered: string[] }> {
  if (profileIds.length === 0) return { byProfile: new Map(), rostered: [] };

  const profiles = await prisma.verifierProfile.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, user: { select: { verifierDistricts: { select: { districtCode: true } } } } },
  });

  const codes = new Set<string>();
  for (const p of profiles) for (const d of p.user.verifierDistricts) codes.add(d.districtCode);

  const districts = await prisma.district.findMany({
    where: codes.size > 0 ? { code: { in: [...codes] } } : undefined,
    select: { code: true, nameEn: true },
  });
  const nameBy = new Map(districts.map((d) => [d.code, d.nameEn]));

  const byProfile = new Map(
    profiles.map((p) => [
      p.id,
      p.user.verifierDistricts.map((d) => nameBy.get(d.districtCode) ?? d.districtCode).sort(),
    ]),
  );

  return { byProfile, rostered: [...new Set([...nameBy.values()])].sort() };
}
