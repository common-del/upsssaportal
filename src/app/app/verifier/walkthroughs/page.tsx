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
 * Merging them back raises the problem that split them, and the zones are the answer. A call is
 * measured against the seven day turnaround and a recording against the school's 48 hour
 * window, so a single deadline column would be wrong for half the list: instead each row states
 * its own clock in the tile, and the zones sort by whether the verifier can act at all.
 *
 * The list, its zones and its filters are a client component, because finding a case by its code
 * has to answer as it is typed. This page is auth, the fetch, and the standing explanation.
 *
 * Masked codes here, as everywhere in the online track; the identity discloses only inside a
 * case's console, at a recorded moment, immediately followed by the conflict declaration.
 */

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

const IST = 'Asia/Kolkata';

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });

export default async function WalkthroughsPage() {
  const actor = await requireOnlineVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');
  const rows = await getWalkthroughQueue();

  // Oldest by entry, for the standing line about how far the backlog reaches.
  const oldest = rows.reduce<string | null>(
    (acc, r) => (acc === null || Date.parse(r.enteredStateAt) < Date.parse(acc) ? r.enteredStateAt : acc),
    null,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Walkthroughs
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases whose risk score crossed the threshold. Most are settled on a live, geofenced
          call; where the call will not hold, the school records a clip for each disputed
          indicator instead. Either way the case is resolved or sent to the field within the
          turnaround.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          Nothing is waiting for a walkthrough.
        </p>
      ) : (
        <>
          <WalkthroughQueueList rows={rows} />
          <p className="text-xs" style={{ color: INK_MUTED }}>
            {oldest && `Cases waiting since ${dayMonth(oldest)} at the oldest. `}A case whose call
            could not hold stays in this queue and changes its clock: hours of the school&apos;s
            recording window rather than days of the turnaround. The school is named only inside a
            console, at a recorded moment.
          </p>
        </>
      )}
    </div>
  );
}
