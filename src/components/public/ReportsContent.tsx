'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { UP_NAVY } from '@/lib/public/constants';
import {
  ALL_DISTRICTS,
  DISTRICT_RANKINGS,
  MANDALS,
  mandalSqaafStats,
  domainAveragesForDistrict,
  performanceDistributionForDistrict,
  DISPUTE_CATEGORIES,
} from '@/lib/public/dummyData';
import { SearchableSelect } from '@/components/public/SearchableSelect';

const MANDAL_ROWS = MANDALS.map(mandalSqaafStats);
const ALL_RANKED_DISTRICTS = [...DISTRICT_RANKINGS].sort((a, b) => b.score - a.score);
const topDistricts = ALL_RANKED_DISTRICTS.slice(0, 5);
const MEDAL_COLORS = ['#D4AF37', '#B0B4BA', '#B87333', '#1B2A6B', '#8C5E3C'];

// Score bands and descriptions match scoreToLevel()/levelDescription() in lib/public/schoolProfile.ts
const DISTRIBUTION_INFO = {
  Uday: { range: 'upto 55%', desc: 'Needs improvement.' },
  Unnat: { range: '55% to 80%', desc: 'Performing satisfactorily.' },
  Utkarsh: { range: 'above 80%', desc: 'Exemplary performance.' },
} as const;

function DomainAxisTick({
  x,
  y,
  payload,
}: {
  x: string | number;
  y: string | number;
  payload: { value: string };
}) {
  const words = payload.value.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fontSize={10} fill="#4B5563">
        <tspan x={0} dy={12}>{line1}</tspan>
        <tspan x={0} dy={13}>{line2}</tspan>
      </text>
    </g>
  );
}

export function ReportsContent() {
  const router = useRouter();
  const [district, setDistrict] = useState('All Districts');

  const domainAverages = domainAveragesForDistrict(district);
  const performanceDistribution = performanceDistributionForDistrict(district);
  const topDomain = domainAverages.reduce((a, b) => (b.score > a.score ? b : a));
  const leastDomain = domainAverages.reduce((a, b) => (b.score < a.score ? b : a));

  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="reports-print-area mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">State Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            District rankings, domain-wise analytics, mandal tables, and dispute analytics.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          className="print:hidden inline-flex items-center gap-2 rounded-lg border border-[#1B2A6B] bg-white px-4 py-2 text-sm font-medium text-[#1B2A6B] shadow-sm hover:bg-gray-50"
        >
          <Download size={16} />
          Export PDF
        </button>
      </div>

      {/* Top Performing Districts */}
      <section className="mb-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          Top 5 Districts — Best Performing Schools
        </h2>
        <p className="mt-1 text-xs text-gray-500">Ranked by average SQAAF school score, statewide</p>

        <div className="mt-5 space-y-3">
          {topDistricts.map((row, i) => (
            <div key={row.district} className="flex items-center gap-4">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: MEDAL_COLORS[i] }}
              >
                {i + 1}
              </div>
              <div className="w-28 shrink-0 text-sm font-medium text-gray-900">{row.district}</div>
              <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full"
                  style={{ width: `${row.score}%`, backgroundColor: MEDAL_COLORS[i] }}
                />
              </div>
              <div className="w-12 shrink-0 text-right text-sm font-semibold text-[#1B2A6B]">
                {row.score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Domain Performance Analytics */}
      <section className="mb-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Domain Performance Analytics</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="domain-district" className="text-xs font-medium text-gray-600">
              District:
            </label>
            <SearchableSelect
              id="domain-district"
              value={district}
              onChange={setDistrict}
              options={ALL_DISTRICTS.map((d) => ({ value: d, label: d }))}
              allLabel="All Districts"
              allValue="All Districts"
              searchPlaceholder="Search district..."
              ariaLabel="District"
              className="w-[180px]"
              buttonClassName="px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {district === 'All Districts' ? 'Statewide average' : district}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <TrendingUp size={16} />
              Top Performing Domain
            </p>
            <p className="mt-2 text-lg font-bold text-[#1B2A6B]">{topDomain.domain}</p>
            <p className="text-2xl font-bold text-emerald-600">{topDomain.score}%</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
              <TrendingDown size={16} />
              Least Performing Domain
            </p>
            <p className="mt-2 text-lg font-bold text-[#1B2A6B]">{leastDomain.domain}</p>
            <p className="text-2xl font-bold text-red-500">{leastDomain.score}%</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">Domain-wise Average Score</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainAverages} margin={{ top: 8, right: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="domain"
                    interval={0}
                    height={40}
                    tick={(props) => <DomainAxisTick {...props} />}
                  />
                  <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill={UP_NAVY} radius={[4, 4, 0, 0]} name="Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">Performance Distribution</h3>
            <p className="mb-3 text-xs text-gray-500">
              After completing a self-assessment, every school is placed into one of three
              performance tiers:
            </p>
            <div className="mb-4 space-y-2">
              {performanceDistribution.map((entry) => {
                const info = DISTRIBUTION_INFO[entry.name as keyof typeof DISTRIBUTION_INFO];
                return (
                  <p key={entry.name} className="flex items-start gap-2 text-xs text-gray-600">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span>
                      <strong className="text-gray-800">{entry.name}</strong>{' '}
                      <span className="text-gray-400">({info.range})</span> — {info.desc}
                    </span>
                  </p>
                );
              })}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    isAnimationActive={false}
                  >
                    {performanceDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend formatter={(value, entry) => `${value}: ${(entry.payload as { value: number }).value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Mandal-wise Analytics */}
      <section className="mb-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Mandal-wise Analytics</h2>
        <p className="mt-1 text-xs text-gray-500">
          All 18 mandals · open a mandal to see its districts
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Mandal</th>
                <th className="px-3 py-2">Districts</th>
                <th className="px-3 py-2">Total Schools</th>
                <th className="px-3 py-2">Government Schools</th>
                <th className="px-3 py-2">Govt Aided Schools</th>
                <th className="px-3 py-2">Private Schools</th>
                <th className="px-3 py-2">Students</th>
                <th className="px-3 py-2">Teachers</th>
                <th className="px-3 py-2">SQAAF Verified</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {MANDAL_ROWS.map((row) => (
                <tr
                  key={row.code}
                  onClick={() => router.push(`/public/reports/mandal/${row.code}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-[#1B2A6B]">
                    <Link href={`/public/reports/mandal/${row.code}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.districtCount}</td>
                  <td className="px-3 py-2">{row.totalSchools.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.govt.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.aided.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.private.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.students.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.teachers.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2">{row.verified.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-gray-400">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dispute Analytics */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Dispute Analytics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Total" value="47" />
          <Stat label="Resolved" value="60%" />
          <Stat label="Open" value="12" />
        </div>
        <h3 className="mt-6 mb-3 text-sm font-medium text-gray-700">Category Distribution</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DISPUTE_CATEGORIES}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {DISPUTE_CATEGORIES.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1B2A6B]">{value}</p>
    </div>
  );
}
