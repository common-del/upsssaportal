'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Scale } from 'lucide-react';
import { LevelBadge } from '@/components/public/LevelBadge';
import { CompareReportCard, type ComparableSchool } from '@/components/public/CompareReportCard';

/** The viewed school counts as the first entry, so this is how many more can be
 * ticked. Three columns total - four breaks once Hindi labels are in. */
const MAX_EXTRA = 2;

export type NearbyComparable = ComparableSchool & {
  blockName: string;
  distanceKm: number;
};

export function NearbyCompare({
  current,
  nearby,
}: {
  current: ComparableSchool;
  nearby: NearbyComparable[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const chosen = useMemo(
    () => nearby.filter((s) => selected.includes(s.udise)),
    [nearby, selected],
  );
  const atLimit = selected.length >= MAX_EXTRA;

  function toggle(udise: string) {
    setComparing(false);
    setSelected((prev) =>
      prev.includes(udise)
        ? prev.filter((u) => u !== udise)
        : prev.length >= MAX_EXTRA
          ? prev
          : [...prev, udise],
    );
  }

  if (nearby.length === 0) return null;

  return (
    <section>
      <div className="overflow-hidden rounded-xl bg-[#1B2A6B] shadow-sm">
        <div className="p-5">
          <h2 className="text-base font-bold text-white">Compare with nearby schools</h2>
          <p className="mt-1 text-xs text-white/70">
            Tick up to {MAX_EXTRA} more. {current.name} is already included.
          </p>
          {/* Distances are generated from the UDISE code, not measured - see
              nearbyDummyData.ts. Said plainly rather than in small print. */}
          <div
            role="note"
            className="mt-3 flex gap-2 rounded-lg border border-amber-400/60 bg-amber-400/10 p-2.5"
          >
            <AlertTriangle size={16} className="mt-px shrink-0 text-amber-300" aria-hidden />
            <span className="text-xs text-amber-100">
              These distances are examples, not real measurements. Exact school locations are not in
              the system yet.
            </span>
          </div>
        </div>

        <ul className="max-h-80 space-y-2 overflow-y-auto px-5 pb-4">
          {nearby.map((s) => {
            const isSelected = selected.includes(s.udise);
            const blocked = !isSelected && atLimit;
            return (
              <li key={s.udise}>
                <button
                  type="button"
                  onClick={() => toggle(s.udise)}
                  disabled={blocked}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-3 rounded-lg bg-white p-3 text-left transition ${
                    isSelected
                      ? 'ring-2 ring-[#F5B731]'
                      : blocked
                        ? 'cursor-not-allowed opacity-45'
                        : 'hover:opacity-95'
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                      isSelected ? 'border-[#1B2A6B] bg-[#1B2A6B]' : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {isSelected && <Check size={13} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {s.distanceKm} km · {s.type} · {s.level}
                    </span>
                  </span>
                  <LevelBadge level={s.performanceLevel} />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3 bg-white/5 px-5 py-3.5">
          <button
            type="button"
            onClick={() => setComparing(true)}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5B731] px-4 py-2.5 text-sm font-bold text-[#1B2A6B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          >
            <Scale size={16} aria-hidden />
            {/* At zero the button is disabled, so avoid the nonsense
                "Compare 1 schools". Any real count is 2 or more. */}
            {selected.length === 0 ? 'Compare schools' : `Compare ${selected.length + 1} schools`}
          </button>
          <span className="text-xs text-white/70">
            {selected.length === 0
              ? 'Tick a school above to compare'
              : `This school + ${selected.length} selected${atLimit ? ' — deselect one to swap' : ''}`}
          </span>
        </div>
      </div>

      {comparing && chosen.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Side by side</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CompareReportCard school={current} />
            {chosen.map((s) => (
              <CompareReportCard key={s.udise} school={s} />
            ))}
          </div>
          <p className="mt-3 max-w-2xl text-[11px] text-gray-400">
            Schools serve different intakes and differ in size, so these figures describe each school
            against the SQAAF framework rather than against each other.
          </p>
        </div>
      )}
    </section>
  );
}
