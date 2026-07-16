'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileEdit,
  FileWarning,
  Send,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DisputeAnalytics, InfraGap, WorkflowStageCount } from '@/lib/sssa/adminMetrics';
import { DOMAIN_CHART_LABELS } from '@/lib/up-sqaaf-framework';

const NAVY = '#1B2A6B';
const YELLOW = '#F5B731';

const STAGE_ICONS = [Circle, Send, FileEdit, FileWarning, FileEdit, CheckCircle2] as const;

export function HeroCards({
  totalSchools,
  averageScore,
  lastCycleDelta,
}: {
  totalSchools: number;
  averageScore: number;
  lastCycleDelta: number | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm" style={{ backgroundColor: NAVY }}>
        <Building2 className="absolute right-4 top-4 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium uppercase tracking-wide opacity-90">Total Schools</p>
        <p className="mt-2 text-4xl font-bold">{totalSchools.toLocaleString('en-IN')}</p>
      </div>
      <div className="relative overflow-hidden rounded-2xl p-6 shadow-sm" style={{ backgroundColor: YELLOW, color: NAVY }}>
        <TrendingUp className="absolute right-4 top-4 h-10 w-10 opacity-50" />
        <p className="text-sm font-medium uppercase tracking-wide">Average Score</p>
        {lastCycleDelta != null && (
          <p className="mt-1 text-xs font-medium opacity-80">{lastCycleDelta}% from last cycle</p>
        )}
        <p className="mt-2 text-4xl font-bold">{averageScore > 0 ? `${averageScore}%` : '—'}</p>
      </div>
    </div>
  );
}

