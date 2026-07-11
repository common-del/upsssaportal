'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
  mandals: StateDashboardData['mandals'];
  initialData: ScopedDashboardData;
};

export function MandalAnalytics({ initialMandalCode, mandals, initialData }: Props) {
  const router = useRouter();
  const [mandalCode, setMandalCode] = useState(initialMandalCode);
  const data = initialData;

  const mandalName = mandals.find((m) => m.code === mandalCode)?.nameEn ?? mandalCode;

  function reload(nextMandal: string) {
    router.push(`/app/sssa/mandal?mandal=${nextMandal}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Mandal Level Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          Mandal: {mandalName} (Rank {data.mandalRank} of {mandals.length || 18})
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          value={mandalCode}
          onChange={(e) => {
            setMandalCode(e.target.value);
            reload(e.target.value);
          }}
        >
          {mandals.map((m) => (
            <option key={m.code} value={m.code}>
              {m.nameEn}
            </option>
          ))}
        </select>
      </div>

      <ScopeStatCards
        schoolsLabel="Schools in Mandal"
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
        filterQuery={`mandal=${mandalCode}`}
      />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection disputes={data.disputes} leftChartTitle="Districts with highest disputes" />
    </div>
  );
}
