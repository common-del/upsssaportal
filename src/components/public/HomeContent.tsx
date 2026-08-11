'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Building2,
  GraduationCap,
  BadgeCheck,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Compass,
  MapPin,
} from 'lucide-react';
import { ExplainerFilm } from '@/components/public/ExplainerFilm';
import { SearchableSelect } from '@/components/public/SearchableSelect';
import type { RegisterStats } from '@/lib/public/registerStats';

const ALL_DISTRICTS_LABEL = 'All Districts';

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

/* STATE_TOTALS and districtTotals are gone with the multipliers that used them. The
   first was a hardcoded 2,48,998 — a statewide figure for Uttar Pradesh presented as
   this portal's school count. The second reached districtSqaafStats, which invents a
   district's entire profile from a hash of its name for any district outside a short
   curated list. Neither belongs behind a number a parent reads as fact. */

// Grounded in the real SQAAF domain weightages (constants.ts) and the
// self-assessment/verification flow already established elsewhere on the
// site - not invented statistics.
const DID_YOU_KNOW = [
  {
    icon: TrendingUp,
    color: '#7E3AC4',
    tint: 'rgba(126,58,196,0.12)',
    title: 'Learning outcomes count the most',
    desc: "Assessment and Learning Outcomes carries 30% of a school's score — more than any other domain.",
  },
  {
    icon: ShieldCheck,
    color: '#2F6FB0',
    tint: 'rgba(47,111,176,0.12)',
    title: 'Scores are verified after self-assessment',
    desc: "An independent evaluator checks every school's self-assessment.",
  },
  {
    icon: ClipboardList,
    color: '#C9911A',
    tint: 'rgba(201,145,26,0.12)',
    title: 'Schools get a plan to move up',
    desc: 'Schools that need to improve receive a customised improvement plan to help them reach the next tier.',
  },
] as const;

