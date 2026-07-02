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
  Building2,
  Eye,
  BadgeCheck,
  Search,
  FileText,
  ArrowRight,
  School,
} from 'lucide-react';
import { DISTRICTS, UP_NAVY, UP_GOLD, UP_ORANGE } from '@/lib/public/constants';
import { DISTRICT_SCHOOL_CHART } from '@/lib/public/dummyData';

const PERFORMANCE_LEVEL_CARDS = [
  {
    emoji: '🔴',
    label: 'UDAY',
    count: '15,240 schools',
    pct: '21.7%',
    subtitle: 'Needs Improvement',
    bg: 'bg-[#FCE7F3]',
    text: 'text-gray-900',
  },
  {
    emoji: '🟡',
    label: 'UNNAT',
    count: '20,180 schools',
    pct: '44.6%',
    subtitle: 'Developing',
    bg: 'bg-[#FEF9C3]',
    text: 'text-gray-900',
  },
  {
    emoji: '🟢',
    label: 'UTKARSH',
    count: '9,810 schools',
    pct: '33.7%',
    subtitle: 'Proficient',
    bg: 'bg-[#DCFCE7]',
    text: 'text-gray-900',
  },
] as const;

const QUICK_ACCESS = [
  {
    href: '/public/find',
    title: '🔍 Find School',
    description: 'Answer a few questions to find the right school for your child',
    icon: Search,
  },
  {
    href: '/public/directory',
    title: '🏫 School Directory',
    description: 'Browse and search all schools in Uttar Pradesh',
    icon: School,
  },
  {
    href: '/public/reports',
    title: '📊 Public Reports',
    description: 'View state, district and school performance reports',
    icon: FileText,
  },
] as const;

export function HomeContent() {
  const [district, setDistrict] = useState<string>('All Districts');

  const chartData =
    district === 'All Districts'
      ? DISTRICT_SCHOOL_CHART
      : DISTRICT_SCHOOL_CHART.filter((d) => d.district === district);

  return (
    <>
      <section className="bg-[#1B2A6B] px-4 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
            State School Standards Authority — Uttar Pradesh
          </h1>
          <p className="mt-2 text-lg text-white/90">
            School Quality Monitoring and Accreditation Portal
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5B731] px-5 py-2.5 text-sm font-semibold text-[#1B2A6B] transition-opacity hover:opacity-90"
            >
              <ArrowRight size={16} />
              Login
            </Link>
            <Link
              href="/public/find"
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/20"
            >
              <Search size={16} />
              Find School
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/75">
            Access school information, performance reports, and grievance services.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="district-filter" className="text-sm font-medium text-gray-700">
            Filter District:
          </label>
          <select
            id="district-filter"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          >
            <option>All Districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            variant="navy"
            label="TOTAL SCHOOLS"
            value="1,50,540"
            icon={Building2}
          />
          <StatCard
            variant="white"
            label="SCHOOLS ASSESSED"
            value="45,230"
            icon={Eye}
          />
          <StatCard
            variant="gold"
            label="SQAAF VERIFIED SCHOOLS"
            value="12,875"
            icon={BadgeCheck}
          />
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {PERFORMANCE_LEVEL_CARDS.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl p-5 shadow-sm ${card.bg} ${card.text}`}
            >
              <p className="text-sm font-bold">
                {card.emoji} {card.label}
              </p>
              <p className="mt-2 text-xl font-bold sm:text-2xl">{card.count}</p>
              <p className="mt-1 text-lg font-semibold">{card.pct}</p>
              <p className="mt-1 text-xs text-gray-600">{card.subtitle}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#1B2A6B]">
            District-wise Schools under SSSA UP jurisdiction
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="district" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                <Bar dataKey="Government" stackId="a" fill={UP_NAVY} name="Government" />
                <Bar dataKey="Aided" stackId="a" fill={UP_GOLD} name="Aided" />
                <Bar dataKey="Private" stackId="a" fill={UP_ORANGE} name="Private" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <section id="about" className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#1B2A6B]">About SSSA UP</h2>
          <p className="mt-3 leading-relaxed text-gray-600">
            The State School Standards Authority, Uttar Pradesh, monitors and accredits all
            schools across the state — government, aided, and private schools — to
            ensure quality education aligned with NEP 2020 and the UP-SQAAF framework.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_ACCESS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1B2A6B] text-white">
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#1B2A6B]">{title}</p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
              <ArrowRight
                size={20}
                className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1B2A6B]"
              />
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-400">
          For unresolved issues regarding a school, you may use the{' '}
          <Link
            href="/public/dispute/new"
            className="underline hover:text-gray-600"
          >
            Grievance Redressal
          </Link>{' '}
          facility or{' '}
          <Link
            href="/public/dispute/track"
            className="underline hover:text-gray-600"
          >
            track an existing grievance
          </Link>
          .
        </p>
      </div>
    </>
  );
}

function StatCard({
  variant,
  label,
  value,
  icon: Icon,
}: {
  variant: 'navy' | 'white' | 'gold';
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const styles = {
    navy: 'bg-[#1B2A6B] text-white',
    white: 'bg-white text-[#1B2A6B]',
    gold: 'bg-[#F5B731] text-[#1B2A6B]',
  };
  const iconStyles = {
    navy: 'text-[#F5B731]',
    white: 'text-[#1B2A6B]',
    gold: 'text-[#1B2A6B]',
  };

  return (
    <div className={`rounded-xl p-5 shadow-sm ${styles[variant]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide opacity-90">{label}</p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
        </div>
        <Icon size={28} className={iconStyles[variant]} />
      </div>
    </div>
  );
}
