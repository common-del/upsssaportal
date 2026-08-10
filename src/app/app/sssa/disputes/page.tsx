import Link from 'next/link';
import { buildComplaints } from '@/lib/sssa/complaints';
import { prisma } from '@/lib/db';
import { ensureEscalationUpToDate } from '@/lib/actions/dispute';
import { RunEscalationsButton } from '@/components/tickets/RunEscalationsButton';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

const LEVEL_STYLE: Record<string, string> = {
  SSSA: 'bg-red-50 text-red-700',
  DISTRICT: 'bg-amber-50 text-amber-800',
  SCHOOL: 'bg-gray-100 text-gray-600',
};

/**
 * Complaints: parents and the public, against a school.
 *
 * Named for who files them rather than for the table they live in. This page and
 * Appeals used to be one queue, which hid that they are different mechanisms with
 * different resolution paths — and hid the escalation ladder that makes a case
 * arriving here mean two levels already let it lapse.
 *
 * The escalation control lives here now. It used to be the only thing on
 * /app/sssa/tickets, a second page over the same Ticket table that nothing in the
 * app linked to — so this page reported the deadline breach while the only way to
 * act on it was a URL nobody could find.
 */
export default async function ComplaintsPage() {
  // Escalating on read, as the old page did. A ticket's handler level is a
  // function of how long it has sat unanswered, so leaving it to a cron would mean
  // this page showing a level that expired hours ago.
  const stale = await prisma.ticket.findMany({
    where: { status: { notIn: ['RESOLVED', 'REJECTED'] }, nextDueAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const t of stale) await ensureEscalationUpToDate(t.id);

  const data = await buildComplaints();
  const maxCat = data.categories[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="mt-1 text-sm text-gray-500">Raised by parents and the public</p>
        </div>
        {/* Beside the overdue count rather than buried: an officer who can see the
            SLA has been breached should be able to act on it from the same screen. */}
        <RunEscalationsButton />
      </header>

      {data.open === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          No open complaints.
        </div>
      ) : (
        <>
          <p className="max-w-[64ch] text-[16.5px] leading-relaxed text-gray-600">
            <b className="font-bold tabular-nums text-gray-900">{inr(data.open)}</b> complaints are
            open.{' '}
            {data.overdue > 0 && (
              <>
                <b className="font-bold tabular-nums text-[#C8372D]">{inr(data.overdue)}</b> are past
                their deadline
                {data.atSssa > 0 && (
                  <>
                    , and <b className="font-bold tabular-nums text-gray-900">{inr(data.atSssa)}</b>{' '}
                    have escalated to you
                  </>
                )}
                .
              </>
            )}
          </p>

          <section>
            <h2 className="text-base font-bold tracking-tight text-gray-900">Open cases</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Past deadline first, then oldest. With shows the level currently handling the case.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Complaint</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Filed by</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Age</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Overdue</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">With</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 first:border-t-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/sssa/disputes/${r.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: NAVY }}
                        >
                          {r.school}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.district}</td>
                      <td className="px-4 py-3 text-gray-700">{r.category}</td>
                      <td className="px-4 py-3 text-gray-700">{r.filedBy}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.ageDays}d</td>
                      <td
                        className="px-4 py-3 text-right font-bold tabular-nums"
                        style={{ color: r.overdueDays != null ? '#C8372D' : '#9AA2B4' }}
                      >
                        {r.overdueDays != null ? `${r.overdueDays}d` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            LEVEL_STYLE[r.level] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {r.level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.categories.length > 0 && (
            <section>
              <h2 className="text-base font-bold tracking-tight text-gray-900">
                What people complain about
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                All {inr(data.open)} open complaints by category.
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                {data.categories.map((c) => (
                  <div key={c.name} className="flex items-center gap-3.5">
                    <span className="w-56 shrink-0 truncate text-[13px] text-gray-600">{c.name}</span>
                    <span className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                      <span
                        className="block h-full rounded"
                        style={{
                          width: `${Math.round((c.count / maxCat) * 100)}%`,
                          background: c.count > maxCat * 0.6 ? '#C8372D' : NAVY,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right text-[13px] font-bold tabular-nums text-gray-900">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
