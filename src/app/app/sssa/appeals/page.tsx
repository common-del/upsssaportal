import { redirect } from 'next/navigation';

/**
 * Appeals is a tab on Verification now, not a page of its own.
 *
 * An appeal is one of the two ways a verification ends, so splitting it out put
 * half of one process behind a separate sidebar item — an appealed school appeared
 * in two places, in two different tables, and in neither of them could you read the
 * appeal beside the verification it disputes.
 *
 * Kept as a redirect rather than deleted: the route has been linked from
 * notifications and shared in messages, and a dead URL teaches nobody where the
 * page went.
 */
export default function AppealsMovedPage() {
  redirect('/app/sssa/verifiers?tab=decide');
}
