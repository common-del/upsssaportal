'use client';

import { useMemo, useState } from 'react';
import { LevelBadge } from '@/components/public/LevelBadge';
import {
  DISTRICTS_ASSESSED,
  DISTRICTS_TOTAL,
  DISTRICT_RANKING,
  OVERVIEW_DISTRICTS,
  STATE_AVERAGE_LEVEL,
  STATE_AVERAGE_SCORE,
  TYPE_AVERAGES,
  topSchoolsForDistrict,
} from '@/lib/public/stateOverviewData';

const NAVY = '#1B2A6B';

export function StateOverviewContent() {
  const [district, setDistrict] = useState(OVERVIEW_DISTRICTS[0]);
  const topSchools = useMemo(() => topSchoolsForDistrict(district), [district]);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Summary stats */}
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            State average level
          </p>
          <p className="mt-2 flex items-center gap-2.5">
            <span className="text-3xl font-bold tabular-nums text-[#1B2A6B]">
              {STATE_AVERAGE_SCORE}
            </span>
            <LevelBadge level={STATE_AVERAGE_LEVEL} />
          </p>
          <p className="mt-1 text-xs text-gray-400">Average verified score out of 100</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Districts assessed
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[#1B2A6B]">
            {DISTRICTS_ASSESSED}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            of {DISTRICTS_TOTAL} districts in the state
          </p>
        </div>
      </div>

      {/* District ranking */}
      <section>
        <h2 className="text-base font-bold text-gray-900">Districts by average score</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          All {DISTRICTS_ASSESSED} assessed districts, highest average first.
        </p>
        <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-white text-[10.5px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Rank</th>
                <th className="px-4 py-3 font-bold">District</th>
                <th className="px-4 py-3 text-right font-bold">Average score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {DISTRICT_RANKING.map((row) => (
                <tr key={row.district}>
                  <td className="px-4 py-3 font-bold tabular-nums text-[#1B2A6B]">{row.rank}</td>
                  <td className="px-4 py-3">{row.district}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* By management type */}
      <section>
        <h2 className="text-base font-bold text-gray-900">Highest average score by type</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-gray-500">
          Average verified score for each management type. The number of schools in each type
          differs widely, so these are not directly comparable.
        </p>
        <div className="mt-3 flex flex-col gap-3.5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {TYPE_AVERAGES.map((row) => (
            <div
              key={row.type}
              className="grid items-center gap-3 text-sm"
              style={{ gridTemplateColumns: '7rem 1fr 2.5rem' }}
            >
              <span className="font-semibold text-gray-900">{row.type}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-[#F5B731]"
                  style={{ width: `${row.score}%` }}
                />
              </span>
              <span className="text-right font-bold tabular-nums">{row.score}</span>
            </div>
          ))}
        </div>
      </section>

      {/* One district's top ten */}
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
    </div>
  );
}
