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
import {
  LogIn,
  Search,
  Building2,
  GraduationCap,
  BadgeCheck,
  FileText,
  GitCompareArrows,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { UP_NAVY } from '@/lib/public/constants';
import {
  ALL_DISTRICTS,
  DISTRICT_RANKINGS,
  MANDALS,
  mandalSqaafStats,
  districtSqaafStats,
  domainAveragesForDistrict,
  performanceDistributionForDistrict,
} from '@/lib/public/dummyData';

const MANDAL_ROWS = MANDALS.map(mandalSqaafStats);
const ALL_RANKED_DISTRICTS = [...DISTRICT_RANKINGS].sort((a, b) => b.score - a.score);
const topDistricts = ALL_RANKED_DISTRICTS.slice(0, 5);
const MEDAL_COLORS = ['#D4AF37', '#B0B4BA', '#B87333', '#1B2A6B', '#8C5E3C'];

// Score bands and descriptions match scoreToLevel()/levelDescription() in lib/public/schoolProfile.ts
const DISTRIBUTION_INFO = {
  Uday: {
    range: 'upto 55%',
    desc: 'Needs improvement.',
  },
  Unnat: {
    range: '55% to 80%',
    desc: 'Performing satisfactorily.',
  },
  Utkarsh: {
    range: 'above 80%',
    desc: 'Exemplary performance.',
  },
} as const;

// Statewide totals — 2,48,998 total schools in UP
const STATE_TOTALS = {
  government: 179200,
  aided: 14000,
  private: 47850,
  other: 7948,
};

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

function districtTotals(district: string) {
  if (district === 'All Districts') {
    const { government, aided, private: priv, other } = STATE_TOTALS;
    return { government, aided, private: priv, other };
  }
  const stats = districtSqaafStats(district);
  const other = Math.max(0, stats.totalSchools - stats.govt - stats.aided - stats.private);
  return { government: stats.govt, aided: stats.aided, private: stats.private, other };
}

const QUICK_ACCESS = [
  {
    href: '/public/directory',
    title: 'School Directory',
    description: 'Search and explore all schools',
    icon: Search,
  },
  {
    href: '/public/reports',
    title: 'Public Reports',
    description: 'State, district and school reports',
    icon: FileText,
  },
  {
    href: '/public/compare',
    title: 'Compare Schools',
    description: 'Side-by-side school comparison',
    icon: GitCompareArrows,
  },
] as const;

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

export function HomeContent() {
  const router = useRouter();
  const [district, setDistrict] = useState('All Districts');

  const totals = districtTotals(district);
  const totalSchools = totals.government + totals.aided + totals.private + totals.other;
  const assessed = Math.round(totalSchools * 0.3);
  const verified = Math.round(totalSchools * 0.256);

  const domainAverages = domainAveragesForDistrict(district);
  const performanceDistribution = performanceDistributionForDistrict(district);
  const topDomain = domainAverages.reduce((a, b) => (b.score > a.score ? b : a));
  const leastDomain = domainAverages.reduce((a, b) => (b.score < a.score ? b : a));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <section className="rounded-2xl bg-[#1B2A6B] px-6 py-12 text-center text-white sm:py-14">
        <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
          State School Standards Authority — Uttar Pradesh
        </h1>
        <p className="mt-3 text-base text-white/90 sm:text-lg">
          School Quality Monitoring and Accreditation Portal
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#1B2A6B] shadow-sm transition-opacity hover:opacity-90"
          >
            <LogIn size={16} />
            Login
          </Link>
          <Link
            href="/public/find"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#1B2A6B] shadow-sm transition-opacity hover:opacity-90"
          >
            <Search size={16} />
            Find School
          </Link>
        </div>
        <p className="mt-6 text-sm text-white/70">
          Access school information, performance reports, and grievance services.
        </p>
      </section>

      {/* District filter */}
      <div className="mt-8 flex items-center gap-3">
        <label htmlFor="home-district" className="text-sm font-medium text-gray-700">
          Filter District:
        </label>
        <select
          id="home-district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
        >
          <option>All Districts</option>
          {ALL_DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Headline stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="flex items-start justify-between rounded-xl bg-[#1B2A6B] p-5 text-white shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Total Schools
            </p>
            <p className="mt-2 text-3xl font-bold">{formatIN(totalSchools)}</p>
          </div>
          <div className="rounded-lg bg-white/15 p-2.5">
            <Building2 size={20} />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Schools Assessed
            </p>
            <p className="mt-2 text-3xl font-bold text-[#1B2A6B]">{formatIN(assessed)}</p>
          </div>
          <div className="rounded-lg bg-gray-100 p-2.5 text-[#1B2A6B]">
            <GraduationCap size={20} />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-xl bg-[#F5B731] p-5 text-[#1B2A6B] shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1B2A6B]/80">
              SQAAF Verified Schools
            </p>
            <p className="mt-2 text-3xl font-bold">{formatIN(verified)}</p>
          </div>
          <div className="rounded-lg bg-[#1B2A6B]/10 p-2.5">
            <BadgeCheck size={20} />
          </div>
        </div>
      </div>

      {/* About */}
      <section className="mt-8 rounded-xl border-l-4 border-gray-300 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          About Uttar Pradesh State School Standard Authority
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The Uttar Pradesh State School Standard Authority is an independent body (set up
          under India&apos;s NEP 2020) that sets and monitors quality standards for schools
          statewide. Every school runs a{' '}
          <strong className="text-gray-800">
            Uttar Pradesh School Quality Assessment and Accreditation Framework
          </strong>{' '}
          self-assessment and lands in one of three tiers based on its score:
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-[#FCE7F3] p-4">
            <p className="font-bold text-[#1B2A6B]">Uday</p>
            <p className="mt-1 text-xs font-medium text-gray-700">Upto 55%</p>
            <p className="mt-2 text-sm text-gray-600">Needs improvement</p>
          </div>
          <div className="rounded-lg bg-[#FEF9C3] p-4">
            <p className="font-bold text-[#1B2A6B]">Unnat</p>
            <p className="mt-1 text-xs font-medium text-gray-700">55% to 80%</p>
            <p className="mt-2 text-sm text-gray-600">Performing satisfactorily</p>
          </div>
          <div className="rounded-lg bg-[#DCFCE7] p-4">
            <p className="font-bold text-[#1B2A6B]">Utkarsh</p>
            <p className="mt-1 text-xs font-medium text-gray-700">Above 80%</p>
            <p className="mt-2 text-sm text-gray-600">Exemplary performance</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          The goal isn&apos;t to penalize schools — it&apos;s to help every school see clearly
          where it stands and move up a tier over time.
        </p>
        <Link
          href="/public/about"
          className="mt-3 inline-block text-sm font-medium text-[#1B2A6B] underline hover:no-underline"
        >
          Learn more about the Authority and its assessment framework
        </Link>
      </section>

      {/* Top Performing Districts */}
      <section className="mt-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
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
                  style={{
                    width: `${(row.score / topDistricts[0].score) * 100}%`,
                    backgroundColor: MEDAL_COLORS[i],
                  }}
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
      <section className="mt-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Domain Performance Analytics</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="domain-district" className="text-xs font-medium text-gray-600">
              District:
            </label>
            <select
              id="domain-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs shadow-sm"
            >
              <option>All Districts</option>
              {ALL_DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
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

      {/* SQAAF Submission Analytics */}
      <section className="mt-8 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">SQAAF Submission Analytics</h2>
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
                <th className="px-3 py-2">Government</th>
                <th className="px-3 py-2">Govt Aided Schools</th>
                <th className="px-3 py-2">Private</th>
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

      {/* Quick access */}
      <section className="mt-8 rounded-xl border-l-4 border-gray-300 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Quick Access</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {QUICK_ACCESS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-gray-200 p-5 transition-colors hover:border-[#1B2A6B]/40 hover:bg-gray-50"
            >
              <Icon size={22} className="text-[#1B2A6B]" />
              <p className="mt-3 font-bold text-gray-900">{title}</p>
              <p className="mt-1 text-xs text-gray-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Grievance redressal (low-key entry point) */}
      <p className="mt-6 text-center text-xs text-gray-400">
        For unresolved issues regarding a school, you may use the{' '}
        <Link href="/public/dispute/new" className="underline hover:text-gray-600">
          Grievance Redressal
        </Link>{' '}
        facility or{' '}
        <Link href="/public/dispute/track" className="underline hover:text-gray-600">
          track an existing grievance
        </Link>
        .
      </p>
    </div>
  );
}