export function HomeContent({ stats }: { stats: RegisterStats | null }) {
  const [district, setDistrict] = useState(ALL_DISTRICTS_LABEL);

  // Was: totalSchools from a hardcoded 2,48,998 statewide figure, then
  // `assessed = totalSchools * 0.3` and `verified = totalSchools * 0.256`. Three
  // headline numbers on the front page of a government portal, two of them
  // arithmetic and all three recomputed as the selector moved, so the invented ones
  // changed per district and read exactly like data.
  const counts =
    stats == null
      ? null
      : district === ALL_DISTRICTS_LABEL
        ? stats.state
        : (stats.byDistrict[district] ?? {
            schools: 0,
            assessed: 0,
            verified: 0,
            students: 0,
            studentProfiles: 0,
          });

  const districtOptions = stats?.districts ?? [];

  // Districts the register covers. One, once the selector narrows to one — the tile
  // describes what is being shown, not what exists behind the filter.
  const districtsShown =
    district === ALL_DISTRICTS_LABEL ? (stats?.districts.length ?? 0) : 1;

  /* Five tiles, in the order a reader needs them: how many schools, how many children,
     how far the register reaches, then how far through assessment it has got.

     The pupil tile is dropped when nothing is behind it rather than shown as zero. Its
     figure is summed from the enrolment schools enter on their own profile, because the
     register carries no enrolment of its own — see registerStats.ts for why the UDISE
     extract on disk cannot supply it. "Students enrolled: 0" beside 32,579 schools would
     be read as a claim about children, not as an empty field. */
  const tiles: { key: string; icon: typeof Building2; tint: string; value: number; label: string; note?: string }[] =
    counts == null
      ? []
      : [
          {
            key: 'schools',
            icon: Building2,
            tint: 'bg-[#FDF0D6] text-[#B67F09]',
            value: counts.schools,
            label: 'Schools on the register',
          },
          ...(counts.students > 0
            ? [
                {
                  key: 'students',
                  icon: GraduationCap,
                  tint: 'bg-[#E6EAF7] text-[#2E4499]',
                  value: counts.students,
                  label: 'Students enrolled',
                  // The denominator travels with the number, so a partial figure can
                  // never be mistaken for a register-wide one. Dropped once every school
                  // is counted: "from 32,579 school profiles" beside "32,579 schools on
                  // the register" states the same fact twice and reads as a caveat where
                  // there is none.
                  note:
                    counts.studentProfiles < counts.schools
                      ? `from ${formatIN(counts.studentProfiles)} school ${
                          counts.studentProfiles === 1 ? 'profile' : 'profiles'
                        }`
                      : undefined,
                },
              ]
            : []),
          {
            key: 'districts',
            icon: MapPin,
            tint: 'bg-[#E6EAF7] text-[#2E4499]',
            value: districtsShown,
            label: 'Districts covered',
          },
          {
            key: 'assessed',
            icon: ClipboardList,
            tint: 'bg-[#E6EAF7] text-[#2E4499]',
            value: counts.assessed,
            label: 'Self-assessments filed',
          },
          {
            key: 'verified',
            icon: BadgeCheck,
            tint: 'bg-[#E2F3EA] text-[#16794B]',
            value: counts.verified,
            label: 'Checked by a verifier',
          },
        ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero + explainer film — one merged navy card */}
      <div className="grid overflow-hidden rounded-2xl bg-[#1B2A6B] shadow-sm lg:grid-cols-2">
        <section className="flex flex-col justify-center p-7 text-white sm:p-9">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            Every school&apos;s quality, in your hands.
          </h1>
          <p className="mt-3.5 text-sm leading-relaxed text-white/85 sm:text-base">
            See how your school is rated on the School Quality Assessment and Accreditation
            Framework (SQAAF).
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/public/find-your-school"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#F5B731] px-6 text-sm font-bold text-[#1B2A6B] shadow-sm transition hover:opacity-90 sm:text-base"
            >
              <Search size={17} />
              Check Your School&apos;s Rating
            </Link>
            <Link
              href="/public/find"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10 sm:text-base"
            >
              <Compass size={17} />
              Help Me Choose a School for My Child
            </Link>
          </div>
        </section>

        <ExplainerFilm
          title="What SQAAF Means for Your Child's School"
          description="A short film on the three performance tiers — Uday, Unnat, and Utkarsh — and what they mean for your child's school."
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

      {/* Register counts, district filter folded in. Absent entirely when the register
          cannot be read — three dashes and an empty district picker is worse than no
          band at all, and there is nothing honest to put there. */}
      {counts && (
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Schools on this portal</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="home-district" className="text-xs font-medium text-gray-500">
              District:
            </label>
            <SearchableSelect
              id="home-district"
              value={district}
              onChange={setDistrict}
              options={districtOptions.map((d) => ({ value: d, label: d }))}
              allLabel={ALL_DISTRICTS_LABEL}
              allValue={ALL_DISTRICTS_LABEL}
              searchPlaceholder="Search district..."
              ariaLabel="Filter District"
              className="w-[180px]"
              buttonClassName="px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
        {/* Hairlines come from a 1px gap over a grey parent rather than divide-x: with
            five tiles the row wraps at most widths, and divide-x draws its rules down
            the wrong edges the moment it does. auto-fit keeps the tiles even whether
            there are four of them or five. */}
        <div className="mt-4 grid gap-px overflow-hidden rounded-xl bg-gray-100 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {tiles.map((t) => (
            <div key={t.key} className="flex items-center gap-3 bg-white px-4 py-4">
              <div className={`shrink-0 rounded-lg p-2.5 ${t.tint}`}>
                <t.icon size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">
                  {formatIN(t.value)}
                </p>
                <p className="text-xs font-medium leading-snug text-gray-500">{t.label}</p>
                {t.note && (
                  <p className="mt-0.5 text-[10px] leading-snug text-gray-400">{t.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

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
