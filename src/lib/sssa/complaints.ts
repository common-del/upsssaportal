import { prisma } from '@/lib/db';

/**
 * Every complaint the programme has received, from either side of it, in one list.
 *
 * Two tables feed this. A Ticket is filed on the public form against a UDISE code and tracked by
 * mobile number; it carries `nextDueAt` and a `handlerLevel` and climbs a level on its own when
 * the deadline passes. An IntegrityReport is filed by somebody in the verification workforce
 * about inducement or pressure, and carries neither a clock nor a ladder, only whether the
 * Authority has acknowledged it. They used to be two tabs, and SSSA asked for one.
 *
 * What makes one table work is treating inducement as a complaint type like any other. The type
 * filter and the category bars then cover both kinds with no special case, and the only place
 * the difference shows is the status cell, where one reads as an escalation level and the other
 * reads as acknowledged or not.
 *
 * A school disputing its own verification is still not here. That is an Appeal: one per school
 * per cycle, argued indicator by indicator, decided only by SSSA, no ladder and no clock. A
 * school has no way to raise a complaint at all, which is a real gap and not this file's to fix.
 */

const OPEN_STATUSES_EXCLUDED = ['RESOLVED', 'REJECTED'] as const;

/** Inducement reports have no category row of their own, so they are given one. Exported so the
 *  filter menu and the bars cannot spell it differently from the rows. */
export const INDUCEMENT_TYPE = 'Inducement or pressure';

/** Where a complaint came from. The group, not the free text the filer typed: a public form
 *  lets people describe their own role, so filtering on what they wrote would offer a menu of
 *  every phrase anybody has ever used. */
export type ComplaintSource = 'PUBLIC' | 'VERIFIER';

/** How the group reads in a table cell. Short nouns rather than the filter's fuller phrases,
 *  because a column of "A parent or the public" is a column of noise. */
export const SOURCE_LABEL: Record<ComplaintSource, string> = {
  PUBLIC: 'Public',
  VERIFIER: 'Verifier',
};

export type ComplaintRow = {
  id: string;
  href: string;
  source: ComplaintSource;
  /** The person's name. A verifier who reports their own supervisor is named on the record, and
   *  a member of the public is named if they gave one. Their own description of themselves, the
   *  free text role, is a fallback rather than the first choice: the question the column asks is
   *  who this was, not what they called themselves. */
  raisedBy: string;
  /** The school for a public complaint; the person, or the school, for a report. */
  about: string;
  district: string;
  type: string;
  ageDays: number;
  /** Tickets only: which level is handling it, and how far past its deadline it is. */
  level: string | null;
  overdueDays: number | null;
  /** Reports only. */
  acknowledged: boolean | null;
};

export type ComplaintFilterValues = {
  q: string;
  district: string;
  type: string;
  source: string;
};

export const EMPTY_COMPLAINT_FILTERS: ComplaintFilterValues = {
  q: '',
  district: '',
  type: '',
  source: '',
};

export type ComplaintsData = {
  open: number;
  overdue: number;
  atSssa: number;
  unacknowledged: number;
  rows: ComplaintRow[];
  matched: number;
  categories: { name: string; count: number; inside: boolean }[];
  districts: string[];
  types: string[];
};

const ROW_LIMIT = 40;
const isSet = (v: string) => v.trim() !== '';

/** Search covers what somebody would have in front of them: a school, a person, or a type. */
export function filterComplaints(
  rows: ComplaintRow[],
  filters: ComplaintFilterValues,
): ComplaintRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (
      q !== '' &&
      !r.about.toLowerCase().includes(q) &&
      !r.raisedBy.toLowerCase().includes(q) &&
      !r.type.toLowerCase().includes(q) &&
      !SOURCE_LABEL[r.source].toLowerCase().includes(q)
    ) {
      return false;
    }
    if (isSet(filters.district) && r.district !== filters.district) return false;
    if (isSet(filters.type) && r.type !== filters.type) return false;
    if (isSet(filters.source) && r.source !== filters.source) return false;
    return true;
  });
}

/**
 * Past the deadline first, then reports waiting on the Authority, then oldest.
 *
 * With two kinds of urgency in one list the order stops being self-evident, so the page states
 * it. A complaint past its deadline is the state's problem in a way a fresh one is not; an
 * unacknowledged report is the other thing nobody else will pick up.
 */
