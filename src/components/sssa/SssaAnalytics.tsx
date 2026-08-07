'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { AnalyticsData, RankedChild } from '@/lib/sssa/adminMetrics';
import {
  DisputeResolutionSection,
  InfrastructureGaps,
  ManagementTypeChart,
  PerformanceGaps,
  PerformanceHighlights,
  ScopeStatCards,
  SubmissionProgress,
} from '@/components/sssa/dashboard/DashboardSections';

const NAVY = '#1B2A6B';

/** Scope lives entirely in the URL, so a view is shareable and the browser's own
 *  back button walks back up the hierarchy. */
function href(scope: { mandal?: string; district?: string; block?: string }) {
  const params = new URLSearchParams();
  if (scope.mandal) params.set('mandal', scope.mandal);
  if (scope.district) params.set('district', scope.district);
  if (scope.block) params.set('block', scope.block);
  const qs = params.toString();
  return `/app/sssa${qs ? `?${qs}` : ''}`;
}

const SCHOOLS_LABEL: Record<AnalyticsData['level'], string> = {
  state: 'Schools in State',
  mandal: 'Schools in Mandal',
  district: 'Schools in District',
  block: 'Schools in Block',
};

const LEVEL_LABEL: Record<AnalyticsData['level'], string> = {
  state: 'State',
  mandal: 'Mandal',
  district: 'District',
  block: 'Block',
};

function Trail({ data }: { data: AnalyticsData }) {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Uttar Pradesh', to: data.level === 'state' ? undefined : href({}) },
  ];
  if (data.mandalName) {
    crumbs.push({
      label: data.mandalName,
      to: data.level === 'mandal' ? undefined : href({ mandal: data.mandalCode }),
    });
  }
  if (data.districtName) {
    crumbs.push({
      label: data.districtName,
      to:
        data.level === 'district'
          ? undefined
          : href({ mandal: data.mandalCode, district: data.districtCode }),
    });
  }
  if (data.blockName) crumbs.push({ label: data.blockName });

  return (
    <nav aria-label="Analytics scope" className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={13} className="text-gray-400" aria-hidden />}
          {c.to ? (
            <Link
              href={c.to}
              className="rounded px-1 py-0.5 text-[#1B2A6B] underline underline-offset-2 hover:bg-[#1B2A6B]/[0.07]"
            >
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="px-1 py-0.5 font-bold text-gray-900">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** The ranking answers "who is behind" and is also how you go one level down, so
 *  the same click does both jobs. */
function DrillTable({ data }: { data: AnalyticsData }) {
  const rows = data.rankedChildren;
  if (!data.childUnit || rows.length === 0) return null;

  const best = Math.max(...rows.map((r) => r.avg), 1);
  const title =
    data.level === 'state'
      ? 'Mandals by average score'
      : `${data.childUnit}s in ${data.scopeName}, by average score`;

  function childHref(child: RankedChild) {
    if (data.level === 'state') return href({ mandal: child.code });
    if (data.level === 'mandal') return href({ mandal: data.mandalCode, district: child.code });
    return href({ mandal: data.mandalCode, district: data.districtCode, block: child.code });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">
        Select a {data.childUnit.toLowerCase()} to narrow every panel on this page to it.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Rank</th>
              <th className="px-3 py-2 font-semibold">{data.childUnit}</th>
              <th className="px-3 py-2 text-right font-semibold">Schools</th>
              <th className="px-3 py-2 text-right font-semibold">Avg SQAAF</th>
              <th className="px-3 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((child, i) => (
              <tr key={child.code} className="transition-colors hover:bg-[#1B2A6B]/[0.04]">
                <td className="px-3 py-3 tabular-nums text-gray-500">{i + 1}</td>
                <td className="px-3 py-3">
                  <Link
                    href={childHref(child)}
                    className="font-semibold text-[#1B2A6B] hover:underline"
                  >
                    {child.name}
                    <ChevronRight size={13} className="ml-1 inline text-gray-400" aria-hidden />
                  </Link>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                  {child.schools.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-gray-900">
                  {child.avg}%
                </td>
                <td className="w-[110px] px-3 py-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#F5B731]"
                      style={{ width: `${Math.round((child.avg / best) * 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SssaAnalytics({ data }: { data: AnalyticsData }) {
  const filterQuery =
    data.level === 'block'
      ? `district=${data.districtCode}&block=${data.blockCode}`
      : data.level === 'district'
        ? `district=${data.districtCode}`
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Trail data={data} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{data.scopeName}</h1>
          <span
            className="rounded-full bg-[#E6E9F2] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            {LEVEL_LABEL[data.level]} scope
          </span>
          {data.level !== 'state' && data.mandalRank > 0 && (
            <span className="text-sm text-gray-500">
              {data.mandalName} ranks #{data.mandalRank} of {data.mandals.length} mandals
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">Active Cycle: {data.cycleName}</p>
      </header>

      <ScopeStatCards
        schoolsLabel={SCHOOLS_LABEL[data.level]}
        totalSchools={data.totalSchools}
        averageScore={data.averageScore}
        topMandalBenchmark={data.topMandalBenchmark}
        topDistrictInMandal={data.topDistrictInMandal}
        topBlockInScope={data.topBlockInScope}
      />

      <DrillTable data={data} />

      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <ManagementTypeChart bars={data.managementBars} />
      <PerformanceHighlights
        low={data.lowPerforming}
        high={data.highPerforming}
        filterQuery={filterQuery}
      />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection
        disputes={data.disputes}
        leftChartTitle={
          data.level === 'state' ? 'Mandals with highest disputes' : 'Schools with highest disputes'
        }
      />
    </div>
  );
}
