import Link from 'next/link';
import { buildDecisionsInbox } from '@/lib/sssa/decisionsInbox';
import { DecisionsInbox, type DecisionsFilter } from '@/components/sssa/DecisionsInbox';

/**
 * Every ruling waiting on the admin, in one list, worst first.
 *
 * This page replaced three sidebar entries — Appeals, Escalations and Discrepancies —
 * that were identical in shape: a heading over a list of pending decisions for the
 * same one person. The old URLs redirect here with their filter preselected, so
 * notification links keep working. The legacy assignment queue is not a decision and
 * lives on at /app/sssa/appeals?tab=legacy; Audit stays its own page on purpose,
 * being a blind re-check of finished work rather than a pending ruling.
 */
export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [data, sp] = await Promise.all([buildDecisionsInbox(), searchParams]);
  const filter: DecisionsFilter =
    sp.type === 'appeals' || sp.type === 'escalations' || sp.type === 'discrepancies' ? sp.type : 'all';

  const { total, blocking, oldestDays } = data.counts;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Decisions</h1>
        <p className="mt-1 text-sm text-gray-600">
          {total === 0 ? (
            'Nothing is waiting on you.'
          ) : (
            <>
              <b className="font-bold tabular-nums text-gray-900">{total.toLocaleString('en-IN')}</b> waiting on
              you
              {blocking > 0 && (
                <>
                  {' · '}
                  <b className="font-bold tabular-nums text-[#9A6410]">{blocking.toLocaleString('en-IN')}</b>{' '}
                  block publication
                </>
              )}
              {' · '}oldest has waited{' '}
              <b className="font-bold tabular-nums text-gray-900">
                {oldestDays} day{oldestDays === 1 ? '' : 's'}
              </b>
            </>
          )}
        </p>
      </header>

      <DecisionsInbox data={data} initialFilter={filter} />

      <p className="text-[12px] text-gray-400">
        Looking for manual verifier assignment? That is not a decision and lives on the{' '}
        <Link href="/app/sssa/appeals?tab=legacy" className="underline hover:text-gray-600">
          legacy assignment queue
        </Link>
        .
      </p>
    </div>
  );
}
