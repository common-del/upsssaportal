import Link from 'next/link';
import { buildComplaints, type ComplaintFilterValues, type ComplaintRow } from '@/lib/sssa/complaints';
import { prisma } from '@/lib/db';
import { ensureEscalationUpToDate } from '@/lib/actions/dispute';
import { RunEscalationsButton } from '@/components/tickets/RunEscalationsButton';
import { ComplaintFilters } from '@/components/sssa/ComplaintFilters';

const NAVY = '#1B2A6B';
const GOLD_INK = '#7A5209';
const RED = '#C8372D';
const inr = (n: number) => n.toLocaleString('en-IN');

const LEVEL_STYLE: Record<string, { bg: string; ink: string }> = {
  SSSA: { bg: '#FBE9E7', ink: '#96271E' },
  DISTRICT: { bg: '#FDF8EC', ink: GOLD_INK },
  SCHOOL: { bg: '#F3F4F6', ink: '#4B5563' },
};

/**
 * Complaints: everything anyone has objected to, from either side of the programme.
 *
 * Two queues became one. A parent's complaint against a school and a verifier's report of
 * inducement were separate tabs, and they are different objects — one has a deadline and an
 * escalation ladder, the other has neither — but they are the same question for whoever opens
 * this page: what has somebody objected to, and what is waiting on me.
 *
 * Treating inducement as a complaint type is what makes one table work rather than two glued
 * together: the type filter and the category bars cover both with no special case, and the only
 * place the difference shows is the status cell.
 */
export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Escalating on read, as this page has always done. A ticket's handler level is a function of
  // how long it has sat unanswered, so leaving it to a cron would mean showing a level that
  // expired hours ago.
  const stale = await prisma.ticket.findMany({
    where: { status: { notIn: ['RESOLVED', 'REJECTED'] }, nextDueAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const t of stale) await ensureEscalationUpToDate(t.id);

  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const selected: ComplaintFilterValues = {
    q: one('q'),
    district: one('district'),
    type: one('type'),
    source: one('source'),
  };

  const data = await buildComplaints(selected);
  const maxCat = data.categories[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everything anyone has objected to, from parents and from inside the programme
          </p>
        </div>
        <RunEscalationsButton />
      </header>

      {data.open === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          No open complaints.
        </div>
      ) : (
        <>
          <p className="max-w-[68ch] text-[16.5px] leading-relaxed text-gray-600">
            <b className="font-bold tabular-nums text-gray-900">{inr(data.open)}</b> complaints are
            open.{' '}
            {data.overdue > 0 && (
              <>
                <b className="font-bold tabular-nums" style={{ color: RED }}>
                  {inr(data.overdue)}
                </b>{' '}
                are past their deadline
                {data.atSssa > 0 && (
                  <>
                    , and <b className="font-bold tabular-nums text-gray-900">{inr(data.atSssa)}</b>{' '}
                    have escalated to you
                  </>
                )}
                .{' '}
              </>
            )}
            {data.unacknowledged > 0 && (
              <>
                <b className="font-bold tabular-nums" style={{ color: RED }}>
                  {inr(data.unacknowledged)}
                </b>{' '}
                {data.unacknowledged === 1 ? 'report from a verifier is' : 'reports from verifiers are'}{' '}
                waiting to be acknowledged.
              </>
            )}
          </p>

          <ComplaintFilters
            selected={selected}
            districts={data.districts}
            types={data.types}
            total={data.open}
            matched={data.matched}
          />

          <section>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Raised by</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">About</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Complaint type</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Age</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-gray-500">
                        No complaint matches these filters.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => (
                    <Row key={`${r.source}:${r.id}`} row={r} />
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
                All {inr(data.open)} open complaints by type, whoever raised them.
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                {data.categories.map((c) => (
                  <div key={c.name} className="flex items-center gap-3.5">
                    <span
                      className="w-60 shrink-0 truncate text-[13px]"
                      style={{ color: c.inside ? GOLD_INK : '#4B5563' }}
                    >
                      {c.name}
                    </span>
                    <span className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                      <span
                        className="block h-full rounded"
                        style={{
                          width: `${Math.max(2, Math.round((c.count / maxCat) * 100))}%`,
                          background: c.inside ? '#BF9000' : c.count > maxCat * 0.6 ? RED : NAVY,
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

          <p className="text-xs leading-relaxed text-gray-400">
            A report from a verifier has no deadline and no escalation ladder, so its status reads
            acknowledged or not. A school disputing its own verification is an Appeal and sits in
            Decisions; a school has no way to raise a complaint here.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ row }: { row: ComplaintRow }) {
  const inside = row.source === 'VERIFIER';
  const waiting = row.acknowledged === false;
  const chip = inside
    ? waiting
      ? { text: 'Not acknowledged', bg: '#96271E', ink: '#FFFFFF' }
      : { text: 'Acknowledged', bg: '#E3F0E8', ink: '#1E6344' }
    : {
        text: row.level ?? '—',
        ...(LEVEL_STYLE[row.level ?? ''] ?? { bg: '#F3F4F6', ink: '#4B5563' }),
      };

  return (
    <tr
      className="border-t border-gray-100 first:border-t-0 hover:bg-gray-50"
      style={waiting ? { backgroundColor: '#FDF2F1' } : undefined}
    >
      <td className="px-4 py-3">
        <span className="block text-[12.5px] font-semibold" style={{ color: inside ? GOLD_INK : '#4B5563' }}>
          {inside ? 'A verifier' : 'The public'}
        </span>
        <span className="block text-[11.5px] text-gray-400">{row.raisedBy}</span>
      </td>
      <td className="px-4 py-3">
        <Link href={row.href} className="font-semibold hover:underline" style={{ color: NAVY }}>
          {row.about}
        </Link>
      </td>
      <td className="px-4 py-3 text-gray-700">{row.district}</td>
      <td className="px-4 py-3 text-gray-700">{row.type}</td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.ageDays}d</td>
      <td className="px-4 py-3">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ backgroundColor: chip.bg, color: chip.ink }}
        >
          {chip.text}
        </span>
        <span
          className="mt-0.5 block text-[11.5px]"
          style={{ color: row.overdueDays != null ? RED : '#9AA2B4' }}
        >
          {inside ? 'no deadline' : row.overdueDays != null ? `${row.overdueDays}d overdue` : 'on time'}
        </span>
      </td>
    </tr>
  );
}
