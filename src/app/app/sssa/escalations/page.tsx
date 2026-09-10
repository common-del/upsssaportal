import { redirect } from 'next/navigation';

/**
 * Escalations merged into the Decisions inbox. This redirect keeps notification
 * links and bookmarks working, landing on the issues tab filtered to what online
 * verifiers raised.
 */
export default function EscalationsMovedPage() {
  redirect('/app/sssa/decisions?tab=issues&who=verifier');
}
