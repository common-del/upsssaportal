'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';
import {
  compareSummaries,
  summarise,
  weekdayTime,
  type QueueSummary,
} from '@/lib/verification/walkthroughSummary';
import {
  TABS,
  TAB_LABEL,
  TAB_NOTE,
  defaultTab,
  tabFor,
  type QueueTab,
} from '@/lib/verification/walkthroughTabs';

/**
 * The walkthrough queue, split three ways.
 *
 * SSSA asked for the three piles of work to be separated: cases with no time agreed, cases with
 * a call booked, and schools that are filming. They are three tabs rather than three stacked
 * tables, which was the decision taken with the cost in front of it.
 *
 * The reason to split at all is that the three share almost no columns. A case nobody has
 * spoken to has a risk score and an age and no window; a booked call has a time and no clips; a
 * recording case has a filming window and no appointment. One table across all three would mean
 * either a column of empty cells for two thirds of the rows or one State column doing the work
 * of four, which is the sentence-per-row list this replaces.
 *
 * The cost of tabs is that two thirds of the work is always hidden, and a call running right now
 * would be hidden with it. Two things answer that and no more: every tab carries its count, and
 * the count turns red when that tab holds something needing the verifier today; and the page
 * opens on Booked instead of To schedule when one of their own calls is live. Which tab a case
 * belongs to, and which tab opens, are rules about the state machine, so they live in
 * walkthroughTabs.ts with the reasoning and the tests.
 *
 * Searching looks across all three and prints the per-tab count of matches, so a case in a tab
 * you are not on announces where it is instead of reading as no result.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const RED = '#96271E';
const RULE = '#E5E9F0';

/** Enough of the code to tell nine cases apart at a glance. The whole code is on the cell's
 *  tooltip and inside the console, and search still matches it in full. */
function shortCode(maskedCode: string): string {
  const body = maskedCode.startsWith('SC-') ? maskedCode.slice(3) : maskedCode;
  return body.length <= 6 ? maskedCode : `SC-${body.slice(0, 4)}…`;
}

type Prepared = {
  row: WalkthroughQueueRow;
  summary: QueueSummary;
  tab: QueueTab;
  enteredStateAt: string;
  waitingDays: number;
};

const DAY = 86_400_000;

function Code({ maskedCode }: { maskedCode: string }) {
  return (
    <span className="font-mono text-[13px] font-bold" title={maskedCode} style={{ color: NAVY_DEEP }}>
      {shortCode(maskedCode)}
    </span>
  );
}

/** The turnaround, as one phrase rather than a figure above a caption: a table row is one line. */
function deadlineText(p: Prepared): string {
  return p.row.overdue ? `${p.summary.clock} over` : `${p.summary.clock} left`;
}

function Action({ p }: { p: Prepared }) {
  if (!p.row.mine) {
    return (
      <span className="flex items-center justify-end gap-2.5">
        <span className="hidden text-[12px] sm:inline" style={{ color: INK_MUTED }}>
          Nobody has taken this
        </span>
        <ClaimWalkthroughButton runId={p.row.runId} />
      </span>
    );
  }
  // Gold for the one action that leaves the online track: sending a case to the field is not the
  // same kind of move as opening it, and it should not look like one.
  const toField = p.summary.action === 'Send to the field';
  return (
    <span className="flex justify-end">
      <Link
        href={`/app/verifier/walkthrough/${p.row.runId}`}
        className="inline-flex min-h-[40px] items-center rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
        style={{ backgroundColor: toField ? GOLD : NAVY }}
      >
        {p.summary.action}
      </Link>
    </span>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      style={{ color: '#8A97AC' }}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-4 py-3 text-[13.5px] ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </td>
  );
}

function Rows({ rows, children }: { rows: Prepared[]; children: (p: Prepared) => React.ReactNode }) {
  return (
    <tbody>
      {rows.map((p) => (
        <tr
          key={p.row.runId}
          className="border-t"
          style={{
            borderColor: RULE,
            // Red marks one thing on this screen: it needs you today. Not "overdue", which on
            // this backlog is most of the list.
            boxShadow: p.summary.pressing && p.row.mine ? `inset 3px 0 0 ${RED}` : undefined,
          }}
        >
          {children(p)}
        </tr>
      ))}
    </tbody>
  );
}

