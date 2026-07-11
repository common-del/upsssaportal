import { BlockAnalytics } from '@/components/sssa/BlockAnalytics';
import { buildBlockDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function BlockAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mandal?: string; district?: string; block?: string }>;
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
  const blockOptions = state.blocks.filter((b) => b.districtCode === districtCode);
  const blockCode =
    params.block && blockOptions.some((b) => b.code === params.block)
      ? params.block
      : (blockOptions[0]?.code ?? '');

  const data = await buildBlockDashboardData(districtCode, blockCode);

  return (
    <BlockAnalytics
      key={`${mandalCode}-${districtCode}-${blockCode}`}
      initialMandalCode={mandalCode}
      initialDistrictCode={districtCode}
      initialBlockCode={blockCode}
      mandals={state.mandals}
      districts={state.districts}
      blocks={state.blocks}
      initialData={data}
    />
  );
}
