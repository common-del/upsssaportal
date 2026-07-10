'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GraduationCap, Trophy, Star, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SCHOOL_TYPES, SQAAF_DOMAINS } from '@/lib/public/constants';
import type { PerformanceLevel } from '@/lib/public/constants';
import { DIRECTORY_LEVEL_BADGE, scoreToLevel } from '@/lib/public/schoolProfile';
import {
  SCHOOLS,
  ALL_DISTRICTS,
  DISTRICT_RANKINGS,
  getTopSchoolsByDistrict,
  managementPerformanceForDistrict,
  scoreToStars,
  type SchoolRecord,
} from '@/lib/public/dummyData';
import { SearchableSelect } from '@/components/public/SearchableSelect';

const DOMAIN_LABELS: Record<(typeof SQAAF_DOMAINS)[number], string> = {
  'Infrastructure and Safety': 'Infrastructure & Safety',
  'Administration, HR and Leadership': 'Admin, HR & Leadership',
  'Teaching and Learning': 'Teaching & Learning',
  'Assessment and Learning Outcomes': 'Assessment & Outcomes',
  'Inclusiveness and Community Engagement': 'Inclusiveness & Engagement',
};

const LEVEL_BAR_FILL: Record<PerformanceLevel, string> = {
  Uday: '#F9A8D4',
  Unnat: '#FDE68A',
  Utkarsh: '#86EFAC',
};

const LEVEL_PILL_LARGE: Record<PerformanceLevel, string> = {
  Uday: 'bg-[#FCE7F3] text-pink-800',
  Unnat: 'bg-[#FEF9C3] text-amber-800',
  Utkarsh: 'bg-[#DCFCE7] text-green-800',
};

const TABS = ['Overview', 'Top by District', 'Compare Schools'] as const;
type Tab = (typeof TABS)[number];

// Same ranked medal-list treatment as the homepage's "Top 5 Districts" section,
// extended to the top 10.
const TOP_10_DISTRICTS = [...DISTRICT_RANKINGS].sort((a, b) => b.score - a.score).slice(0, 10);
const MEDAL_COLORS = ['#D4AF37', '#B0B4BA', '#B87333', '#1B2A6B', '#8C5E3C'];
function medalColor(rank: number): string {
  return MEDAL_COLORS[rank] ?? '#1B2A6B';
}

const DISTRICTS_PER_PAGE = 12;

export type CompareInitialState = {
  tab?: string;
  schools?: string;
  district?: string;
  type?: string;
  search?: string;
};

export function CompareSchoolsContent({ initial }: { initial?: CompareInitialState }) {
  const [tab, setTab] = useState<Tab>(initial?.tab === 'compare' ? 'Compare Schools' : 'Overview');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">🔀 Compare Schools</h1>
      <p className="mt-2 max-w-3xl text-gray-600">
        Explore, rank and compare schools across Uttar Pradesh. Built for parents, communities
        and officials.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-[#1B2A6B] text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <OverviewTab />}
        {tab === 'Top by District' && <TopByDistrictTab />}
        {tab === 'Compare Schools' && <CompareSchoolsTab initial={initial} />}
      </div>

      <FindSchoolBanner />
    </div>
  );
}

function FindSchoolBanner() {
  return (
    <div className="mt-12 rounded-2xl bg-[#EFF6FF] p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1B2A6B]">
        <GraduationCap className="h-7 w-7 text-white" strokeWidth={2} />
      </div>
      <h2 className="mt-4 text-xl font-bold text-[#1B2A6B] sm:text-2xl">
        Want to find the right school for your child?
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-gray-600">
        Answer a few simple questions about your child&apos;s needs and we&apos;ll show you matching
        schools in your area.
      </p>
      <Link
        href="/public/find"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1B2A6B] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Find Schools →
      </Link>
    </div>
  );
}