function ToScheduleTable({ rows }: { rows: Prepared[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Case</Th>
          <Th>In dispute</Th>
          <Th>Waiting</Th>
          <Th>Deadline</Th>
          <Th>Risk</Th>
          <Th align="right">&nbsp;</Th>
        </tr>
      </thead>
      <Rows rows={rows}>
        {(p) => (
          <>
            <Td>
              <Code maskedCode={p.row.maskedCode} />
            </Td>
            <Td>
              <span className="tabular-nums">{p.row.disputed}</span>{' '}
              <span style={{ color: INK_MUTED }}>
                {p.row.disputed === 1 ? 'indicator' : 'indicators'}
              </span>
            </Td>
            <Td>
              <span className="tabular-nums">{p.waitingDays}d</span>
            </Td>
            <Td>
              <span
                className="tabular-nums font-semibold"
                style={{ color: p.row.overdue ? RED : NAVY }}
              >
                {deadlineText(p)}
              </span>
            </Td>
            <Td>
              <span className="tabular-nums" style={{ color: INK_MUTED }}>
                {p.row.riskScore !== null ? `${p.row.riskScore}%` : '—'}
              </span>
            </Td>
            <Td align="right">
              <Action p={p} />
            </Td>
          </>
        )}
      </Rows>
    </table>
  );
}

function BookedTable({ rows }: { rows: Prepared[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Case</Th>
          <Th>Call</Th>
          <Th>In dispute</Th>
          <Th>Deadline</Th>
          <Th align="right">&nbsp;</Th>
        </tr>
      </thead>
      <Rows rows={rows}>
        {(p) => {
          const live = p.row.sessionState === 'LIVE';
          // summarise already decides whether a started call is running or was never closed,
          // using the four hour rule. Reading it back here keeps one definition of stale.
          const stale = p.summary.clockNote === 'call never closed';
          return (
            <>
              <Td>
                <Code maskedCode={p.row.maskedCode} />
              </Td>
              <Td>
                {live ? (
                  <span className="font-bold" style={{ color: RED }}>
                    {stale ? 'Never closed' : 'Running now'}
                  </span>
                ) : p.row.scheduledFor ? (
                  <span className="font-semibold" style={{ color: NAVY_DEEP }}>
                    {weekdayTime(p.row.scheduledFor)}
                  </span>
                ) : (
                  <span style={{ color: INK_MUTED }}>No time recorded</span>
                )}
              </Td>
              <Td>
                <span className="tabular-nums">{p.row.observed}</span>
                <span style={{ color: INK_MUTED }}>
                  {' '}
                  of {p.row.disputed} settled
                </span>
              </Td>
              <Td>
                <span
                  className="tabular-nums font-semibold"
                  style={{ color: p.row.overdue ? RED : NAVY }}
                >
                  {deadlineText(p)}
                </span>
              </Td>
              <Td align="right">
                <Action p={p} />
              </Td>
            </>
          );
        }}
      </Rows>
    </table>
  );
}

function RecordingsTable({ rows }: { rows: Prepared[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Case</Th>
          <Th>Clips in</Th>
          <Th>Window</Th>
          <Th>Settled</Th>
          <Th align="right">&nbsp;</Th>
        </tr>
      </thead>
      <Rows rows={rows}>
        {(p) => {
          const returned = p.row.clipsReturned ?? 0;
          const missing = Math.max(0, p.row.disputed - returned);
          return (
            <>
              <Td>
                <Code maskedCode={p.row.maskedCode} />
              </Td>
              <Td>
                {returned === 0 ? (
                  <span style={{ color: INK_MUTED }}>None yet</span>
                ) : (
                  <span className="tabular-nums font-semibold" style={{ color: NAVY_DEEP }}>
                    {returned} of {p.row.disputed}
                  </span>
                )}
              </Td>
              <Td>
                {p.row.windowClosed ? (
                  <span className="font-semibold" style={{ color: RED }}>
                    Closed
                    {missing > 0 && (
                      <span className="font-normal">
                        {' · '}
                        {missing} never sent
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="tabular-nums" style={{ color: NAVY }}>
                    {p.row.hoursLeft ?? 0}h left
                  </span>
                )}
              </Td>
              <Td>
                <span className="tabular-nums">{p.row.observed}</span>
                <span style={{ color: INK_MUTED }}> of {p.row.disputed}</span>
              </Td>
              <Td align="right">
                <Action p={p} />
              </Td>
            </>
          );
        }}
      </Rows>
    </table>
  );
}

export function WalkthroughQueueList({ rows }: { rows: WalkthroughQueueRow[] }) {
  const [query, setQuery] = useState('');

  const prepared = useMemo<Prepared[]>(() => {
    const now = new Date();
    return rows.map((row) => ({
      row,
      summary: summarise(row, now),
      tab: tabFor(row, now),
      enteredStateAt: row.enteredStateAt,
      waitingDays: Math.max(0, Math.round((now.getTime() - Date.parse(row.enteredStateAt)) / DAY)),
    }));
  }, [rows]);

  const [tab, setTab] = useState<QueueTab>(() =>
    defaultTab(rows.map((r) => ({ facts: { sessionState: r.sessionState }, mine: r.mine }))),
  );

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return prepared;
    return prepared.filter(
      (p) =>
        p.row.maskedCode.toLowerCase().includes(q) || p.summary.sentence.toLowerCase().includes(q),
    );
  }, [prepared, query]);

  const byTab = useMemo(() => {
    const out = {} as Record<QueueTab, Prepared[]>;
    for (const t of TABS) {
      out[t] = matching
        .filter((p) => p.tab === t)
        .sort((a, b) =>
          // Anything nobody has taken sits below everything claimed, whatever its clock says: a
          // case you cannot act on is not the next thing to do.
          Number(a.row.mine) === Number(b.row.mine)
            ? compareSummaries(a, b)
            : Number(b.row.mine) - Number(a.row.mine),
        );
    }
    return out;
  }, [matching]);

  const shown = byTab[tab];
  const searching = query.trim() !== '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a case"
          aria-label="Find a case across all three tabs"
          className="w-[320px] rounded-lg border px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-1"
          style={{ borderColor: query ? NAVY : '#D6DCE7', color: '#3C4A61' }}
        />
        {searching && (
          <p className="text-[13px]" style={{ color: INK_MUTED }}>
            <b style={{ color: NAVY_DEEP }}>{matching.length}</b> of {prepared.length}{' '}
            {matching.length === 1 ? 'case matches' : 'cases match'}, counted on each tab.
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Walkthrough stages" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = byTab[t].length;
          const pressing = byTab[t].some((p) => p.summary.pressing && p.row.mine);
          const active = t === tab;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg border-2 px-4 py-2.5 text-[13.5px] font-bold"
              style={{
                borderColor: active ? NAVY_DEEP : RULE,
                backgroundColor: active ? NAVY_DEEP : '#FFFFFF',
                color: active ? '#FFFFFF' : INK_MUTED,
              }}
            >
              {TAB_LABEL[t]}
              <span
                className="inline-flex min-w-[24px] justify-center rounded-full px-1.5 py-0.5 text-[12px] font-extrabold tabular-nums"
                style={{
                  // The count is the only thing carrying urgency across a tab boundary, so it is
                  // the thing that goes red.
                  backgroundColor: pressing ? RED : active ? '#FFFFFF' : '#EDEFF3',
                  color: pressing ? '#FFFFFF' : active ? NAVY_DEEP : INK_MUTED,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: RULE }}>
        {shown.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: INK_MUTED }}>
            {searching ? 'No case here matches that.' : 'Nothing is waiting in this tab.'}
          </p>
        ) : tab === 'TO_SCHEDULE' ? (
          <ToScheduleTable rows={shown} />
        ) : tab === 'BOOKED' ? (
          <BookedTable rows={shown} />
        ) : (
          <RecordingsTable rows={shown} />
        )}
      </div>

      <p className="text-xs" style={{ color: INK_MUTED }}>
        {TAB_NOTE[tab]}
      </p>
    </div>
  );
}
