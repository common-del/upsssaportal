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
  SubmissionProgress,
} from '@/components/sssa/dashboard/DashboardSections';
import { Building2 } from 'lucide-react';

type Props = {
  initialDistrictCode: string;
  districts: StateDashboardData['districts'];
  blocks: StateDashboardData['blocks'];
  initialData: DistrictDashboardData;
};

export function DistrictAnalytics({
  initialDistrictCode,
  districts,
  blocks,
  initialData,
}: Props) {
  const router = useRouter();
  const [districtCode, setDistrictCode] = useState(initialDistrictCode);
  const [blockCode, setBlockCode] = useState('');
  const data = initialData;

  const districtName = districts.find((d) => d.code === districtCode)?.nameEn ?? districtCode;
  const blockOptions = useMemo(
    () => blocks.filter((b) => b.districtCode === districtCode),
    [blocks, districtCode],
  );

  function reload(nextDistrict: string, nextBlock: string) {
    const params = new URLSearchParams({ district: nextDistrict });
    if (nextBlock) params.set('block', nextBlock);
    router.push(`/app/sssa/district?${params.toString()}`);
  }

  const blockSelected = Boolean(blockCode);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">District Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          District: {districtName} (Rank {data.districtRank} of {districts.length || 75})
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={districtCode}
          onChange={(e) => {
            setDistrictCode(e.target.value);
            setBlockCode('');
            reload(e.target.value, '');
          }}
        >
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.nameEn}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
          value={blockCode}
          disabled={!districtCode}
          onChange={(e) => {
            setBlockCode(e.target.value);
            reload(districtCode, e.target.value);
          }}
        >
          <option value="">Block: All Blocks</option>
          {blockOptions.map((b) => (
            <option key={b.code} value={b.code}>
              {b.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className={`grid gap-4 ${blockSelected ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        {blockSelected ? (
          <>
            <StatCard label="Schools in Block" value={data.totalSchools} />
            <StatCard label="Avg Score (Block)" value={`${data.averageScore}%`} />
            <StatCard label="Top Cluster in Block" value={data.topCluster.name} sub={`${data.topCluster.avg}%`} />
            <StatCard label="Top School in Block" value="—" sub="Pilot data" />
          </>
        ) : (
          <>
            <StatCard label="Schools in District" value={data.totalSchools} icon />
            <StatCard label="Average SQAAF Score" value={`${data.averageScore}%`} />
            <StatCard
              label="Top District (Benchmark)"
              value={data.topDistrictBenchmark.name}
              sub={`${data.topDistrictBenchmark.avg}%`}
            />
            <StatCard label="Top Block (in District)" value={data.topBlock.name} sub={`${data.topBlock.avg}%`} />
            <StatCard label="Top Cluster (in District)" value={data.topCluster.name} sub={`${data.topCluster.avg}%`} />
          </>
        )}
      </div>

      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <ManagementTypeChart bars={data.managementBars} />
      <PerformanceHighlights
        low={data.lowPerforming}
        high={data.highPerforming}
        filterQuery={`district=${districtCode}${blockCode ? `&block=${blockCode}` : ''}`}
      />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection
        disputes={data.disputes}
        leftChartTitle={
          blockSelected ? 'Schools with highest disputes' : 'Blocks with highest disputes'
        }
      />
    </div>
  );
}

function StatCard({
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