function CompareReportCard({ school }: { school: SchoolRecord }) {
  const level = school.performanceLevel;

  return (
    <article className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
      <h3 className="text-lg font-bold text-[#1B2A6B] sm:text-xl">{school.name}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {school.district} · {school.type} · {school.level}
      </p>

      <div className="mt-6 flex flex-col items-center">
        <span
          className={cn(
            'rounded-full px-5 py-2 text-base font-bold sm:text-lg',
            LEVEL_PILL_LARGE[level],
          )}
        >
          {level}
        </span>
        <p className="mt-4 text-3xl font-bold text-[#1B2A6B] sm:text-4xl">
          {school.overallScore}
          <span className="text-xl font-semibold text-gray-400">/100</span>
        </p>
      </div>

      <div className="my-6 border-t border-gray-200" />

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Domain Performance
      </p>
      <ul className="mt-4 space-y-4">
        {SQAAF_DOMAINS.map((domain) => {
          const score = school.domainScores[domain];
          const domainLevel = scoreToLevel(score);
          return (
            <li key={domain}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{DOMAIN_LABELS[domain]}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    DIRECTORY_LEVEL_BADGE[domainLevel],
                  )}
                >
                  {domainLevel}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score}%`,
                    backgroundColor: LEVEL_BAR_FILL[domainLevel],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <Link
          href={`/public/schools/${school.udise}`}
          className="text-sm font-semibold text-[#1B2A6B] hover:underline"
        >
          View Full Profile →
        </Link>
      </div>
    </article>
  );
}

function OverviewTab() {
  const [mgmtDistrict, setMgmtDistrict] = useState('All Districts');
  const managementPerformance = useMemo(
    () => managementPerformanceForDistrict(mgmtDistrict),
    [mgmtDistrict],
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="STATE AVERAGE SQAAF"
          value="54.2%"
          subtitle="Across 45 schools (sampled)"
        />
        <SummaryCard title="TOP DISTRICT" value="Lucknow" subtitle="Avg 63.1%" />
        <SummaryCard title="BEST MANAGEMENT" value="Private" subtitle="Avg 61.5%" />
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[#1B2A6B]">Management-wise Performance</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="mgmt-district" className="text-xs font-medium text-gray-600">
              District:
            </label>
            <SearchableSelect
              id="mgmt-district"
              value={mgmtDistrict}
              onChange={setMgmtDistrict}
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
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={managementPerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" name="Avg Score">
              {managementPerformance.map((entry) => (
                <Cell key={entry.type} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">
          Top 10 Districts — Best Performing Schools
        </h3>
        <p className="mt-1 text-xs text-gray-500">Ranked by average SQAAF school score, statewide</p>

        <div className="mt-5 space-y-3">
          {TOP_10_DISTRICTS.map((row, i) => (
            <div key={row.district} className="flex items-center gap-4">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: medalColor(i) }}
              >
                {i + 1}
              </div>
              <div className="w-28 shrink-0 text-sm font-medium text-gray-900">{row.district}</div>
              <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${row.score}%`,
                    backgroundColor: medalColor(i),
                  }}
                />
              </div>
              <div className="w-12 shrink-0 text-right text-sm font-semibold text-[#1B2A6B]">
                {row.score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TopByDistrictTab() {
  const allDistricts = useMemo(() => getTopSchoolsByDistrict(), []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDistricts;
    return allDistricts.filter((d) => d.district.toLowerCase().includes(q));
  }, [allDistricts, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / DISTRICTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * DISTRICTS_PER_PAGE,
    currentPage * DISTRICTS_PER_PAGE,
  );

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600">
          Top performing schools by district based on SQAAF scores. Covering all 75 districts of
          Uttar Pradesh.
        </p>
        <div className="relative w-full sm:w-64 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search district..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm"
          />
        </div>
      </div>

      {paged.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No districts match &quot;{search}&quot;.</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.map(({ district, avgScore, schools }) => (
          <div key={district} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Trophy className="text-[#F5B731]" size={20} />
              <div>
                <h3 className="font-semibold text-[#1B2A6B]">{district}</h3>
                <p className="text-sm text-gray-500">Avg {avgScore}%</p>
              </div>
            </div>
            <ul className="mt-3 space-y-3">
              {schools.map((s) => (
                <li key={s.rank} className="flex gap-2 text-sm">
                  <span className="font-bold text-[#F5B731]">#{s.rank}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.type} · {s.level}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-semibold text-[#1B2A6B]">{s.score}%</span>
                      <StarRating score={s.score} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

function CompareSchoolsTab({ initial }: { initial?: CompareInitialState }) {
  const router = useRouter();
  const pathname = usePathname();

  const [district, setDistrict] = useState(
    initial?.district && ALL_DISTRICTS.includes(initial.district) ? initial.district : 'All Districts',
  );
  const [type, setType] = useState(
    initial?.type && (SCHOOL_TYPES as readonly string[]).includes(initial.type)
      ? initial.type
      : 'All Types',
  );
  const [search, setSearch] = useState(initial?.search ?? '');
  const [selected, setSelected] = useState<string[]>(() => {
    if (!initial?.schools) return [];
    return initial.schools
      .split(',')
      .filter((id) => SCHOOLS.some((s) => s.id === id))
      .slice(0, 4);
  });

  const filtered = useMemo(() => {
    return SCHOOLS.filter((s) => {
      if (district !== 'All Districts' && s.district !== district) return false;
      if (type !== 'All Types' && s.type !== type) return false;
      const q = search.toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !s.udise.includes(q)) return false;
      return true;
    });
  }, [district, type, search]);

  const selectedSchools = useMemo(
    () =>
      selected
        .map((id) => SCHOOLS.find((s) => s.id === id))
        .filter((s): s is SchoolRecord => Boolean(s)),
    [selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  // Keep the URL in sync with the current filters/selection so that real
  // browser back/forward navigation lands on this exact comparison, not a
  // blank Compare Schools page.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', 'compare');
    if (selected.length) params.set('schools', selected.join(','));
    if (district !== 'All Districts') params.set('district', district);
    if (type !== 'All Types') params.set('type', type);
    if (search) params.set('search', search);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selected, district, type, search, pathname, router]);

  const compareGridClass = cn(
    'mt-8 grid gap-6',
    selectedSchools.length === 2 && 'md:grid-cols-2',
    selectedSchools.length === 3 && 'md:grid-cols-2 lg:grid-cols-3',
    selectedSchools.length === 4 && 'md:grid-cols-2',
  );

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <SearchableSelect
          value={district}
          onChange={setDistrict}
          options={ALL_DISTRICTS.map((d) => ({ value: d, label: d }))}
          allLabel="All Districts"
          allValue="All Districts"
          searchPlaceholder="Search district..."
          ariaLabel="District"
          className="w-[200px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option>All Types</option>
          {SCHOOL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or UDISE"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm"
          />
        </div>
      </div>

      <ul className="mt-4 max-h-80 divide-y overflow-y-auto rounded-xl bg-white shadow-sm">
        {filtered.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <button
              type="button"
              onClick={() => toggle(s.id)}
              disabled={!selected.includes(s.id) && selected.length >= 4}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                selected.includes(s.id)
                  ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white'
                  : 'border-gray-300 text-gray-400 disabled:opacity-40',
              )}
              aria-label={selected.includes(s.id) ? 'Remove school' : 'Add school'}
            >
              <Plus size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.name}</p>
              <p className="text-xs text-gray-500">
                {s.district} · {s.type} · {s.level}
              </p>
            </div>
            <span className="font-semibold text-[#1B2A6B]">{s.overallScore}%</span>
            <StarRating score={s.overallScore} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-gray-600">{selected.length} of 4 selected</p>

      {selectedSchools.length >= 2 && (
        <div className={compareGridClass}>
          {selectedSchools.map((school) => (
            <CompareReportCard key={school.id} school={school} />
          ))}
        </div>
      )}

      {selectedSchools.length === 1 && (
        <p className="mt-4 text-sm text-amber-700">
          Select at least one more school to compare (up to 4 total).
        </p>
      )}
    </>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[#1B2A6B]">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const stars = scoreToStars(score);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < stars ? 'fill-[#F5B731] text-[#F5B731]' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

