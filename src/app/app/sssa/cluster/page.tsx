import { ClusterAnalytics } from '@/components/sssa/ClusterAnalytics';
import { buildClusterDashboardData, buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function ClusterAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; block?: string; cluster?: string }>;
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
  const clusterOptions = state.clusters.filter((c) => c.blockCode === blockCode);
  const clusterCode =
    params.cluster && clusterOptions.some((c) => c.code === params.cluster)
      ? params.cluster
      : (clusterOptions[0]?.code ?? '');

  const data = await buildClusterDashboardData(districtCode, blockCode, clusterCode);

  return (
    <ClusterAnalytics
      key={`${districtCode}-${blockCode}-${clusterCode}`}
      initialDistrictCode={districtCode}
      initialBlockCode={blockCode}
      initialClusterCode={clusterCode}
      districts={state.districts}
      blocks={state.blocks}
      clusters={state.clusters}
      initialData={data}
    />
  );
}
