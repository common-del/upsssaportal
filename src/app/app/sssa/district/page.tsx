import { DistrictAnalytics } from '@/components/sssa/DistrictAnalytics';
import { buildDistrictDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function DistrictAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mandal?: string; district?: string }>;
}) {
  const params = await searchParams;
  const state = await buildStateDashboardData();
  const mandalCode =
    params.mandal && state.mandals.some((m) => m.code === params.mandal)
      ? params.mandal
      : (state.mandals[0]?.code ?? '');
  const districtOptions = state.districts.filter((d) => d.mandalCode === mandalCode);
  const districtCode =
    params.district && districtOptions.some((d) => d.code === params.district)
      ? params.district
      : (districtOptions[0]?.code ?? '');

  const data = await buildDistrictDashboardData(districtCode);

  return (
    <DistrictAnalytics
      key={`${mandalCode}-${districtCode}`}
      initialMandalCode={mandalCode}
      initialDistrictCode={districtCode}
      mandals={state.mandals}
      districts={state.districts}
      initialData={data}
    />
  );
}
