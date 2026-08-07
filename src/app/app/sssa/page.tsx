import { SssaAnalytics } from '@/components/sssa/SssaAnalytics';
import { buildAnalyticsData } from '@/lib/sssa/adminMetrics';

/**
 * The single analytics surface. State, mandal, district and block used to be four
 * nav entries rendering the same set of panels; the level is now just how far the
 * query has narrowed, and the ranked table on each view is what narrows it.
 */
export default async function SssaAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mandal?: string; district?: string; block?: string }>;
}) {
  const { mandal, district, block } = await searchParams;
  const data = await buildAnalyticsData({ mandal, district, block });
  return <SssaAnalytics data={data} />;
}
