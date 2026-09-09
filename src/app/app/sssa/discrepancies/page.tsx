import { redirect } from 'next/navigation';

/**
 * The discrepancy queue merged into the Decisions inbox; the case screen at
 * /app/sssa/discrepancies/[runId] is alive and linked from the inbox rows. This
 * redirect keeps old links working, landing on the inbox filtered to discrepancies.
 */
export default function DiscrepanciesMovedPage() {
  redirect('/app/sssa/decisions?type=discrepancies');
}
