import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireVerifier } from '@/lib/authz';
import { getDeskQueue } from '@/lib/actions/deskScreening';

/**
 * The Online Verifier's batch queue.
 *
 * Navy throughout, per the brief's visual system: navy is the online and desk track, gold is the
 * field. Nothing on this screen is gold, and nothing on a field screen should be navy.
 *
 * Every row is a masked code. There is no school name on this page because there is no school
 * name in the payload: the queue query selects only the UDISE and the stage, and reduces them
 * through maskSchool before they leave the server.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

function TurnaroundPill({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) {
    return <span className="text-xs" style={{ color: INK_MUTED }}>No window set</span>;
  }
  const overdue = daysLeft < 0;
  const urgent = !overdue && daysLeft <= 2;
  const style = overdue
    ? { backgroundColor: '#FBE9E7', color: '#96271E' }
    : urgent
      ? { backgroundColor: '#FBF1DE', color: '#7A5209' }
      : { backgroundColor: '#EDF1F9', color: NAVY };
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
      style={style}
    >
      {overdue
        ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} overdue`
        : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
    </span>
  );
}

export default async function DeskQueuePage() {
  const actor = await requireVerifier();
  if (!actor) redirect('/login?tab=verifier');

  const queue = await getDeskQueue();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Desk screening
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases allocated to you. Schools are shown by code: you are not told which school you
          are reviewing, and it is not told who reviewed it.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-700">No cases are allocated to you right now.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            A supervisor allocates batches. If you expect work here, your certification may not be
            active yet, in which case no queue is held for you.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead
                className="text-xs font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: NAVY }}
              >
                <tr>
                  <th className="px-4 py-3">School code</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Decisions left</th>
                  <th className="px-4 py-3">Automated mismatches</th>
                  <th className="px-4 py-3">Turnaround</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queue.map((row) => (
                  <tr key={row.runId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold" style={{ color: NAVY }}>
                        {row.maskedCode}
                      </span>
                      {row.escalated && (
                        <span className="ml-2 whitespace-nowrap rounded-full bg-[#FBE9E7] px-2 py-0.5 text-[10px] font-bold text-[#96271E]">
                          Escalated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.category}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {row.remaining} of {row.total}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {row.automatedMismatches}
                    </td>
                    <td className="px-4 py-3">
                      <TurnaroundPill daysLeft={row.daysLeft} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/app/verifier/desk/${row.runId}`}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: NAVY }}
                      >
                        Open case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: INK_MUTED }}>
        The risk score for a case is not shown until every indicator you are responsible for has a
        decision, so that seeing it cannot influence the decisions still to be made.
      </p>
    </div>
  );
}
