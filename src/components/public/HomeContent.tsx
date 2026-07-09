'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  LogIn,
  Search,
  Building2,
  GraduationCap,
  BadgeCheck,
  Landmark,
  Building,
  Layers,
  Briefcase,
  School,
  FileText,
  GitCompareArrows,
} from 'lucide-react';
import { UP_NAVY, UP_GOLD } from '@/lib/public/constants';
import { DISTRICT_SCHOOL_CHART } from '@/lib/public/dummyData';

const AIDED_BLUE = '#3B82F6';
const OTHER_GREEN = '#22C55E';

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

const PENDING_BADGE = (
  <span className="rounded-md bg-[#FDE68A] px-2.5 py-1 text-xs font-medium text-[#92400E]">
    Pending latest UDISE+ import
  </span>
);

export function HomeContent() {
  const [district, setDistrict] = useState('All Districts');

  const totals = districtTotals(district);
  const totalSchools = totals.government + totals.aided + totals.private + totals.other;
  const assessed = Math.round(totalSchools * 0.3);
  const verified = Math.round(totalSchools * 0.256);

  const chartData = (
    district === 'All Districts'
      ? DISTRICT_SCHOOL_CHART
      : DISTRICT_SCHOOL_CHART.filter((r) => r.district === district)
  ).map((r) => ({
    ...r,
    Other: Math.round((r.Government + r.Aided + r.Private) * 0.06),
  }));

  const managementCards = [
    {
      label: 'Govt / Aided Schools',
      value: totals.government + totals.aided,
      description: 'Public schools under UP SSSA jurisdiction',
      icon: Landmark,
    },
    {
      label: 'Government Schools',
      value: totals.government,
      description: 'Under UP SSSA jurisdiction',
      icon: Building,
    },
    {
      label: 'Aided Schools',
      value: totals.aided,
      description: 'Subtype under the broader public education category',
      icon: Layers,
    },
    {
      label: 'Private Schools',
      value: totals.private,
      description: 'Under UP SSSA jurisdiction',
      icon: Briefcase,
    },
    {
      label: 'Other Schools',
      value: totals.other,
      description: 'Under UP SSSA jurisdiction',
      icon: School,
    },
  ];

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

      {/* Management category */}
      <h2 className="mt-8 text-base font-semibold text-gray-900">
        Schools by Management Category
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {managementCards.map(({ label, value, description, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start justify-between rounded-xl bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1B2A6B]">{formatIN(value)}</p>
              <p className="mt-1 text-xs text-gray-500">{description}</p>
            </div>
            <div className="rounded-lg bg-gray-100 p-2.5 text-[#1B2A6B]">
              <Icon size={20} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        Source: Pending latest UDISE+ import {PENDING_BADGE}
      </p>

      {/* District-wise chart */}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">
            District-wise Schools under UP SSSA jurisdiction
          </h2>
          {PENDING_BADGE}
        </div>
        <div className="mt-4 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="district"
                angle={-45}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 12 }} />
              <Bar dataKey="Government" stackId="a" fill={UP_NAVY} />
              <Bar dataKey="Aided" stackId="a" fill={AIDED_BLUE} />
              <Bar dataKey="Private" stackId="a" fill={UP_GOLD} />
              <Bar dataKey="Other" stackId="a" fill={OTHER_GREEN} />
            </BarChart>
          </ResponsiveContainer>
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
