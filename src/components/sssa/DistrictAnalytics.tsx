'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScopedDashboardData, StateDashboardData } from '@/lib/sssa/adminMetrics';
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
  initialMandalCode: string;
  initialDistrictCode: string;
  mandals: StateDashboardData['mandals'];
  districts: StateDashboardData['districts'];
  initialData: ScopedDashboardData;
};

export function DistrictAnalytics({
  initialMandalCode,
  initialDistrictCode,
  mandals,
  districts,
  initialData,
}: Props) {
  const router = useRouter();
  const [mandalCode, setMandalCode] = useState(initialMandalCode);
  const [districtCode, setDistrictCode] = useState(initialDistrictCode);
  const data = initialData;

  const districtName = districts.find((d) => d.code === districtCode)?.nameEn ?? districtCode;
  const districtOptions = useMemo(
    () => districts.filter((d) => d.mandalCode === mandalCode),
    [districts, mandalCode],
  );

  function reload(nextMandal: string, nextDistrict: string) {
    router.push(`/app/sssa/district?mandal=${nextMandal}&district=${nextDistrict}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">District Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">District: {districtName}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={mandalCode}
          onChange={(e) => {
            const nextMandal = e.target.value;
            const nextDistrict = districts.find((d) => d.mandalCode === nextMandal)?.code ?? '';
            setMandalCode(nextMandal);
            setDistrictCode(nextDistrict);
            reload(nextMandal, nextDistrict);
          }}
        >
          {mandals.map((m) => (
            <option key={m.code} value={m.code}>
              {m.nameEn}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={districtCode}
          onChange={(e) => {
            setDistrictCode(e.target.value);
            reload(mandalCode, e.target.value);
          }}
        >
          {districtOptions.map((d) => (
            <option key={d.code} value={d.code}>
              {d.nameEn}
            </option>
          ))}
        </select>
      </div>

      <ScopeStatCards
        schoolsLabel="Schools in District"
        totalSchools={data.totalSchools}
        averageScore={data.averageScore}
        topMandalBenchmark={data.topMandalBenchmark}
        topDistrictInMandal={data.topDistrictInMandal}
        topBlockInScope={data.topBlockInScope}
      />

      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <ManagementTypeChart bars={data.managementBars} />
      <PerformanceHighlights
        low={data.lowPerforming}
        high={data.highPerforming}
        filterQuery={`district=${districtCode}`}
      />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection disputes={data.disputes} leftChartTitle="Blocks with highest disputes" />
    </div>
  );
}
