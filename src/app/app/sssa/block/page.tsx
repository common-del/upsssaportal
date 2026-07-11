import { BlockAnalytics } from '@/components/sssa/BlockAnalytics';
import { buildBlockDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function BlockAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; block?: string }>;
}) {
  const params = await searchParams;
  const state = await buildStateDashboardData();
  const districtCode =
    params.district && state.districts.some((d) => d.code === params.district)
      ? params.district
      : (state.districts[0]?.code ?? '');
  const blockOptions = state.blocks.filter((b) => b.districtCode === districtCode);
  const blockCode =
    params.block && blockOptions.some((b) => b.code === params.block)
      ? params.block
      : (blockOptions[0]?.code ?? '');

  const data = await buildBlockDashboardData(districtCode, blockCode);

  return (
    <BlockAnalytics
      key={`${districtCode}-${blockCode}`}
      initialDistrictCode={districtCode}
      initialBlockCode={blockCode}
      districts={state.districts}
      blocks={state.blocks}
      initialData={data}
    />
  );
}
