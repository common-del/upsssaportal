'use client';

import { useMemo, useState } from 'react';
import type { DistrictRow } from '@/lib/sssa/stateDashboard';

/**
 * Every district, in one table, with three ways to read it.
 *
 * It used to show the top ten and then the single bottom row, which answered "who is ahead" and
 * left "who is behind" as one name with no context. All 75 are here now, alphabetical by default,
 * because alphabetical is the order somebody uses when they have come to look up a particular
 * district rather than to see who is winning.
 *
 * Rank travels on the row rather than being its position, so it still reads 1 to 75 when the
 * table is alphabetical. A position is not a rank once the order changes.
 *
 * That leaves nothing saying where you are in the list, so a serial number sits beside the rank.
 * In the alphabetical view the ranks are scattered and the serial number is the only column that
 * counts in order, which is what you read off when you are halfway down the state and want to say
 * which row. The two columns agree in the top ten view and nowhere else. That is the price of
 * having both, and it is cheap against losing your place.
 *
 * The three views are client state rather than a search parameter: unlike the district scope
 * above, which changes every figure on the page, this changes only which rows of one table are on
 * screen, and a round trip to the server for that would be slower than the thing it fetches.
 */

const NAVY = '#1B2A6B';
const ENDS = 10;
const inr = (n: number) => n.toLocaleString('en-IN');
const pct1 = (n: number) => `${n.toFixed(1)}%`;

type View = 'all' | 'top' | 'bottom';

const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: 'All districts' },
  { key: 'top', label: `Top ${ENDS}` },
  { key: 'bottom', label: `Bottom ${ENDS}` },
];

// Held as data rather than as a literal in the markup, because the alignment used to be a
// hardcoded column index and adding a column silently right-aligned the wrong one.
const COLUMNS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'S. No.', align: 'left' },
  { label: 'Rank', align: 'left' },
  { label: 'District', align: 'left' },
  { label: 'Self assessments finished', align: 'left' },
  { label: 'Average score', align: 'right' },
  { label: 'SQAAF grade', align: 'left' },
];

function Finished({ d }: { d: DistrictRow }) {
  const complete = d.finishedPct >= 95;
  const ink = complete ? '#1C7A4A' : '#B8791A';
  return (
    <span className="flex items-center gap-3">
      <span className="inline-block h-2 w-[110px] shrink-0 overflow-hidden rounded-full bg-gray-100">
        <span
          className="block h-2 rounded-full"
          style={{ width: `${Math.min(100, d.finishedPct)}%`, backgroundColor: ink }}
        />
      </span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: ink }}>
        {pct1(d.finishedPct)}
      </span>
      <span className="text-xs tabular-nums text-gray-500">
        {inr(d.finished)} of {inr(d.schools)}
      </span>
    </span>
  );
}

export function DistrictRankingTable({ districts }: { districts: DistrictRow[] }) {
  const [view, setView] = useState<View>('all');

  const rows = useMemo(() => {
    if (view === 'top') return districts.slice(0, ENDS);
    // Kept in rank order rather than reversed, so the worst district is the last row in every
    // view it appears in and the eye always finds it in the same place.
    if (view === 'bottom') return districts.slice(Math.max(0, districts.length - ENDS));
    return [...districts].sort((a, b) => a.name.localeCompare(b.name));
  }, [districts, view]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <button
              key={v.key}
              type="button"
              aria-pressed={active}
              onClick={() => setView(v.key)}
              className="min-h-[36px] rounded-lg border-2 px-3.5 py-1.5 text-[12.5px] font-bold"
              style={{
                borderColor: active ? NAVY : '#E5E7EB',
                backgroundColor: active ? NAVY : '#FFFFFF',
                color: active ? '#FFFFFF' : NAVY,
              }}
            >
              {v.label}
            </button>
          );
        })}
        <span className="ml-1 text-[12.5px] text-gray-500">
          {view === 'all'
            ? `${inr(districts.length)} districts, A to Z`
            : `${inr(rows.length)} of ${inr(districts.length)}, in rank order`}
        </span>
      </div>

      {/* All 75 is a long table, so it scrolls inside its own box with the heading pinned rather
          than pushing the two cards below it off the bottom of the page. */}
      <div
        className="overflow-x-auto overflow-y-auto rounded-2xl border border-gray-200 bg-white"
        style={{ maxHeight: view === 'all' ? 520 : undefined }}
      >
        <table className="w-full text-[13px]" style={{ minWidth: 820 }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  className={`border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.code} className="border-t border-gray-100">
                {/* Plain and grey against the rank's chip, so the eye reads standing first and
                    treats the serial number as the margin note it is. */}
                <td className="py-3 pl-4 pr-2 align-middle text-xs tabular-nums text-gray-400">
                  {i + 1}
                </td>
                <td className="px-4 py-3 align-middle">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                      d.rank === 1
                        ? 'bg-green-50 text-green-700'
                        : d.rank === districts.length
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {d.rank}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle font-semibold" style={{ color: NAVY }}>
                  {d.name}
                </td>
                <td className="px-4 py-3 align-middle">
                  <Finished d={d} />
                </td>
                <td className="px-4 py-3 text-right align-middle font-semibold tabular-nums text-gray-700">
                  {d.averageScore === null ? '—' : pct1(d.averageScore)}
                </td>
                <td className="px-4 py-3 align-middle">
                  {d.band ? (
                    <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {d.band}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not verified yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
