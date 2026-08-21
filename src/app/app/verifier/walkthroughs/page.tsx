import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireVerifier } from '@/lib/authz';
import { getWalkthroughQueue } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  SCHEDULED: 'Scheduled',
  LIVE: 'Live',
  GUIDED_CAPTURE: 'Guided capture',
  ENDED: 'Ended',
};

/**
 * The walkthrough queue: cases desk screening pushed over the risk threshold. Masked codes
 * here, as everywhere in the online track; the identity discloses only inside a case's
 * console, at a recorded moment, after the conflict declaration.
 */
export default async function WalkthroughsPage() {
  const actor = await requireVerifier();
  if (!actor) redirect('/login?tab=verifier');
  const rows = await getWalkthroughQueue();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Video walkthroughs
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases whose risk score crossed the threshold. Each needs a live, geofenced
          walkthrough, resolved or sent to the field within the turnaround.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          Nothing is waiting for a walkthrough.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.runId} className="rounded-xl border-2 border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-base font-bold" style={{ color: NAVY_DEEP }}>
                    {r.maskedCode}
                  </p>
                  <p className="text-sm" style={{ color: INK_MUTED }}>
                    {r.category} · waiting since {new Date(r.enteredStateAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full border-2 px-3 py-1 text-xs font-bold"
                    style={{ borderColor: r.overdue ? RED : INK_MUTED, color: r.overdue ? RED : INK_MUTED }}
                  >
                    {r.overdue ? 'Overdue' : 'Due'} {new Date(r.dueBy).toLocaleDateString('en-IN')}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                    {STATE_LABELS[r.sessionState]}
                    {r.sessionState === 'SCHEDULED' && r.scheduledFor
                      ? `, ${new Date(r.scheduledFor).toLocaleString('en-IN')}`
                      : ''}
                  </span>
                  {r.mine ? (
                    <Link
                      href={`/app/verifier/walkthrough/${r.runId}`}
                      className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: NAVY }}
                    >
                      Open console
                    </Link>
                  ) : (
                    <ClaimWalkthroughButton runId={r.runId} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