export function sortComplaints(rows: ComplaintRow[]): ComplaintRow[] {
  const rank = (r: ComplaintRow) =>
    r.overdueDays != null ? 0 : r.acknowledged === false ? 1 : 2;
  return rows
    .slice()
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.overdueDays ?? -1) - (a.overdueDays ?? -1) ||
        b.ageDays - a.ageDays,
    );
}

const daysSince = (from: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));

export async function buildComplaints(
  filters: ComplaintFilterValues = EMPTY_COMPLAINT_FILTERS,
): Promise<ComplaintsData> {
  const now = new Date();

  const [tickets, reports] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { notIn: [...OPEN_STATUSES_EXCLUDED] } },
      select: {
        id: true,
        createdAt: true,
        nextDueAt: true,
        handlerLevel: true,
        submitterRole: true,
        submitterName: true,
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
        category: { select: { nameEn: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.integrityReport.findMany({
      select: {
        id: true,
        createdAt: true,
        schoolUdise: true,
        auditAcknowledgedAt: true,
        reportedBy: { select: { name: true, username: true } },
        about: { select: { name: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // A report names a school by UDISE without a relation, so the district comes from a second
  // lookup rather than a join.
  const reportUdises = reports.map((r) => r.schoolUdise).filter((u): u is string => u !== null);
  const schools = reportUdises.length
    ? await prisma.school.findMany({
        where: { udise: { in: reportUdises } },
        select: { udise: true, nameEn: true, district: { select: { nameEn: true } } },
      })
    : [];
  const schoolBy = new Map(schools.map((s) => [s.udise, s]));

  const ticketRows: ComplaintRow[] = tickets.map((t) => {
    const overdueMs = t.nextDueAt ? now.getTime() - t.nextDueAt.getTime() : null;
    return {
      id: t.id,
      href: `/app/sssa/disputes/${t.id}`,
      source: 'PUBLIC' as const,
      // The name first. The role is free text the filer typed about themselves, so it stands in
      // only when there is no name at all, and is never invented.
      raisedBy: t.submitterName?.trim() || t.submitterRole?.trim() || 'Name not given',
      about: t.school?.nameEn ?? '—',
      district: t.school?.district?.nameEn ?? '—',
      type: t.category?.nameEn ?? '—',
      ageDays: daysSince(t.createdAt, now),
      level: t.handlerLevel,
      overdueDays: overdueMs != null && overdueMs > 0 ? Math.floor(overdueMs / 86_400_000) : null,
      acknowledged: null,
    };
  });

  const reportRows: ComplaintRow[] = reports.map((r) => {
    const school = r.schoolUdise ? schoolBy.get(r.schoolUdise) : undefined;
    return {
      id: r.id,
      href: `/app/sssa/disputes/integrity/${r.id}`,
      source: 'VERIFIER' as const,
      raisedBy: r.reportedBy.name ?? r.reportedBy.username,
      // The subject, or the school when the report names nobody.
      about: r.about ? (r.about.name ?? r.about.username) : (school?.nameEn ?? 'Nobody named'),
      district: school?.district.nameEn ?? '—',
      type: INDUCEMENT_TYPE,
      ageDays: daysSince(r.createdAt, now),
      level: null,
      overdueDays: null,
      acknowledged: r.auditAcknowledgedAt !== null,
    };
  });

  const all = [...ticketRows, ...reportRows];
  const matched = filterComplaints(all, filters);

  // The counts describe the whole list, not the filtered view: they are the reason somebody
  // opened the page, and a filter narrowing them would hide the backlog behind a menu.
  const catCounts = new Map<string, number>();
  for (const r of all) catCounts.set(r.type, (catCounts.get(r.type) ?? 0) + 1);

  return {
    open: all.length,
    overdue: all.filter((r) => r.overdueDays != null).length,
    atSssa: all.filter((r) => r.level === 'SSSA').length,
    unacknowledged: all.filter((r) => r.acknowledged === false).length,
    rows: sortComplaints(matched).slice(0, ROW_LIMIT),
    matched: matched.length,
    categories: [...catCounts.entries()]
      .map(([name, count]) => ({ name, count, inside: name === INDUCEMENT_TYPE }))
      .sort((a, b) => b.count - a.count),
    districts: [...new Set(all.map((r) => r.district))].filter((d) => d !== '—').sort(),
    types: [...new Set(all.map((r) => r.type))].filter((t) => t !== '—').sort(),
  };
}
