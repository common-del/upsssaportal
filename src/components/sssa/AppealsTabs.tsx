import Link from 'next/link';

const NAVY = '#1B2A6B';

export type AppealsTab = 'appeals' | 'verifier';

/**
 * Tabs as links, matching Schools and keeping the page server-rendered.
 *
 * The two tables answer different questions — which schools are waiting on a
 * decision, and whether any verifier is being appealed against unusually often.
 * Stacked, the second was below the fold and read as a footnote to the first.
 *
 * The by-verifier tab is always shown, even with nothing in it. It has a
 * threshold that can legitimately hide every row, and a tab that vanishes leaves
 * no way to find out why.
 */
export function AppealsTabs({
  active,
  appealCount,
  verifierCount,
  pending,
}: {
  active: AppealsTab;
  appealCount: number;
  verifierCount: number;
  /** Appeals with at least one indicator still undecided — the work outstanding. */
  pending: number;
}) {
  const tabs: { id: AppealsTab; label: string; count: number; hot?: boolean }[] = [
    { id: 'appeals', label: 'Appeals', count: appealCount },
    { id: 'verifier', label: 'By verifier', count: verifierCount },
  ];

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-gray-200">
      {tabs.map((t) => {
        const on = t.id === active;
        // Appeals is the default, so it needs no parameter — keeps the common URL clean.
        const href = t.id === 'appeals' ? '/app/sssa/appeals' : `/app/sssa/appeals?tab=${t.id}`;
        return (
          <Link
            key={t.id}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${
              on ? 'text-[#1B2A6B]' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
            style={on ? { borderColor: NAVY } : undefined}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                on ? 'bg-[#1B2A6B] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t.count.toLocaleString('en-IN')}
            </span>
          </Link>
        );
      })}

      {pending > 0 && (
        <span className="ml-auto whitespace-nowrap pr-1 text-[12.5px] tabular-nums text-gray-500">
          <b style={{ color: '#C8372D' }}>{pending.toLocaleString('en-IN')}</b> waiting on a decision
        </span>
      )}
    </div>
  );
}
