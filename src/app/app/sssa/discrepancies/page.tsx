import { redirect } from 'next/navigation';

/**
 * The discrepancy queue merged into the Decisions inbox; the case screen at
 * /app/sssa/discrepancies/[runId] is alive and linked from the cards. This
 * redirect keeps old links working, landing on the issues tab filtered to what
 * came from on-ground verifiers' field visits.
 */
export default function DiscrepanciesMovedPage() {
  redirect('/app/sssa/decisions?tab=issues&who=field');
}
