import { redirect } from 'next/navigation';

/**
 * Escalations merged into the Decisions inbox: three pages of pending rulings for
 * the same one person became one list. This redirect keeps notification links and
 * bookmarks working, landing on the inbox filtered to escalations.
 */
export default function EscalationsMovedPage() {
  redirect('/app/sssa/decisions?type=escalations');
}
