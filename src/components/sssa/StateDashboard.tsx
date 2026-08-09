import type { Leader, ManagementRow, StateDashboard as Data } from '@/lib/sssa/stateDashboard';

const NAVY = '#1B2A6B';

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/**
 * Leading and trailing, side by side.
 *
 * Every ranking here is one query read from both ends. Showing only the leader
 * makes a regulator's landing page unreadable in a bad month — the top district
 * needs nothing from the state, and the bottom one is the phone call. They cost
 * the same to compute, so there is no reason to show one without the other.
 */
function Pair({
  heading,
  top,
  bottom,
  suffix,
  note,
}: {
  heading: string;
  top: Leader | null;
  bottom: Leader | null;
  suffix: (l: Leader) => string;
  note?: string;
}) {
  if (!top) return null;
  const Half = ({ l, rank }: { l: Leader; rank: 'TOP' | 'BOTTOM' }) => (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide ${
          rank === 'TOP' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
          {l.name}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-gray-500">{suffix(l)}</span>
      </span>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
        {heading}
      </div>
      <Half l={top} rank="TOP" />
      {bottom && (
        <div className="border-t border-gray-100">
          <Half l={bottom} rank="BOTTOM" />
        </div>
      )}
      {note && <div className="px-4 pb-3 text-[11.5px] font-semibold text-amber-700">{note}</div>}
    </div>
  );
}

/** Three values, so a top/bottom pair would hide the middle one. Ranked in full. */
function Management({ rows, unpopulated }: { rows: ManagementRow[]; unpopulated: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
        School management type
      </div>
      {unpopulated ? (
        <p className="px-4 py-4 text-[13px] leading-relaxed text-gray-500">
          No school has a management type yet. The field is imported from the UDISE extract — until
          that backfill runs this stays empty rather than showing a guess.
        </p>
      ) : (
        rows.map((m, i) => (
          <div key={m.code} className={`flex items-start gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}>
            <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-extrabold text-gray-500">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
                {m.label}
              </span>
              <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
                <b className="font-bold text-gray-900">{m.score}%</b> · {m.schools.toLocaleString('en-IN')} scored
              </span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export function StateDashboard({ data }: { data: Data }) {
  const coverage = pct(data.verified, data.totalSchools);

  if (data.averageScore == null) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Uttar Pradesh</h1>
          <p className="mt-1 text-sm text-gray-500">SSSA Cycle {data.cycleName}</p>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No school has been verified yet, so there is no state score to report. The figures here
          rest on verified results only — a self-assessment nobody has checked is a claim, not a
          score.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Uttar Pradesh</h1>
        <p className="mt-1 text-sm text-gray-500">SSSA Cycle {data.cycleName}</p>
      </header>

      <p className="max-w-[60ch] text-[16.5px] leading-relaxed text-gray-600">
        Across <b className="font-bold tabular-nums text-gray-900">{data.verified.toLocaleString('en-IN')}</b>{' '}
        verified schools the state scores{' '}
        <b className="font-bold tabular-nums text-gray-900">{data.averageScore}%</b>
        {data.band ? <> — the {data.band} band.</> : '.'}
      </p>

      <div className="flex flex-wrap items-baseline gap-5 rounded-2xl px-6 py-5 text-white" style={{ background: NAVY }}>
        <span className="w-full text-[11px] font-bold uppercase tracking-widest text-white/65">
          State average score
        </span>
        <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
          {data.averageScore}%
        </span>
        {data.band && (
          <span className="rounded-full bg-[#F5B731] px-4 py-1.5 text-[15px] font-bold" style={{ color: NAVY }}>
            {data.band}
          </span>
        )}
        {/* Coverage travels with the number rather than sitting in a footnote. At
            this level it is part of reading the score, not a caveat about it. */}
        <span className="ml-auto text-right text-xs leading-relaxed text-white/70">
          Based on {data.verified.toLocaleString('en-IN')} verified schools — <b>{coverage}%</b> of the state
          <br />
          {(data.totalSchools - data.verified).toLocaleString('en-IN')} not yet scored
        </span>
      </div>

      <section>
        <h2 className="text-base font-bold tracking-tight text-gray-900">Leading and trailing</h2>
        <p className="mt-0.5 max-w-[72ch] text-xs text-gray-500">
          One ranking each, read from both ends. The trailing side is the one that needs a call.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Pair
            heading="District"
            top={data.topDistrict}
            bottom={data.bottomDistrict}
            suffix={(l) =>
              `${l.score}% · ${l.schools.toLocaleString('en-IN')} scored${l.band ? ` · ${l.band}` : ''}`
            }
          />
          <Pair
            heading="School"
            top={data.topSchool}
            bottom={data.bottomSchool}
            suffix={(l) => `${l.score} / 100${l.band ? ` · ${l.band}` : ''}`}
            note={
              coverage < 90
                ? `Best and worst of the ${coverage}% verified so far, not of the state`
                : undefined
            }
          />
          <Management rows={data.management} unpopulated={data.managementUnpopulated} />
        </div>
      </section>
    </div>
  );
}
