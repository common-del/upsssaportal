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
  initialClusterCode: string;
  districts: StateDashboardData['districts'];
  blocks: StateDashboardData['blocks'];
  clusters: StateDashboardData['clusters'];
  initialData: DistrictDashboardData;
};

export function ClusterAnalytics({
  initialDistrictCode,
  initialBlockCode,
  initialClusterCode,
  districts,
  blocks,
  clusters,
  initialData,
}: Props) {
  const router = useRouter();
  const [districtCode, setDistrictCode] = useState(initialDistrictCode);
  const [blockCode, setBlockCode] = useState(initialBlockCode);
  const [clusterCode, setClusterCode] = useState(initialClusterCode);
  const data = initialData;

  const blockName = blocks.find((b) => b.code === blockCode)?.nameEn ?? blockCode;
  const clusterName = clusters.find((c) => c.code === clusterCode)?.nameEn ?? clusterCode;

  const blockOptions = useMemo(
    () => blocks.filter((b) => b.districtCode === districtCode),
    [blocks, districtCode],
  );
  const clusterOptions = useMemo(
    () => clusters.filter((c) => c.blockCode === blockCode),
    [clusters, blockCode],
  );

  function reload(nextDistrict: string, nextBlock: string, nextCluster: string) {
    router.push(`/app/sssa/cluster?district=${nextDistrict}&block=${nextBlock}&cluster=${nextCluster}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Cluster Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cluster: {clusterName} ({blockName})
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={districtCode}
          onChange={(e) => {
            const nextDistrict = e.target.value;
            const nextBlock = blocks.find((b) => b.districtCode === nextDistrict)?.code ?? '';
            const nextCluster = clusters.find((c) => c.blockCode === nextBlock)?.code ?? '';
            setDistrictCode(nextDistrict);
            setBlockCode(nextBlock);
            setClusterCode(nextCluster);
            reload(nextDistrict, nextBlock, nextCluster);
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
            const nextBlock = e.target.value;
            const nextCluster = clusters.find((c) => c.blockCode === nextBlock)?.code ?? '';
            setBlockCode(nextBlock);
            setClusterCode(nextCluster);
            reload(districtCode, nextBlock, nextCluster);
          }}
        >
          {blockOptions.map((b) => (
            <option key={b.code} value={b.code}>
              {b.nameEn}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={clusterCode}
          onChange={(e) => {
            setClusterCode(e.target.value);
            reload(districtCode, blockCode, e.target.value);
          }}
        >
          {clusterOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.nameEn}
            </option>
          ))}
        </select>
      </div>

      <ScopeStatCards
        schoolsLabel="Schools in Cluster"
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
      <DisputeResolutionSection disputes={data.disputes} leftChartTitle="Schools with highest disputes" />
    </div>
  );
}
