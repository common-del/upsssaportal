'use client';

import { useMemo, useState } from 'react';
import { Check, Scale } from 'lucide-react';
import { LevelBadge } from '@/components/public/LevelBadge';
import { CompareReportCard } from '@/components/public/CompareReportCard';
import {
  OVERVIEW_DISTRICTS,
  compareBlocksForDistrict,
  compareSchoolsForBlock,
} from '@/lib/public/stateOverviewData';

const MAX_SELECTED = 4;

const selectClass =
  'min-w-[12rem] rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

export function SchoolComparePicker() {
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const blocks = useMemo(
    () => (district ? compareBlocksForDistrict(district) : []),
    [district],
  );
  const schools = useMemo(
    () => (district && block ? compareSchoolsForBlock(district, block) : []),
    [district, block],
  );
  const chosen = useMemo(
    () => schools.filter((s) => selected.includes(s.udise)),
    [schools, selected],
  );

  const atLimit = selected.length >= MAX_SELECTED;

  function pickDistrict(value: string) {
    setDistrict(value);
    setBlock('');
    setSelected([]);
    setComparing(false);
  }

  function pickBlock(value: string) {
    setBlock(value);
    setSelected([]);
    setComparing(false);
  }

  function toggle(udise: string) {
    setComparing(false);
    setSelected((prev) =>
      prev.includes(udise)
        ? prev.filter((u) => u !== udise)
        : prev.length >= MAX_SELECTED
          ? prev
          : [...prev, udise],
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Steps 1 and 2 */}
      <div className="flex flex-wrap items-end gap-4">
        <span className="flex flex-col gap-1.5">
          <label htmlFor="cmp-district" className="text-xs font-bold uppercase tracking-wide text-gray-500">
            1. District
          </label>
          <select
            id="cmp-district"
            value={district}
            onChange={(e) => pickDistrict(e.target.value)}
            className={selectClass}
          >
            <option value="">Select a district…</option>
            {OVERVIEW_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </span>

        <span className="flex flex-col gap-1.5">
          <label htmlFor="cmp-block" className="text-xs font-bold uppercase tracking-wide text-gray-500">
            2. Block
          </label>
          <select
            id="cmp-block"
            value={block}
            onChange={(e) => pickBlock(e.target.value)}
            disabled={!district}
            className={`${selectClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">{district ? 'Select a block…' : 'Choose a district first'}</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </span>
      </div>

      {/* Steps 3 and 4 */}
      {schools.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              3. Schools in {block}
            </p>
            <p className="text-xs text-gray-500">
              {selected.length} of {MAX_SELECTED} selected
              {atLimit && ' — deselect one to swap'}
            </p>
          </div>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {schools.map((s) => {
              const isSelected = selected.includes(s.udise);
              const blocked = !isSelected && atLimit;
              return (
                <li key={s.udise}>
                  <button
                    type="button"
                    onClick={() => toggle(s.udise)}
                    disabled={blocked}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-[#1B2A6B] bg-[#1B2A6B]/5'
                        : blocked
                          ? 'cursor-not-allowed border-gray-200 opacity-50'
                          : 'border-gray-200 hover:border-[#1B2A6B]/40 hover:bg-gray-50'
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
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {s.type} · {s.level}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <LevelBadge level={s.performanceLevel} />
                      <span className="text-xs font-bold tabular-nums text-[#1B2A6B]">
                        {s.overallScore}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Step 5 */}
          <button
            type="button"
            onClick={() => setComparing(true)}
            disabled={selected.length < 2}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B2A6B] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Scale size={16} aria-hidden />
            Compare {selected.length > 1 ? `${selected.length} schools` : 'schools'}
          </button>
          {selected.length < 2 && (
            <p className="mt-2 text-xs text-gray-400">Select at least two schools to compare.</p>
          )}
        </div>
      )}

      {comparing && chosen.length > 1 && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Side by side
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {chosen.map((s) => (
              <CompareReportCard key={s.udise} school={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
