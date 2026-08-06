'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, Scale, X } from 'lucide-react';
import { LevelBadge } from '@/components/public/LevelBadge';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import { MAX_COMPARE } from '@/lib/public/stateOverviewData';
import type { PerformanceLevel } from '@/lib/public/constants';
import type { SchoolType } from '@/lib/public/constants';

export type FindResultRow = {
  udise: string;
  name: string;
  districtName: string;
  blockName: string;
  /** Illustrative, derived from the UDISE code - see nearbyDummyData.ts. */
  distanceKm: number;
};

function truncateName(name: string, max = 42): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function FindResultsTable({
  rows,
  backHref,
}: {
  rows: FindResultRow[];
  /** Where the comparison should offer to return to - this results URL. */
  backHref: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = useMemo(
    () => rows.filter((r) => selected.includes(r.udise)),
    [rows, selected],
  );
  const atLimit = selected.length >= MAX_COMPARE;

  function toggle(udise: string) {
    setSelected((prev) =>
      prev.includes(udise)
        ? prev.filter((u) => u !== udise)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, udise],
    );
  }

  const compareHref = `/public/compare?sel=${selected.join(',')}&back=${encodeURIComponent(backHref)}`;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                {/* Named, because an unlabelled tick column tells a parent nothing
                    about what it is for. */}
                <th className="w-px px-4 py-3">Compare</th>
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">UDISE</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Accreditation</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const extra = deriveResultFields(row.udise);
                const isSelected = selected.includes(row.udise);
                const blocked = !isSelected && atLimit;
                return (
                  <tr
                    key={row.udise}
                    className={isSelected ? 'bg-[#1B2A6B]/[0.04]' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3">
                      {/* A worded button rather than a tickbox: it states what it
                          does, so the page needs no instruction line above it. */}
                      <button
                        type="button"
                        onClick={() => toggle(row.udise)}
                        disabled={blocked}
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? `Remove ${row.name} from comparison`
                            : `Add ${row.name} to comparison`
                        }
                        title={blocked ? `You can compare up to ${MAX_COMPARE} schools` : undefined}
                        className={
                          isSelected
                            ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F5B731] px-2.5 py-1.5 text-xs font-bold text-[#1B2A6B] hover:opacity-90'
                            : blocked
                              ? 'inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-400'
                              : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-[#1B2A6B] px-2.5 py-1.5 text-xs font-semibold text-[#1B2A6B] hover:bg-[#1B2A6B]/[0.06]'
                        }
                      >
                        {isSelected ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                        {isSelected ? 'Added' : 'Compare'}
                      </button>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <Link
                        href={`/public/schools/${row.udise}`}
                        className="font-bold text-[#1B2A6B] hover:underline"
                        title={row.name}
                      >
                        {truncateName(row.name)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-gray-700">
                      {row.distanceKm} km
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.udise}</td>
                    <td className="px-4 py-3">{row.districtName}</td>
                    <td className="px-4 py-3">{row.blockName}</td>
                    <td className="px-4 py-3">{extra.type as SchoolType}</td>
                    <td className="px-4 py-3">
                      <LevelBadge level={extra.performanceLevel as PerformanceLevel} />
                    </td>
                    <td className="px-4 py-3">
                      {extra.feeDisclosed ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Disclosed
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Not Disclosed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {extra.accreditation === 'SQAAF Verified' ? (
                        <span className="rounded-full bg-[#1B2A6B] px-2.5 py-0.5 text-xs font-medium text-white">
                          SQAAF Verified
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/public/schools/${row.udise}`}
                        className="text-sm font-medium text-[#1B2A6B] hover:underline"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected.length > 0 && (
        <>
          {/* Keeps the last row clear of the bar. */}
          <div aria-hidden className="h-24" />

          {/* Fixed to the window, and a sibling of the table card rather than a
              child of it: `sticky` inside that card's `overflow-hidden` never
              pins, which is why the bar used to sit at the end of the table
              instead of on screen. */}
          <div className="fixed inset-x-0 bottom-0 z-40 bg-[#1B2A6B] shadow-[0_-6px_20px_rgba(16,24,40,0.28)] print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-white">
                {selected.length} of {MAX_COMPARE} selected
              </span>
              {/* Chips let a school be dropped without scrolling back to its row.
                  Hidden on small screens, where they would double the bar height. */}
              <span className="hidden flex-wrap gap-1.5 sm:flex">
                {chosen.map((r) => (
                  <button
                    key={r.udise}
                    type="button"
                    onClick={() => toggle(r.udise)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/25"
                  >
                    {truncateName(r.name, 26)}
                    <X size={11} aria-hidden />
                    <span className="sr-only">Remove from comparison</span>
                  </button>
                ))}
              </span>
              <span className="ml-auto flex items-center gap-2.5">
                {selected.length > 1 ? (
                  <Link
                    href={compareHref}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#F5B731] px-4 py-2 text-sm font-bold text-[#1B2A6B] hover:opacity-90"
                  >
                    <Scale size={15} aria-hidden />
                    Compare {selected.length} schools
                  </Link>
                ) : (
                  <span className="text-xs text-white/70">Add one more to compare</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-lg border border-white/40 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Clear
                </button>
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
