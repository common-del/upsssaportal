import { buildStateDashboard } from '@/lib/sssa/stateDashboard';
import { StateDashboard } from '@/components/sssa/StateDashboard';

/**
 * The SSSA landing page: how far the cycle has got, and what the verified half of it looks like.
 *
 * It once rendered the whole analytics surface, a scope cascade with submission progress, domain
 * gaps and dispute breakdowns. Those questions belong to the pages that own them, and what is
 * here is the summary that had no home.
 *
 * The district lives in the URL rather than in component state, so a narrowed view is shareable,
 * survives a refresh and steps back out. Everything on the page except the district ranking reads
 * from it.
 */
export default async function SssaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const district = typeof sp.district === 'string' ? sp.district : undefined;
  const data = await buildStateDashboard(district);
  return <StateDashboard data={data} />;
}
