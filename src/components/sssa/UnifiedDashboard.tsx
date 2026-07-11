'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { StateDashboardData, ScopedDashboardData } from '@/lib/sssa/adminMetrics';
import {
  DisputeResolutionSection,
  HeroCards,
  InfrastructureGaps,
  ManagementTypeChart,
  PerformanceGaps,
  PerformanceHighlights,
  SubmissionProgress,
} from '@/components/sssa/dashboard/DashboardSections';

type Props = {
  scope: 'state' | 'district';
  districtCode: string;
  districtName: string;
  blockCode: string;
  stateData: StateDashboardData;
  districtData: ScopedDashboardData | null;
  isDistrictAdmin: boolean;
  userDistrictCode?: string;
};

export function UnifiedDashboard({
  scope,
  districtCode,
  districtName,
  blockCode,
  stateData,
  districtData,
  isDistrictAdmin,
  userDistrictCode: _userDistrictCode,
}: Props) {
  const router = useRouter();
  const [localScope, setLocalScope] = useState(scope);
  const [localDistrict, setLocalDistrict] = useState(districtCode);
  const [localBlock, setLocalBlock] = useState(blockCode);

  const data = (localScope === 'district' && districtData) ? districtData : stateData;
  const blockOptions = stateData.blocks.filter((b) => b.districtCode === localDistrict);
  const selectedBlockName = stateData.blocks.find((b) => b.code === localBlock)?.nameEn ?? '';

  const subtitle =
    localScope === 'state'
      ? 'State Overview: Uttar Pradesh'
      : localBlock
        ? `Block Overview: ${selectedBlockName} (${districtName})`
        : `District Overview: ${districtName}`;

  function navigate(
    nextScope: 'state' | 'district',
    nextDistrict: string,
    nextBlock: string,
  ) {
    setLocalScope(nextScope);
    setLocalDistrict(nextDistrict);
    setLocalBlock(nextBlock);
    const params = new URLSearchParams();
    if (nextScope !== 'state') {
      if (nextDistrict) params.set('district', nextDistrict);
      if (nextBlock) params.set('block', nextBlock);
    } else {
      params.set('scope', 'state');
    }
    router.push(`/app/dashboard?${params.toString()}`);
  }

  const scopeLabel =
    localScope === 'state' ? 'State' : localBlock ? 'Block' : 'District';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[#F5B731] bg-[#FEF9EC] px-3 py-1 text-xs font-semibold text-[#1B2A6B]">
            {stateData.cycleName} active
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[#1B2A6B] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Download {scopeLabel} Report
          </button>
        </div>
      </div>

      {/* Scope selector strip */}
      <div className="sticky top-[60px] z-40 flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-gray-500">Scope</label>
          <select
            value={localScope === 'state' ? '__state__' : localDistrict}
            disabled={isDistrictAdmin}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__state__') {
                navigate('state', '', '');
              } else {
                navigate('district', val, '');
              }
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {!isDistrictAdmin && <option value="__state__">State</option>}
            {stateData.districts.map((d) => (
              <option key={d.code} value={d.code}>
                District: {d.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-gray-500">Block</label>
          <select
            value={localBlock}
            disabled={localScope === 'state'}
            onChange={(e) => navigate('district', localDistrict, e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">All Blocks</option>
            {blockOptions.map((b) => (
              <option key={b.code} value={b.code}>
                {b.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards */}
      <HeroCards
        totalSchools={data.totalSchools}
        averageScore={data.averageScore}
        lastCycleDelta={data.lastCycleDelta}
      />
      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <PerformanceHighlights low={data.lowPerforming} high={data.highPerforming} />

      {/* District-only cards */}
      {localScope === 'district' && districtData && (
        <>
          <ManagementTypeChart bars={districtData.managementBars} />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Top Mandal (Benchmark)', value: districtData.topMandalBenchmark.name, sub: `${districtData.topMandalBenchmark.avg}%` },
              { label: 'Top District in Mandal', value: districtData.topDistrictInMandal.name, sub: `${districtData.topDistrictInMandal.avg}%` },
              { label: 'Top Block in District', value: districtData.topBlockInScope.name, sub: `${districtData.topBlockInScope.avg}%` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-gray-500">{c.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{c.value}</p>
                <p className="text-sm text-gray-600">{c.sub}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Block-only table placeholder */}
      {localBlock && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">School-level Breakdown</h2>
          <p className="mt-2 text-sm text-gray-500">
            School list for {selectedBlockName} — see{' '}
            <a href="/app/sssa/monitoring" className="font-medium text-[#1B2A6B] underline">
              Self Assessment Monitoring
            </a>{' '}
            for detailed school data.
          </p>
        </div>
      )}

      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection
        disputes={data.disputes}
        leftChartTitle={
          localBlock
            ? 'Schools with highest disputes'
            : localScope === 'district'
              ? 'Blocks with highest disputes'
              : 'Mandals with highest disputes'
        }
      />
    </div>
  );
}
