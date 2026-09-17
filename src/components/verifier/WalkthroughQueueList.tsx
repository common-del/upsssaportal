'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';
import { compareSummaries, summarise, type QueueSummary } from '@/lib/verification/walkthroughSummary';

/**
 * The walkthrough queue, one sentence a case.
 *
 * What this replaces led with the masked code, which is the only name a case has and is ten
 * characters of hex. Nine of those in a list meant choosing between cases by decoding them, and
 * a panel-and-rail layout showed the same nine twice, competing for where to look.
 *
 * So the row leads with what happened, in words, and the code drops to the line beneath. The
 * clock on the left states its own unit rather than sharing a column: a case on the call route
 * counts days against the seven day turnaround, a school that is filming counts hours of its
 * forty-eight, and one column of days would be wrong for half the list.
 *
 * Red means only one thing here: this needs you today. The screen it replaces printed every
 * overdue case in red, which on a backlog where six of nine are late is not a signal.
 *
 * An unclaimed case keeps its sentence, because that is what tells you whether to take it, but
 * sinks below everything claimed and offers Claim rather than an action it cannot perform.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const RED = '#96271E';

/** Enough of the code to tell nine cases apart at a glance. The whole code is on the row's
 *  tooltip and inside the console, and search still matches it in full. */
function shortCode(maskedCode: string): string {
  const body = maskedCode.startsWith('SC-') ? maskedCode.slice(3) : maskedCode;
  return body.length <= 6 ? maskedCode : `SC-${body.slice(0, 4)}…`;
}

type Prepared = {
  row: WalkthroughQueueRow;
  summary: QueueSummary;
  enteredStateAt: string;
};

function Row({ row, summary }: { row: WalkthroughQueueRow; summary: QueueSummary }) {
  const urgent = summary.pressing && row.mine;
  const toField = summary.action === 'Send to the field';

  return (
    <div
      className="flex flex-wrap items-center gap-5 rounded-2xl border bg-white px-5 py-4"
      style={{ borderColor: urgent ? '#F3CFCB' : '#E5E9F0' }}
    >
      <span className="flex w-24 shrink-0 flex-col gap-0.5">
        <span
          className="text-[17px] font-bold tabular-nums"
          style={{ color: urgent ? RED : NAVY }}
        >
          {summary.clock}
        </span>
        <span className="text-[11.5px]" style={{ color: '#9AA2B4' }}>
          {summary.clockNote}
        </span>
      </span>

      <span className="flex min-w-[260px] grow flex-col gap-1">
        <span className="text-[15.5px] font-semibold leading-snug text-gray-900">
          {summary.sentence}
        </span>
        <span className="text-[12.5px]" style={{ color: '#8A97AC' }}>
          <span title={row.maskedCode} className="font-mono">
            {shortCode(row.maskedCode)}
          </span>
          {' · '}
          {row.observed} of {row.disputed} settled
          {!row.mine && row.riskScore !== null && ` · risk ${row.riskScore}%`}
        </span>
      </span>

      {row.mine ? (
        <Link
          href={`/app/verifier/walkthrough/${row.runId}`}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-5 py-3 text-[13.5px] font-bold text-white"
          style={{ backgroundColor: toField ? GOLD : NAVY }}
        >
          {summary.action}
        </Link>
      ) : (
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-[12.5px]" style={{ color: INK_MUTED }}>
            Nobody has taken this
          </span>
          <ClaimWalkthroughButton runId={row.runId} />
        </span>
      )}
    </div>
  );
}

export function WalkthroughQueueList({ rows }: { rows: WalkthroughQueueRow[] }) {
  const [query, setQuery] = useState('');

  const prepared = useMemo<Prepared[]>(() => {
    const now = new Date();
    return rows
      .map((row) => ({ row, summary: summarise(row, now), enteredStateAt: row.enteredStateAt }))
      .sort(
        (a, b) =>
          // Anything nobody has taken sits below everything claimed, whatever its clock says:
          // a case you cannot act on is not the next thing to do.
          Number(a.row.mine) === Number(b.row.mine)
            ? compareSummaries(a, b)
            : Number(b.row.mine) - Number(a.row.mine),
      );
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return prepared;
    return prepared.filter(
      (p) =>
        p.row.maskedCode.toLowerCase().includes(q) ||
        p.summary.sentence.toLowerCase().includes(q),
    );
  }, [prepared, query]);

  const pressing = prepared.filter((p) => p.summary.pressing && p.row.mine).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a case"
          aria-label="Find a case"
          className="w-[320px] rounded-lg border px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-1"
          style={{ borderColor: query ? NAVY : '#D6DCE7', color: '#3C4A61' }}
        />
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          <b style={{ color: NAVY_DEEP }}>{shown.length}</b>
          {query.trim() !== '' && <> of {prepared.length}</>}{' '}
          {shown.length === 1 ? 'case' : 'cases'}, soonest first
          {query.trim() === '' && pressing > 0 && (
            <>
              {'. '}
              <b style={{ color: RED }}>{pressing}</b> need{pressing === 1 ? 's' : ''} you today
            </>
          )}
          .
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          No case matches that.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((p) => (
            <Row key={p.row.runId} row={p.row} summary={p.summary} />
          ))}
        </div>
      )}
    </div>
  );
}
