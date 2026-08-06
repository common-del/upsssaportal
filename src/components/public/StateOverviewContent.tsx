'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { LevelBadge } from '@/components/public/LevelBadge';
import { SchoolComparePicker } from '@/components/public/SchoolComparePicker';
import {
  OVERVIEW_DISTRICTS,
  STATE_AVERAGE_LEVEL,
  STATE_AVERAGE_SCORE,
  TOP_DISTRICT,
  TOP_DISTRICTS,
  TOP_TYPE,
  topSchoolsForDistrict,
} from '@/lib/public/stateOverviewData';

const NAVY = '#1B2A6B';

function StatTile({
  label,
  value,
  suffix,
  note,
  badge,
}: {
  label: string;
  value: string;
  suffix?: string;
  note: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-bold tabular-nums text-[#1B2A6B]">{value}</span>
        {suffix && <span className="text-lg font-bold text-[#1B2A6B]">{suffix}</span>}
        {badge}
      </p>
      <p className="mt-1 text-xs text-gray-400">{note}</p>
    </div>
  );
}

export function StateOverviewContent() {
  const [district, setDistrict] = useState(OVERVIEW_DISTRICTS[0]);
  const topSchools = useMemo(() => topSchoolsForDistrict(district), [district]);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Three headline stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="State average SQAAF"
          value={`${STATE_AVERAGE_SCORE}%`}
          note="Average across all schools in the state"
          badge={<LevelBadge level={STATE_AVERAGE_LEVEL} />}
        />
        <StatTile
          label="Top district"
          value={TOP_DISTRICT.district}
          suffix={`${TOP_DISTRICT.score}%`}
          note="Highest average SQAAF % of any district"
        />
        <StatTile
          label="Top management type"
          value={TOP_TYPE.type}
          suffix={`${TOP_TYPE.score}%`}
          note="Highest average SQAAF %. Group sizes differ widely"
        />
      </div>

      {/* Top ten districts */}
      <section>
        <h2 className="text-base font-bold text-gray-900">Districts by average score</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          The ten highest-scoring districts in the state, by average SQAAF %.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-[10.5px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Rank</th>
                <th className="px-4 py-3 font-bold">District</th>
                <th className="px-4 py-3 text-right font-bold">Average SQAAF %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TOP_DISTRICTS.map((row) => (
                <tr key={row.district}>
                  <td className="px-4 py-3 font-bold tabular-nums text-[#1B2A6B]">{row.rank}</td>
                  <td className="px-4 py-3">{row.district}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* One district's top ten schools */}
      <section>
        <h2 className="text-base font-bold text-gray-900">Top 10 schools in a district</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Pick a district to see its ten highest-scoring schools. One district at a time.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="overview-district" className="text-sm font-semibold text-gray-900">
            District
          </label>
          <select
            id="overview-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="min-w-[12rem] rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          >
            {OVERVIEW_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            Showing {topSchools.length} schools in {district} only
          </span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 text-[10.5px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Rank</th>
                <th className="px-4 py-3 font-bold">School</th>
                <th className="px-4 py-3 font-bold">Block</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Level</th>
                <th className="px-4 py-3 text-right font-bold">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topSchools.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-4 font-bold tabular-nums" style={{ color: NAVY }}>
                    {s.rank}
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#1B2A6B]">{s.name}</td>
                  <td className="whitespace-nowrap px-4 py-4">{s.block}</td>
                  <td className="whitespace-nowrap px-4 py-4">{s.type}</td>
                  <td className="px-4 py-4">
                    <LevelBadge level={s.level} />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Carried over from the removed Compare Schools page, which is where this
          banner used to live. */}
      <div className="rounded-2xl bg-[#EFF6FF] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1B2A6B]">
          <GraduationCap className="h-7 w-7 text-white" strokeWidth={2} aria-hidden />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[#1B2A6B] sm:text-2xl">
          Want to find the right school for your child?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-gray-600">
          Answer a few simple questions about your child&apos;s needs and we&apos;ll show you
          matching schools in your area.
        </p>
        <Link
          href="/public/find"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1B2A6B] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Find Schools →
        </Link>
      </div>

      {/* Comparison, replacing the former Compare Schools page */}
      <section>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Compare schools side by side</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-gray-500">
          Pick a district, then a block, then choose up to four schools from that block to compare
          their SQAAF scores domain by domain.
        </p>
        <SchoolComparePicker />
      </section>
    </div>
  );
}
