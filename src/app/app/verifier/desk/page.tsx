import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor, requireOnlineVerifier } from '@/lib/authz';
import { getDeskQueue, type DeskQueueRow } from '@/lib/actions/deskScreening';

/**
 * The Online Verifier's queue, as a deadline board.
 *
 * Every case is one row and the rows run in turnaround order, most overdue first, because the
 * turnaround is the promise this page keeps. The old table sorted by age and left the reader to
 * work out what to do next from five columns; the due tile now says it at a glance.
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
const NAVY_WASH = '#EEF2F9';
const INK_MUTED = '#5F7190';
const GOLD_TINT = '#D0AD42';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const RED = '#96271E';
const RED_WASH = '#FBE9E7';

/**
 * The left-hand tile: the clock, or the wait.
 *
 * A case with an indicator at the SSSA shows how long it has been held instead of its
 * turnaround, because its turnaround is not the verifier's to keep while the SSSA has it.
 */
function DueTile({ row }: { row: DeskQueueRow }) {
  const held = row.withSssa > 0;
  const overdue = !held && row.daysLeft !== null && row.daysLeft < 0;
  const urgent = !held && row.daysLeft !== null && row.daysLeft >= 0 && row.daysLeft <= 2;

  const palette = held || urgent
    ? { borderColor: GOLD_TINT, backgroundColor: GOLD_WASH, color: GOLD_DARK }
    : overdue
      ? { borderColor: RED, backgroundColor: RED_WASH, color: RED }
      : { borderColor: '#C7D2E8', backgroundColor: NAVY_WASH, color: NAVY_DEEP };

  const value = held
    ? (row.heldDays ?? 0)
    : row.daysLeft === null
      ? null
      : Math.abs(row.daysLeft);
  const label = held
    ? (row.heldDays === 1 ? 'day held' : 'days held')
    : row.daysLeft === null
      ? 'no window'
      : overdue
        ? (Math.abs(row.daysLeft) === 1 ? 'day over' : 'days over')
        : (row.daysLeft === 1 ? 'day left' : 'days left');

  return (
    <span
      className="w-16 flex-none rounded-lg border-2 py-1 text-center"
      style={{ borderColor: palette.borderColor, backgroundColor: palette.backgroundColor }}
    >
      {value !== null && (
        <span className="block text-lg font-extrabold leading-tight tabular-nums" style={{ color: palette.color }}>
          {value.toLocaleString('en-IN')}
        </span>
      )}
      <span
        className="block text-[9.5px] font-extrabold uppercase tracking-wide"
        style={{ color: palette.color, paddingBlock: value === null ? 6 : 0 }}
      >
        {label}
      </span>
    </span>
  );
}

/** What to do with this case, in the fewest words that are still true. */
function metaFor(row: DeskQueueRow): string {
  const bits: string[] = [];
  bits.push(
    row.decided > 0
      ? `${row.decided.toLocaleString('en-IN')} of ${row.total.toLocaleString('en-IN')} decided`
      : `${row.total.toLocaleString('en-IN')} manual waiting`,
  );
  if (row.withSssa > 0) {
    bits.push(`${row.withSssa} ${row.withSssa === 1 ? 'indicator' : 'indicators'} with SSSA`);
  } else if (row.automatedMismatches > 0) {
    // The mismatch count was always advice in disguise: it is where to start reading.
    bits.push(
      row.decided > 0
        ? `${row.automatedMismatches} automated ${row.automatedMismatches === 1 ? 'mismatch' : 'mismatches'}`
        : `start at the ${row.automatedMismatches} automated ${row.automatedMismatches === 1 ? 'mismatch' : 'mismatches'}`,
    );
  }
  return bits.join(' · ');
}

export default async function DeskQueuePage() {
  const actor = await requireOnlineVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');

  const queue = await getDeskQueue();
  const overdue = queue.filter((r) => r.withSssa === 0 && r.daysLeft !== null && r.daysLeft < 0).length;
  const withSssa = queue.filter((r) => r.withSssa > 0).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Desk Screening
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Every case in deadline order, the most overdue first. Schools are shown by code: you are
          not told which school you are reviewing, and it is not told who reviewed it.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">No cases are allocated to you right now.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            A supervisor allocates batches. If you expect work here, your certification may not be
            active yet, in which case no queue is held for you.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ color: overdue > 0 ? RED : INK_MUTED }}>
            {queue.length.toLocaleString('en-IN')} open {queue.length === 1 ? 'case' : 'cases'}
            {overdue > 0 && ` · ${overdue.toLocaleString('en-IN')} past the turnaround`}
            {withSssa > 0 && ` · ${withSssa.toLocaleString('en-IN')} held with the SSSA`}
          </p>

          <div className="space-y-3">
            {queue.map((row) => {
              const held = row.withSssa > 0;
              const isOverdue = !held && row.daysLeft !== null && row.daysLeft < 0;
              return (
                <Link
                  key={row.runId}
                  href={`/app/verifier/desk/${row.runId}`}
                  className="flex items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 hover:border-gray-300"
                  style={{ borderColor: isOverdue ? RED : held ? GOLD_TINT : '#E5E7EB' }}
                >
                  <DueTile row={row} />
                  <span className="min-w-0 flex-1">
                    <span className="block">
                      <span className="font-mono text-xs font-bold" style={{ color: NAVY_DEEP }}>
                        {row.maskedCode}
                      </span>
                      <span className="ml-2 text-[11px]" style={{ color: INK_MUTED }}>
                        {row.category}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                      {metaFor(row)}
                    </span>
                  </span>
                  <span
                    className="hidden w-20 flex-none overflow-hidden rounded-full bg-[#EDEFF3] sm:block"
                    style={{ height: 8 }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        backgroundColor: NAVY,
                        width: `${row.total === 0 ? 0 : Math.round((row.decided / row.total) * 100)}%`,
                      }}
                    />
                  </span>
                  {held && (
                    <span
                      className="flex-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: GOLD_DARK }}
                    >
                      {row.withSssa} with SSSA
                    </span>
                  )}
                  <span aria-hidden className="flex-none text-lg font-bold" style={{ color: INK_MUTED }}>
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {withSssa > 0 && (
        <p className="rounded-xl border-2 px-4 py-3 text-xs" style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH, color: GOLD_DARK }}>
          A case marked &quot;with SSSA&quot; carries an indicator you sent up because it could not
          be cleanly judged. The case is held until the SSSA rules on it; you can still decide its
          other indicators meanwhile.
        </p>
      )}

      <p className="text-xs" style={{ color: INK_MUTED }}>
        The risk score for a case is not shown until every indicator you are responsible for has a
        decision, so that seeing it cannot influence the decisions still to be made.
      </p>
    </div>
  );
}
