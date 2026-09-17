import { redirect } from 'next/navigation';
import { currentActor, requireOnlineVerifier } from '@/lib/authz';
import { getWalkthroughQueue } from '@/lib/actions/walkthrough';
import { WalkthroughQueueList } from '@/components/verifier/WalkthroughQueueList';

/**
 * The walkthrough queue: cases desk screening pushed over the risk threshold, on both routes.
 *
 * Most are settled on a live call. Where the call will not hold, the school records a clip for
 * each disputed indicator instead, and for a day those cases had a page of their own. They are
 * back here, because one case belongs in one queue and a second page was a second place to
 * forget it.
 *
 * Three tabs now, not one list: no time agreed, a call booked, and the school filming. They read
 * left to right as the pipeline they are, since a recording case is a booked call whose
 * connectivity failed. The split is worth the click because the three barely share a column, and
 * what a verifier does first is choose which kind of work they are doing.
 *
 * The standing explanation that used to sit under this heading is gone. It was three lines of
 * policy about risk thresholds and turnarounds, true, read once on somebody's first day and
 * skipped every day after, and it pushed the work below the fold. A one line note under the
 * table says what the open tab holds, which is the part anyone actually needed.
 *
 * Masked codes here, as everywhere in the online track; the identity discloses only inside a
 * case's console, at a recorded moment, immediately followed by the conflict declaration. That
 * one line stays, because it is a rule a verifier has to keep in mind rather than a description
 * of the screen.
 */

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

export default async function WalkthroughsPage() {
  const actor = await requireOnlineVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');
  const rows = await getWalkthroughQueue();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Walkthroughs
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases that need a closer look before they are settled or sent for a visit.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          Nothing is waiting for a walkthrough.
        </p>
      ) : (
        <>
          <WalkthroughQueueList rows={rows} />
          <p className="text-xs" style={{ color: INK_MUTED }}>
            The school is named only inside a case, at a recorded moment.
          </p>
        </>
      )}
    </div>
  );
}
