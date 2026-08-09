import { buildStateDashboard } from '@/lib/sssa/stateDashboard';
import { StateDashboard } from '@/components/sssa/StateDashboard';

/**
 * The SSSA landing page: one state score, and who sits at each end of it.
 *
 * This used to render the analytics surface — a scope cascade with submission
 * progress, domain gaps and dispute breakdowns. Those questions now belong to the
 * pages that own them: how far the cycle has got is on the School Directory beside
 * the register, verification backlog is on Verification, and grievances are split
 * across Complaints and Appeals, each carrying its own count in the sidebar. What
 * is left here is the summary that had no home — the score itself.
 */
export default async function SssaDashboardPage() {
  const data = await buildStateDashboard();
  return <StateDashboard data={data} />;
}
