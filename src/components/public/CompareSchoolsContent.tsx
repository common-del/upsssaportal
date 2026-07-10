'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
  SCHOOL_LEVELS,
  SCHOOL_TYPES,
  SQAAF_DOMAINS,
  UP_NAVY,
} from '@/lib/public/constants';
import type { PerformanceLevel } from '@/lib/public/constants';
import { DIRECTORY_LEVEL_BADGE, scoreToLevel } from '@/lib/public/schoolProfile';
import {
  SCHOOLS,
  ALL_DISTRICTS,
  MANAGEMENT_PERFORMANCE,
  LEVEL_PERFORMANCE,
  DISTRICT_RANKINGS,
  getHeatmapData,
  getTopSchoolsByDistrict,
  scoreToStars,
  heatmapCellColor,
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

export type CompareInitialState = {
  tab?: string;
  schools?: string;
  district?: string;
  level?: string;
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

function CompareReportCard({ school, backQuery }: { school: SchoolRecord; backQuery: string }) {
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
          href={`/public/schools/${school.udise}?from=compare&back=${encodeURIComponent(backQuery)}`}
          className="text-sm font-semibold text-[#1B2A6B] hover:underline"
        >
          View Full Profile →
        </Link>
      </div>
    </article>
  );
}

function OverviewTab() {
  const heatmap = getHeatmapData();

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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Management-wise Performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={MANAGEMENT_PERFORMANCE}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" name="Avg Score">
                {MANAGEMENT_PERFORMANCE.map((entry) => (
                  <Cell key={entry.type} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="School Level-wise Performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={LEVEL_PERFORMANCE}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="level"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill={UP_NAVY} name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="District Rankings" className="mt-6">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart layout="vertical" data={DISTRICT_RANKINGS} margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="district" width={90} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="score" fill={UP_NAVY} name="Avg SQAAF" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="mt-6 overflow-x-auto rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-[#1B2A6B]">District × Management Heatmap</h3>
        <p className="mt-1 text-sm text-gray-600">
          Average SQAAF score by district and management type.
        </p>
        <table className="mt-4 w-full min-w-[480px] text-center text-xs sm:text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left">District</th>
              {SCHOOL_TYPES.map((t) => (
                <th key={t} className="px-2 py-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.map((row) => (
              <tr key={row.district} className="border-b border-gray-100">
                <td className="px-2 py-2 text-left font-medium">{row.district}</td>
                {SCHOOL_TYPES.map((type) => {
                  const score = row.scores[type];
                  return (
                    <td key={type} className="px-1 py-1">
                      <div
                        className="flex min-h-[48px] items-center justify-center rounded-md px-2 py-2 font-semibold"
                        style={{ backgroundColor: heatmapCellColor(score) }}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TopByDistrictTab() {
  const districts = getTopSchoolsByDistrict();

  return (
    <>
      <p className="text-gray-600">
        Top performing schools by district based on SQAAF scores.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {districts.map(({ district, avgScore, schools }) => (
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
    </>
  );
}

function CompareSchoolsTab({ initial }: { initial?: CompareInitialState }) {
  const [district, setDistrict] = useState(
    initial?.district && ALL_DISTRICTS.includes(initial.district) ? initial.district : 'All Districts',
  );
  const [level, setLevel] = useState(
    initial?.level && (SCHOOL_LEVELS as readonly string[]).includes(initial.level)
      ? initial.level
      : 'All Levels',
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
      if (level !== 'All Levels' && s.level !== level) return false;
      const q = search.toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !s.udise.includes(q)) return false;
      return true;
    });
  }, [district, level, search]);

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

  const backQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', 'compare');
    if (selected.length) params.set('schools', selected.join(','));
    if (district !== 'All Districts') params.set('district', district);
    if (level !== 'All Levels') params.set('level', level);
    if (search) params.set('search', search);
    return params.toString();
  }, [selected, district, level, search]);

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
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option>All Levels</option>
          {SCHOOL_LEVELS.map((l) => (
            <option key={l}>{l}</option>
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
            <CompareReportCard key={school.id} school={school} backQuery={backQuery} />
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

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-white p-4 shadow-sm', className)}>
      <h3 className="mb-3 font-semibold text-[#1B2A6B]">{title}</h3>
      {children}
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

