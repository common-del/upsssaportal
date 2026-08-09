import type { Leader, ManagementRow, StateDashboard as Data } from '@/lib/sssa/stateDashboard';
import { PageHeader, Section } from '@/components/sssa/ui';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

function Rank({ tone, label }: { tone: 'top' | 'bottom' | 'mid'; label: string }) {
  const cls =
    tone === 'top'
      ? 'bg-green-50 text-green-700'
      : tone === 'bottom'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-500';
  return (
    <span className={`mt-0.5 w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-extrabold tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function Card({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
        {heading}
      </div>
      <div className="flex flex-1 flex-col justify-start">{children}</div>
    </div>
  );
}

function Row({
  rank,
  name,
  detail,
  divider,
}: {
  rank: 'top' | 'bottom' | 'mid';
  name: string;
  detail: string;
  divider?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${divider ? 'border-t border-gray-100' : ''}`}>
      <Rank tone={rank} label={rank === 'top' ? 'Highest' : rank === 'bottom' ? 'Lowest' : ''} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
          {name}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-gray-500">{detail}</span>
      </span>
    </div>
  );
}

function Pair({
  heading,
  top,
  bottom,
  detail,
}: {
  heading: string;
  top: Leader | null;
  bottom: Leader | null;
  detail: (l: Leader) => string;
}) {
  if (!top) return null;
  return (
    <Card heading={heading}>
      <Row rank="top" name={top.name} detail={detail(top)} />
      {bottom && <Row rank="bottom" name={bottom.name} detail={detail(bottom)} divider />}
    </Card>
  );
}

function Management({ rows, unpopulated }: { rows: ManagementRow[]; unpopulated: boolean }) {
  return (
    <Card heading="School management type">
      {unpopulated ? (
        <p className="px-4 py-3 text-[13px] leading-relaxed text-gray-500">
          Not yet imported.
        </p>
      ) : (
        rows.map((m, i) => (
          <div
            key={m.code}
            className={`flex items-start gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}
          >
            <span className="mt-0.5 w-14 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-center text-[10px] font-extrabold text-gray-500">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
                {m.label}
              </span>
              <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
                {m.score}% · {inr(m.schools)} scored
              </span>
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

export function StateDashboard({ data }: { data: Data }) {
  const coverage = data.totalSchools
    ? Math.round((data.verified / data.totalSchools) * 100)
    : 0;

  // cycleName already reads "SSSA Cycle 2025-26" in the data, so prefixing it here
  // produced "SSSA Cycle SSSA Cycle 2025-26".
  const subtitle = data.cycleName === '—' ? undefined : data.cycleName;

  if (data.averageScore == null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Uttar Pradesh" subtitle={subtitle} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No school has been verified yet, so there is no state score.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Uttar Pradesh" subtitle={subtitle} />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl px-6 py-5 text-white" style={{ background: NAVY }}>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            State average score
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-5xl font-bold leading-none tracking-tight tabular-nums">
              {data.averageScore}%
            </span>
            {data.band && (
              <span
                className="rounded-full bg-[#F5B731] px-4 py-1.5 text-[15px] font-bold"
                style={{ color: NAVY }}
              >
                {data.band}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto text-right text-xs leading-relaxed tabular-nums text-white/70">
          {inr(data.verified)} of {inr(data.totalSchools)} schools verified ({coverage}%)
        </div>
      </div>

      <Section title="Highest and lowest">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Pair
            heading="District"
            top={data.topDistrict}
            bottom={data.bottomDistrict}
            detail={(l) => `${l.score}% · ${inr(l.schools)} scored${l.band ? ` · ${l.band}` : ''}`}
          />
          <Pair
            heading="School"
            top={data.topSchool}
            bottom={data.bottomSchool}
            detail={(l) => `${l.score} out of 100${l.band ? ` · ${l.band}` : ''}`}
          />
          <Management rows={data.management} unpopulated={data.managementUnpopulated} />
        </div>
      </Section>
    </div>
  );
}
