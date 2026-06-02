import { DistrictAnalytics } from '@/components/sssa/DistrictAnalytics';
import { buildDistrictDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function DistrictAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; block?: string }>;
}) {
  const params = await searchParams;
  const state = await buildStateDashboardData();
  const districtCode =
    params.district && state.districts.some((d) => d.code === params.district)
      ? params.district
      : state.districts[0]?.code ?? '';
  const blockCode = params.block ?? '';

  const data = districtCode
    ? await buildDistrictDashboardData(districtCode, blockCode || undefined)
    : await buildDistrictDashboardData(state.districts[0]?.code ?? '', undefined);

  return (
    <DistrictAnalytics
      key={`${districtCode}-${blockCode}`}
      initialDistrictCode={districtCode}
      districts={state.districts}
      blocks={state.blocks}
      initialData={data}
    />
  );
}
