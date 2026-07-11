import { MandalAnalytics } from '@/components/sssa/MandalAnalytics';
import { buildMandalDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function MandalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mandal?: string }>;
}) {
  const params = await searchParams;
  const state = await buildStateDashboardData();
  const mandalCode =
    params.mandal && state.mandals.some((m) => m.code === params.mandal)
      ? params.mandal
      : (state.mandals[0]?.code ?? '');

  const data = await buildMandalDashboardData(mandalCode);

  return (
    <MandalAnalytics
      key={mandalCode}
      initialMandalCode={mandalCode}
      mandals={state.mandals}
      initialData={data}
    />
  );
}
