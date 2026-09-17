import { redirect } from 'next/navigation';

/**
 * Integrity reports folded into Complaints.
 *
 * They were a tab of their own for a queue of three, beside a Complaints tab holding a hundred
 * and fifty. Both answer the same question for whoever opens either: what has somebody objected
 * to, and what is waiting on me. Inducement is a complaint type now, so one list holds both and
 * the type filter separates them when that is what you want.
 *
 * Nothing about who may read them changed: this page was already gated to the audit function and
 * the Authority, and so is the list they moved into.
 */
export default function IntegrityMovedPage() {
  redirect('/app/sssa/disputes');
}
