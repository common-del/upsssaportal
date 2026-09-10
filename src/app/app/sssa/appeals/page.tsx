import { redirect } from 'next/navigation';

/**
 * Retired, twice over. This URL was Appeals, then Verification, then Appeals with
 * the manual queue behind a tab, then the legacy assignment queue's last home. On
 * 10 September SSSA ordered the window closed: the manual VerifierAssignment
 * pathway is deprecated, its seeded backlog was noise nobody would ever work, and
 * showing it contradicted how the programme now assigns. The pathway's DATA stays —
 * the cycle's completed verifications, results and appeals were produced by it —
 * but there is no screen onto its queue any more. Appeals live in Decisions.
 */
export default function LegacyQueueRetiredPage() {
  redirect('/app/sssa/decisions?tab=appeals');
}
