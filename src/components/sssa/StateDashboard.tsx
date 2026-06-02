'use client';

import type { StateDashboardData } from '@/lib/sssa/adminMetrics';
import {
  DisputeResolutionSection,
  HeroCards,
  InfrastructureGaps,
  PerformanceGaps,
  PerformanceHighlights,
  SubmissionProgress,
} from '@/components/sssa/dashboard/DashboardSections';

export function StateDashboard({ data }: { data: StateDashboardData }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">State Dashboard: Uttar Pradesh</h1>
        <p className="mt-1 text-sm text-gray-600">Active Cycle: {data.cycleName}</p>
      </header>

      <HeroCards
        totalSchools={data.totalSchools}
        averageScore={data.averageScore}
        lastCycleDelta={data.lastCycleDelta}
      />
      <SubmissionProgress workflow={data.workflow} totalSchools={data.totalSchools} />
      <PerformanceHighlights low={data.lowPerforming} high={data.highPerforming} />
      <InfrastructureGaps gaps={data.infraGaps} />
      <PerformanceGaps domainGaps={data.domainGaps} showExport />
      <DisputeResolutionSection
        disputes={data.disputes}
        leftChartTitle="Districts with highest disputes"
      />
    </div>
  );
}
