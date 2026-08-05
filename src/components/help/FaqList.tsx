'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { FaqItem } from '@/lib/help/faqContent';

/** Receives one resolved set. There is deliberately no way to switch sets here -
 * the choice is made server-side from the signed-in user's role. */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.map((item, i) => ({ item, i }));
    return items
      .map((item, i) => ({ item, i }))
      .filter(
        ({ item }) =>
          item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle),
      );
  }, [items, query]);

  return (
    <div className="mt-5">
      <div className="relative max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          aria-label="Search questions"
          className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
        />
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map(({ item, i }) => {
          const open = openIndex === i;
          return (
            <li key={item.q} className="rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                <span className="min-w-0 flex-1">{item.q}</span>
                <ChevronDown
                  size={17}
                  className={`shrink-0 text-[#1B2A6B] transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {open && <p className="px-4 pb-4 text-sm text-gray-600">{item.a}</p>}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-500">
            No questions match that search.
          </li>
        )}
      </ul>
    </div>
  );
}
