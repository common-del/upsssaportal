'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Building2,
  GraduationCap,
  BadgeCheck,
  AlertTriangle,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  CalendarClock,
  Compass,
} from 'lucide-react';
import { ExplainerFilm } from '@/components/public/ExplainerFilm';
import {
  ALL_DISTRICTS,
  districtSqaafStats,
} from '@/lib/public/dummyData';
import { SearchableSelect } from '@/components/public/SearchableSelect';

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

// Grounded in the real SQAAF rules already established elsewhere on the site
// (About page, self-assessment/verification flow) - not invented statistics.
const DID_YOU_KNOW = [
  {
    icon: Sparkles,
    color: '#E0A100',
    tint: 'rgba(242,176,30,0.14)',
    title: "A tier isn't a punishment",
    desc: 'Uday means "needs improvement," not "failing" — every school can move up a tier over time.',
  },
  {
    icon: ShieldCheck,
    color: '#2F6FB0',
    tint: 'rgba(47,111,176,0.12)',
    title: 'Scores are independently verified',
    desc: "A trained external evaluator reviews every school's self-assessment before a final score is given.",
  },
  {
    icon: ClipboardCheck,
    color: '#15803D',
    tint: 'rgba(21,128,61,0.12)',
    title: 'You can raise a concern',
    desc: "Disagree with a school's record? Grievance redressal is open to every parent.",
  },
  {
    icon: CalendarClock,
    color: '#E56A4F',
    tint: 'rgba(229,106,79,0.12)',
    title: 'Assessed every academic year',
    desc: "SQAAF runs each cycle, so a school's tier reflects where it stands now — not years ago.",
  },
] as const;

export function HomeContent() {
  const [district, setDistrict] = useState('All Districts');

  const totals = districtTotals(district);
  const totalSchools = totals.government + totals.aided + totals.private + totals.other;
  const assessed = Math.round(totalSchools * 0.3);
  const verified = Math.round(totalSchools * 0.256);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero + explainer film */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <section className="flex flex-col justify-center rounded-2xl bg-[#1B2A6B] p-7 text-white sm:p-9">
          <span className="text-xs font-bold uppercase tracking-wide text-[#F5B731]">
            SQAAF · School Quality Assessment and Accreditation Framework
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            Every school&apos;s quality, in your hands.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
            Most parents are here to check a school they already know — that comes first.
          </p>
          <div className="mt-6">
            <Link
              href="/public/directory"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#F5B731] px-6 text-sm font-bold text-[#1B2A6B] shadow-sm transition hover:opacity-90 sm:text-base"
            >
              <Search size={17} />
              Check Your School&apos;s Rating
            </Link>
          </div>
          <div className="mt-3 flex justify-center">
            <Link
              href="/public/find"
              className="flex items-center gap-1.5 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <Compass size={13} />
              Help me choose a school for my child
            </Link>
          </div>
        </section>

        <ExplainerFilm
          title="What SQAAF Means for Your Child's School"
          description="A short film on the three performance tiers and how to read them"
        />
      </div>

      {/* About + Did you know */}
      <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm md:p-7">
        <div className="grid gap-6 md:grid-cols-[11fr_9fr] md:gap-0">
          <div className="md:pr-8">
            <h2 className="text-lg font-bold text-gray-900">
              About State School Standards Authority (SSSA)
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              The State School Standards Authority, Uttar Pradesh is an independent body (set up
              under India&apos;s NEP 2020) that sets and monitors quality standards for schools
              statewide. Every school completes a{' '}
              <strong className="text-gray-800">
                School Quality Assessment and Accreditation Framework (SQAAF)
              </strong>{' '}
              self-assessment and lands in one of three tiers based on its score.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#FCE7F3] px-3 py-1 text-xs font-bold text-[#1B2A6B]">
                Uday · Upto 55%
              </span>
              <span className="rounded-full bg-[#FEF9C3] px-3 py-1 text-xs font-bold text-[#1B2A6B]">
                Unnat · 55–80%
              </span>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#1B2A6B]">
                Utkarsh · Above 80%
              </span>
            </div>

            <Link
              href="/public/about"
              className="mt-4 inline-block text-sm font-medium text-[#1B2A6B] underline hover:no-underline"
            >
              Learn more about the Authority and its assessment framework
            </Link>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6 md:mt-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <h2 className="text-lg font-bold text-gray-900">Did you know?</h2>
            <ul className="mt-3 space-y-4">
              {DID_YOU_KNOW.map((r) => (
                <li key={r.title} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ backgroundColor: r.tint }}
                  >
                    <r.icon size={19} color={r.color} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold leading-snug text-gray-900">
                      {r.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                      {r.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Statewide numbers — one simple band, district filter folded in */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Statewide Numbers</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="home-district" className="text-xs font-medium text-gray-500">
              District:
            </label>
            <SearchableSelect
              id="home-district"
              value={district}
              onChange={setDistrict}
              options={ALL_DISTRICTS.map((d) => ({ value: d, label: d }))}
              allLabel="All Districts"
              allValue="All Districts"
              searchPlaceholder="Search district..."
              ariaLabel="Filter District"
              className="w-[180px]"
              buttonClassName="px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
        <div className="mt-4 grid divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3.5 py-4 sm:px-5 sm:py-0">
            <div className="rounded-lg bg-[#EEF0F8] p-2.5 text-[#1B2A6B]">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatIN(totalSchools)}</p>
              <p className="text-xs font-medium text-gray-500">Total Schools</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 py-4 sm:px-5 sm:py-0">
            <div className="rounded-lg bg-[#EEF0F8] p-2.5 text-[#1B2A6B]">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatIN(assessed)}</p>
              <p className="text-xs font-medium text-gray-500">Schools Assessed</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 py-4 sm:px-5 sm:py-0">
            <div className="rounded-lg bg-[#EEF0F8] p-2.5 text-[#1B2A6B]">
              <BadgeCheck size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatIN(verified)}</p>
              <p className="text-xs font-medium text-gray-500">SQAAF Verified</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Detailed district rankings, domain-wise analytics, and mandal-level tables are on the{' '}
          <Link href="/public/reports" className="font-medium text-[#1B2A6B] underline hover:no-underline">
            State Reports
          </Link>{' '}
          page.
        </p>
      </section>

      {/* Grievance redressal — promoted, visible without deep scrolling */}
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#EEF0F8] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#C24E36]">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Something not add up for your school?</p>
            <p className="text-xs text-gray-500">Raise a grievance, or track one you&apos;ve already filed.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/public/dispute/new"
            className="rounded-lg border border-[#1B2A6B] px-4 py-2 text-xs font-bold text-[#1B2A6B] hover:bg-white"
          >
            Raise a Grievance
          </Link>
          <Link
            href="/public/dispute/track"
            className="rounded-lg px-4 py-2 text-xs font-bold text-[#1B2A6B] underline hover:no-underline"
          >
            Track a Grievance
          </Link>
        </div>
      </section>
    </div>
  );
}
