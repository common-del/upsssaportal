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
  DISTRICT_SCHOOL_CHART,
  DISTRICT_RANKINGS,
  MANDALS,
  mandalSqaafStats,
  domainAveragesForDistrict,
  performanceDistributionForDistrict,
} from '@/lib/public/dummyData';

const MANDAL_ROWS = MANDALS.map(mandalSqaafStats);
const topDistricts = [...DISTRICT_RANKINGS].sort((a, b) => b.score - a.score).slice(0, 5);
const MEDAL_COLORS = ['#D4AF37', '#B0B4BA', '#B87333', '#1B2A6B', '#8C5E3C'];

// Statewide totals (illustrative — pending latest UDISE+ import)
const STATE_TOTALS = {
  government: 108320,
  aided: 8470,
  private: 28940,
  other: 4810,
};

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

function districtTotals(district: string) {
  if (district === 'All Districts') {
    const { government, aided, private: priv, other } = STATE_TOTALS;
    return { government, aided, private: priv, other };
  }
  const row = DISTRICT_SCHOOL_CHART.find((r) => r.district === district);
  if (!row) return STATE_TOTALS;
  const base = row.Government + row.Aided + row.Private;
  return {
    government: row.Government,
    aided: row.Aided,
    private: row.Private,
    other: Math.round(base * 0.06),
  };
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
          {DISTRICT_SCHOOL_CHART.map((r) => (
            <option key={r.district}>{r.district}</option>
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

      {/* Domain Performance Analytics */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Domain Performance Analytics</h2>
        <p className="mt-1 text-xs text-gray-500">
          {district === 'All Districts' ? 'Statewide average' : district} · updates with the
          district filter above
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
                <BarChart
                  layout="vertical"
                  data={domainAverages}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill={UP_NAVY} radius={[0, 4, 4, 0]} name="Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">Performance Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {performanceDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Top Performing Districts */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
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

      {/* SQAAF Submission Analytics */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
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

      {/* About */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">About UP SSSA</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          The State School Standards Authority, Uttar Pradesh, monitors and accredits all
          schools across the state — government, aided, and private — to ensure quality
          education aligned with NEP 2020 and the SQAAF framework.
        </p>
      </section>

      {/* Quick access */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
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
