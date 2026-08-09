import { prisma } from '@/lib/db';

/**
 * Complaints raised by parents and the public against a school.
 *
 * A Ticket, not an Appeal. Filed on the public form against a UDISE code and
 * tracked by mobile number, it carries `nextDueAt` and a `handlerLevel` and moves
 * up a level on its own when the deadline passes — school, then district, then
 * SSSA. So a case sitting at SSSA is one two levels already let lapse, which is
 * what makes the level worth showing next to the age.
 *
 * A school disputing its own verification is an Appeal and lives elsewhere: one per
 * school per cycle, argued indicator by indicator, no ladder and no clock.
 */

const OPEN_STATUSES_EXCLUDED = ['RESOLVED', 'REJECTED'] as const;

export type ComplaintRow = {
  id: string;
  school: string;
  district: string;
  category: string;
  filedBy: string;
  ageDays: number;
  overdueDays: number | null;
  level: string;
};

export type ComplaintsData = {
  open: number;
  overdue: number;
  atSssa: number;
  rows: ComplaintRow[];
  categories: { name: string; count: number }[];
};

const ROW_LIMIT = 25;

export async function buildComplaints(): Promise<ComplaintsData> {
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
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
  });

  const rows: ComplaintRow[] = tickets.map((t) => {
    const overdueMs = t.nextDueAt ? now.getTime() - t.nextDueAt.getTime() : null;
    return {
      id: t.id,
      school: t.school?.nameEn ?? '—',
      district: t.school?.district?.nameEn ?? '—',
      category: t.category?.nameEn ?? '—',
      // submitterRole is free text on a public form, so it is shown as given
      // rather than mapped onto a role we would have to invent.
      filedBy: t.submitterRole?.trim() || t.submitterName?.trim() || 'Public',
      ageDays: Math.max(0, Math.floor((now.getTime() - t.createdAt.getTime()) / 86_400_000)),
      overdueDays: overdueMs != null && overdueMs > 0 ? Math.floor(overdueMs / 86_400_000) : null,
      level: t.handlerLevel,
    };
  });

  const catCounts = new Map<string, number>();
  for (const r of rows) catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);

  return {
    open: rows.length,
    overdue: rows.filter((r) => r.overdueDays != null).length,
    atSssa: rows.filter((r) => r.level === 'SSSA').length,
    // Overdue first, then oldest — a case past its deadline is the state's problem
    // in a way a fresh one is not, regardless of which is older.
    rows: [...rows]
      .sort((a, b) => (b.overdueDays ?? -1) - (a.overdueDays ?? -1) || b.ageDays - a.ageDays)
      .slice(0, ROW_LIMIT),
    categories: [...catCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
