import type { BehindBlock, CycleCounts } from '@/lib/sssa/cycleCounts';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

/** Kept as the old export name so existing imports do not need touching. */
export type CycleFunnelCounts = CycleCounts;

/**
 * Where every school stands in the cycle, in four numbers that add up.
 *
 * These used to be cumulative — Started included everything Submitted, Submitted
 * included everything Verified — so no number told you how many schools were
 * actually sitting in draft. These four are mutually exclusive and sum to the
 * register, which means each is a set somebody could go and list.
 */
export function CycleFunnel({ counts }: { counts: CycleCounts }) {
  const { cycleName, totalSchools, notStarted, draft, finished, verified } = counts;
  const pct = (n: number) => (totalSchools > 0 ? Math.round((n / totalSchools) * 100) : 0);

  const cards = [
    { label: 'Not started', value: notStarted, color: '#C8372D', sub: 'no form opened' },
    { label: 'In draft', value: draft, color: '#B8791A', sub: 'started, not sent' },
    { label: 'Finished', value: finished, color: '#111827', sub: 'sent, awaiting verification' },
    { label: 'Verified', value: verified, color: '#1C7A4A', sub: 'checked and scored' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Active cycle: <span className="font-semibold text-gray-900">{cycleName}</span> ·{' '}
        <span className="tabular-nums">{inr(totalSchools)}</span> schools
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
              {c.label}
            </div>
            <div
              className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums"
              style={{ color: c.color }}
            >
              {inr(c.value)}
            </div>
            <div className="mt-1 text-xs tabular-nums text-gray-500">
              {pct(c.value)}% · {c.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The counts say how many have not started; this says where they are.
 *
 * Ranked by how many schools are yet to start rather than by percentage, because
 * the useful next action is the call that unlocks hundreds of schools — not the
 * one to whichever small block happens to have the lowest ratio.
 */
export function BehindBlocks({
  blocks,
  district = '',
  districts = [],
}: {
  blocks: BehindBlock[];
  district?: string;
  districts?: { code: string; nameEn: string }[];
}) {
  return (
    <section>
      <p className="text-xs text-gray-500">Blocks with the most schools yet to open the form.</p>

      {districts.length > 0 && (
        // A plain form so this stays server-rendered like the rest of the tab.
        // Changing district reloads with ?district=…, which the register tab then
        // shares — narrow here, switch tabs, and you are still in that district.
        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="behind" />
          <select
            name="district"
            defaultValue={district}
            className="rounded-lg border border-gray-300 px-3 py-2 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.nameEn}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Apply
          </button>
          <span className="ml-auto text-[12.5px] tabular-nums text-gray-500">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
          </span>
        </form>
      )}

      {blocks.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-[13px] text-gray-500">
          Every block here has schools underway.
        </p>
      ) : (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
          <thead>
            <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
              <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Block</th>
              <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
              <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Schools</th>
              <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Yet to start</th>
              <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Started</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.code} className="border-t border-gray-100 first:border-t-0">
                <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                  {b.name}
                </td>
                <td className="px-4 py-3 text-gray-700">{b.district}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{inr(b.schools)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: '#C8372D' }}>
                  {inr(b.schools - b.started)}
                </td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{
                    color: b.startedPct < 10 ? '#C8372D' : b.startedPct < 30 ? '#B8791A' : '#111827',
                  }}
                >
                  {b.startedPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
