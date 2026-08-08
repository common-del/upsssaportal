import { School, PlayCircle, CheckCircle2, UserCheck } from 'lucide-react';

export type CycleFunnelCounts = {
  cycleName: string;
  totalSchools: number;
  started: number;
  submitted: number;
  verified: number;
};

/**
 * Where a cycle has got to, in four numbers.
 *
 * These are cumulative and nested on purpose - every Submitted school is also
 * Started - which is why they read as a funnel rather than as stages. The
 * mutually exclusive six-stage breakdown lives on Analytics; this is the
 * shorter answer to "how far along are we".
 */
export function CycleFunnel({ counts }: { counts: CycleFunnelCounts }) {
  const { cycleName, totalSchools, started, submitted, verified } = counts;
  const pct = (n: number) => (totalSchools > 0 ? Math.round((n / totalSchools) * 100) : 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Active Cycle: <span className="font-semibold text-gray-900">{cycleName}</span>
      </p>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        Active cycle has {totalSchools.toLocaleString('en-IN')} schools,{' '}
        {started.toLocaleString('en-IN')} started, {submitted.toLocaleString('en-IN')} submitted.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelCard
          icon={<School size={22} />}
          bg="bg-[#EEF0F8]"
          color="text-[#1B2A6B]"
          label="Total Schools"
          value={totalSchools}
        />
        <FunnelCard
          icon={<PlayCircle size={22} />}
          bg="bg-amber-50"
          color="text-amber-600"
          label="Started"
          value={started}
          pct={pct(started)}
        />
        <FunnelCard
          icon={<CheckCircle2 size={22} />}
          bg="bg-green-50"
          color="text-green-600"
          label="Submitted"
          value={submitted}
          pct={pct(submitted)}
        />
        <FunnelCard
          icon={<UserCheck size={22} />}
          bg="bg-indigo-50"
          color="text-indigo-600"
          label="Verified"
          value={verified}
          pct={pct(verified)}
        />
      </div>
    </div>
  );
}

function FunnelCard({
  icon,
  bg,
  color,
  label,
  value,
  pct,
}: {
  icon: React.ReactNode;
  bg: string;
  color: string;
  label: string;
  value: number;
  pct?: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${bg} ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums text-[#1B2A6B]">
        {value.toLocaleString('en-IN')}
      </p>
      <p className="mt-0.5 text-sm text-gray-600">
        {label}
        {pct !== undefined ? ` (${pct}%)` : ''}
      </p>
    </div>
  );
}
