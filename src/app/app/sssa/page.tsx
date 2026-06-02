import { StateDashboard } from '@/components/sssa/StateDashboard';
import { buildStateDashboardData } from '@/lib/sssa/adminMetrics';

export default async function SssaHomePage() {
  const data = await buildStateDashboardData();
  return <StateDashboard data={data} />;
}
