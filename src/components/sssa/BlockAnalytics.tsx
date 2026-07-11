'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DistrictDashboardData, StateDashboardData } from '@/lib/sssa/adminMetrics';
import {
  DisputeResolutionSection,
  InfrastructureGaps,
  ManagementTypeChart,
  PerformanceGaps,
  PerformanceHighlights,
  ScopeStatCards,
  SubmissionProgress,
} from '@/components/sssa/dashboard/DashboardSections';

type Props = {
  initialDistrictCode: string;
  initialBlockCode: string;
  districts: StateDashboardData['districts'];
  blocks: StateDashboardData['blocks'];
  initialData: DistrictDashboardData;
};

export function BlockAnalytics({
  initialDistrictCode,
  initialBlockCode,
  districts,
  blocks,
  initialData,
}: Props) {
  const router = useRouter();
  const [districtCode, setDistrictCode] = useState(initialDistrictCode);
  const [blockCode, setBlockCode] = useState(initialBlockCode);
  const data = initialData;

  const districtName = districts.find((d) => d.code === districtCode)?.nameEn ?? districtCode;
  const blockName = blocks.find((b) => b.code === blockCode)?.nameEn ?? blockCode;
  const blockOptions = useMemo(
    () => blocks.filter((b) => b.districtCode === districtCode),
    [blocks, districtCode],
  );

  function reload(nextDistrict: string, nextBlock: string) {
    router.push(`/app/sssa/block?district=${nextDistrict}&block=${nextBlock}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Block Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          Block: {blockName} ({districtName})
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={districtCode}
          onChange={(e) => {
            const nextDistrict = e.target.value;
            const nextBlock = blocks.find((b) => b.districtCode === nextDistrict)?.code ?? '';
            setDistrictCode(nextDistrict);
            setBlockCode(nextBlock);
            reload(nextDistrict, nextBlock);
          }}
        >
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.nameEn}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={blockCode}
          onChange={(e) => {
            setBlockCode(e.target.value);
            reload(districtCode, e.target.value);
          }}
        >
          {blockOptions.map((b) => (
            <option key={b.code} value={b.code}>
              {b.nameEn}
            </option>
          ))}
        </select>
      </div>

      <ScopeStatCards
        schoolsLabel="Schools in Block"
        totalSchools={data.totalSchools}
        averageScore={data.averageScore}
        topDistrictBenchmark={data.topDistrictBenchmark}
        topBlock={data.topBlock}
        topCluster={data.topCluster}
      />

      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <ManagementTypeChart bars={data.managementBars} />
      <PerformanceHighlights
        low={data.lowPerforming}
        high={data.highPerforming}
        filterQuery={`district=${districtCode}&block=${blockCode}`}
      />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection disputes={data.disputes} leftChartTitle="Clusters with highest disputes" />
    </div>
  );
}
