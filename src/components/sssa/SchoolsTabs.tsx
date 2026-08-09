import Link from 'next/link';

const NAVY = '#1B2A6B';

export type SchoolsTab = 'register' | 'behind';

/**
 * Tabs as links, not client state.
 *
 * The register already carries its filters and page number in the URL, so making
 * the tab a query parameter keeps the whole page server-rendered, keeps a view
 * shareable, and lets browser Back step between tabs the way people expect.
 */
export function SchoolsTabs({
  active,
  registerCount,
  behindCount,
  query,
}: {
  active: SchoolsTab;
  registerCount: number;
  behindCount: number;
  /** Current filters, carried across so switching tab does not clear them. */
  query: Record<string, string>;
}) {
  const href = (tab: SchoolsTab) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    // Register is the default, so it needs no parameter — keeps the common URL clean.
    if (tab !== 'register') params.set('tab', tab);
    params.delete('page');
    const qs = params.toString();
    return `/app/sssa/schools${qs ? `?${qs}` : ''}`;
  };

  const tabs: { id: SchoolsTab; label: string; count: number; hot?: boolean }[] = [
    { id: 'register', label: 'Register', count: registerCount },
    { id: 'behind', label: 'Furthest behind', count: behindCount, hot: true },
  ];

  return (
    <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={href(t.id)}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${
              on
                ? 'border-[#1B2A6B] text-[#1B2A6B]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
            style={on ? { borderColor: NAVY } : undefined}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                on
                  ? t.hot && t.count > 0
                    ? 'bg-[#C8372D] text-white'
                    : 'bg-[#1B2A6B] text-white'
                  : t.hot && t.count > 0
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t.count.toLocaleString('en-IN')}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
