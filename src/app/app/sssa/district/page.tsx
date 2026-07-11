import { DistrictAnalytics } from '@/components/sssa/DistrictAnalytics';
import { buildDistrictDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function DistrictAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const params = await searchParams;
  const state = await buildStateDashboardData();
  const districtCode =
    params.district && state.districts.some((d) => d.code === params.district)
      ? params.district
      : (state.districts[0]?.code ?? '');

  const data = await buildDistrictDashboardData(districtCode);

  return (
    <DistrictAnalytics
      key={districtCode}
      initialDistrictCode={districtCode}
      districts={state.districts}
      initialData={data}
    />
  );
}
