'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Scale, X } from 'lucide-react';
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="w-px px-4 py-3">
                <span className="sr-only">Select to compare</span>
              </th>
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
                  className={
                    isSelected ? 'bg-[#1B2A6B]/[0.04]' : blocked ? 'opacity-45' : 'hover:bg-gray-50'
                  }
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(row.udise)}
                      disabled={blocked}
                      aria-pressed={isSelected}
                      aria-label={`Compare ${row.name}`}
                      className="grid h-[18px] w-[18px] place-items-center rounded border disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: isSelected ? '#1B2A6B' : '#fff',
                        borderColor: isSelected ? '#1B2A6B' : '#cbd2e0',
                      }}
                    >
                      {isSelected && <Check size={12} className="text-white" aria-hidden />}
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

      {/* Pinned, because the results run to fifty rows - a button below the
          table would never be seen. */}
      {selected.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 bg-[#1B2A6B] px-4 py-3 shadow-[0_-6px_14px_rgba(16,24,40,0.16)]">
          <span className="text-sm font-semibold text-white">
            {selected.length} of {MAX_COMPARE} selected
          </span>
          <span className="flex flex-wrap gap-1.5">
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
              <span className="text-xs text-white/70">Select one more to compare</span>
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
      )}
    </div>
  );
}
