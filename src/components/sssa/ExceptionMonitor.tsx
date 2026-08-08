'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import type { ExceptionGroup } from '@/lib/sssa/exceptions';

const TONE: Record<ExceptionGroup['tone'], { bar: string; word: string }> = {
  critical: { bar: 'border-l-[#C8372D]', word: 'text-[#C8372D]' },
  warning: { bar: 'border-l-[#B8791A]', word: 'text-[#B8791A]' },
  info: { bar: 'border-l-[#2563EB]', word: 'text-[#2563EB]' },
  idle: { bar: 'border-l-[#1C7A4A]', word: 'text-[#1C7A4A]' },
};

/**
 * Exception-first: the page opens on what is wrong rather than on a neutral list,
 * because an officer arrives wanting to know what changed, not to browse. Each
 * headline number is itself the finding, so a glance is often the whole visit.
 */
export function ExceptionMonitor({
  groups,
  selectedId,
}: {
  groups: ExceptionGroup[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];
  const allClear = groups.every((g) => g.count === 0);

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('flag', id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => {
          const active = selected?.id === g.id;
          const tone = TONE[g.tone];
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => select(g.id)}
              aria-pressed={active}
              className={`rounded-xl border border-l-4 bg-white p-4 text-left transition-colors ${tone.bar} ${
                active ? 'border-[#1B2A6B] bg-[#F4F6FF]' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {g.count.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-sm leading-snug text-gray-600">{g.title}</p>
              <p className={`mt-2 text-[11px] font-bold uppercase tracking-wide ${tone.word}`}>
                {g.action}
              </p>
            </button>
          );
        })}
      </div>

      {allClear && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} aria-hidden />
          Nothing needs attention right now.
        </div>
      )}

      {selected && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {selected.count.toLocaleString('en-IN')} {selected.title}
          </h2>
          {selected.count === 0 ? (
            <p className="mt-3 text-sm text-gray-600">{selected.clearMessage}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-500">
                {selected.rows.length < selected.count
                  ? `Showing the first ${selected.rows.length}, worst first.`
                  : 'Worst first.'}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {selected.columns.map((c) => (
                        <th
                          key={c.key}
                          className={`px-3 py-2 font-semibold ${c.numeric ? 'text-right' : ''}`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selected.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {selected.columns.map((c, j) => (
                          <td
                            key={c.key}
                            className={`px-3 py-3 ${c.numeric ? 'text-right tabular-nums' : ''} ${
                              j === 0 ? 'font-semibold text-[#1B2A6B]' : 'text-gray-700'
                            }`}
                          >
                            {row[c.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