export function SubmissionProgress({
  workflow,
  totalSchools,
}: {
  workflow: WorkflowStageCount[];
  totalSchools: number;
}) {
  const total = workflow.reduce((s, w) => s + w.count, 0) || totalSchools || 1;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Submission Progress</h2>
      <p className="mt-1 text-sm text-gray-500">
        Workflow stage counts across {totalSchools.toLocaleString('en-IN')} schools
      </p>
      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full">
        {workflow.map((w) => (
          <div
            key={w.key}
            style={{
              width: `${Math.max((w.count / total) * 100, w.count > 0 ? 2 : 0)}%`,
              backgroundColor: w.color,
            }}
            title={`${w.label}: ${w.count}`}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {workflow.map((w, i) => {
          const Icon = STAGE_ICONS[i] ?? ClipboardList;
          return (
            <div key={w.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <Icon className="h-5 w-5" style={{ color: w.color }} />
              <p className="mt-2 text-xs font-medium text-gray-600 line-clamp-2">{w.label}</p>
              <p className="text-xl font-bold text-gray-900">{w.count}</p>
              <p className="text-xs text-gray-500">{w.pct}% of schools</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PerformanceHighlights({
  low,
  high,
  filterQuery,
}: {
  low: number;
  high: number;
  filterQuery?: string;
}) {
  const base = filterQuery ? `${filterQuery}&` : '';
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link
        href={`/app/sssa/monitoring?${base}performance=low`}
        className="flex items-center justify-between rounded-2xl border-l-4 border-red-500 bg-white p-6 shadow-sm transition hover:shadow-md"
      >
        <div>
          <p className="font-semibold text-gray-900">Low Performing Schools</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{low}</p>
          <p className="mt-2 text-sm text-gray-500">Click to view detailed list</p>
        </div>
        <ArrowRight className="h-6 w-6 text-gray-400" />
      </Link>
      <Link
        href={`/app/sssa/monitoring?${base}performance=high`}
        className="flex items-center justify-between rounded-2xl border-l-4 border-green-500 bg-white p-6 shadow-sm transition hover:shadow-md"
      >
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-600" />
            <p className="font-semibold text-gray-900">High Performing Schools</p>
          </div>
          <p className="mt-1 text-3xl font-bold text-green-600">{high}</p>
          <p className="mt-2 text-sm text-gray-500">Click to view detailed list</p>
        </div>
        <ArrowRight className="h-6 w-6 text-gray-400" />
      </Link>
    </div>
  );
}

export function InfrastructureGaps({ gaps }: { gaps: InfraGap[] }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Statewide Infrastructure Gaps</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {gaps.map((g) => (
          <div key={g.label} className="rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{g.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{g.count}</p>
            <p className="text-xs text-gray-500">{g.pct}% of schools</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-red-500" style={{ width: `${Math.min(g.pct, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PerformanceGaps({
  domainGaps,
  showExport,
}: {
  domainGaps: { domain: string; avgScore: number; belowThreshold: number }[];
  showExport?: boolean;
}) {
  const chartData = domainGaps.map((d) => ({
    name: d.domain.length > 28 ? `${d.domain.slice(0, 28)}…` : d.domain,
    fullName: d.domain,
    score: d.avgScore,
  }));
  const hasData = domainGaps.some((d) => d.avgScore > 0);
  const weakest = [...domainGaps].sort((a, b) => a.avgScore - b.avgScore).slice(0, 4);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Statewide Performance Gaps</h2>
          <p className="mt-1 text-sm text-gray-500">
            Lowest-scoring SQAAF domains across all UP schools, average score and number of schools
            scoring below 40%
          </p>
        </div>
        {showExport && (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Export CSV
          </button>
        )}
      </div>
      {!hasData ? (
        <p className="mt-8 text-center text-sm text-gray-500">Not enough data yet</p>
      ) : (
        <>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="score" fill={YELLOW} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {weakest.map((d) => (
              <div key={d.domain} className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-medium text-gray-600 line-clamp-2">{d.domain}</p>
                <p className="mt-1 text-lg font-bold text-red-600">{d.avgScore}%</p>
                <p className="text-xs text-gray-500">{d.belowThreshold} schools below threshold</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DisputeResolutionSection({
  disputes,
  leftChartTitle,
}: {
  disputes: DisputeAnalytics;
  leftChartTitle: string;
}) {
  const leftData = leftChartTitle.includes('School')
    ? disputes.topSchools
    : leftChartTitle.includes('Block')
      ? disputes.topBlocks
      : leftChartTitle.includes('District')
        ? disputes.topDistricts
        : disputes.topMandals;

  const leftChart = leftData.length > 0 ? leftData : [{ name: 'No data', count: 0 }];
  const catChart = disputes.categories.length > 0 ? disputes.categories : [{ name: 'No data', count: 0, pct: 0 }];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Dispute Resolution Analytics</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Raised', value: disputes.total },
          { label: 'Resolved', value: `${disputes.resolved} (${disputes.closurePct}%)` },
          { label: 'Pending', value: disputes.pending },
          { label: 'Avg Resolution', value: `${disputes.avgResolutionDays} days` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase text-gray-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{leftChartTitle}</p>
          {leftData.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough data yet</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leftChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Most common dispute categories</p>
          {disputes.categories.every((c) => c.count === 0) ? (
            <p className="text-sm text-gray-500">Not enough data yet</p>
          ) : (
            <div className="space-y-2">
              {catChart.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700">{c.name}</span>
                    <span className="text-gray-500">
                      {c.count} ({c.pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.max(c.pct, c.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ManagementTypeChart({
  bars,
}: {
  bars: { type: string; score: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Performance by Management Type</h2>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ bottom: 8 }}>
            <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={60} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'SQAAF score', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
            <Tooltip />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {bars.map((b) => (
                <Cell key={b.type} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ScopeStatCards({
  schoolsLabel,
  totalSchools,
  averageScore,
  topMandalBenchmark,
  topDistrictInMandal,
  topBlockInScope,
}: {
  schoolsLabel: string;
  totalSchools: number;
  averageScore: number;
  topMandalBenchmark: { name: string; avg: number };
  topDistrictInMandal: { name: string; avg: number };
  topBlockInScope: { name: string; avg: number };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <ScopeStatCard label={schoolsLabel} value={totalSchools} icon />
      <ScopeStatCard label="Average SQAAF Score" value={`${averageScore}%`} />
      <ScopeStatCard
        label="Top Mandal (Benchmark)"
        value={topMandalBenchmark.name}
        sub={`${topMandalBenchmark.avg}%`}
      />
      <ScopeStatCard label="Top District (in Mandal)" value={topDistrictInMandal.name} sub={`${topDistrictInMandal.avg}%`} />
      <ScopeStatCard label="Top Block" value={topBlockInScope.name} sub={`${topBlockInScope.avg}%`} />
    </div>
  );
}

function ScopeStatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: boolean;
}) {
  return (
    <div className="relative rounded-2xl bg-white p-4 shadow-sm">
      {icon && <Building2 className="absolute right-3 top-3 h-6 w-6 text-gray-300" />}
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-600">{sub}</p>}
    </div>
  );
}

export { DOMAIN_CHART_LABELS };
