'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { assignSchoolsToVerifier, reassignVerifier } from '@/lib/actions/verification';
import { RemindVerifierButton } from '@/components/sssa/RemindVerifierButton';
import type {
  QueueRow,
  VerificationQueue,
  VerifiedRow,
  VerifierSummary,
} from '@/lib/sssa/verificationQueue';

const NAVY = '#1B2A6B';
const RED = '#C8372D';
const MAX_PER_VERIFIER = 50;

const inr = (n: number) => n.toLocaleString('en-IN');
const waitColor = (d: number) => (d >= 14 ? RED : d >= 7 ? '#B8791A' : '#111827');

export type VerificationTab = 'todo' | 'decide';

/**
 * Two queues, and nothing else.
 *
 * To check is work for a verifier. To decide is work for SSSA. Every number on this
 * page is therefore a count of things somebody has to do — a completed verification
 * is not work and has no place here. Finalization & Results holds the finished ones,
 * with the final score and an appeal filter.
 *
 * Each earlier version put something on the bar that was not workload:
 *
 * "Unassigned" was `rows.filter(r => !r.verifierId)`, a strict subset of the queue
 * beside it, so two counts described overlapping piles of the same schools. It is
 * a toggle on the first tab.
 *
 * Four outcome labels — matched, marked down and accepted, under appeal, appeal
 * decided — were four things to remember for two possible actions. Whether the two
 * scorings happened to land on the same number is not a different situation from a
 * school accepting a lower one.
 *
 * "Appealed" then held ruled appeals alongside open ones, so its count answered
 * "how many appeals have ever existed" when the only useful question is how many
 * are unanswered.
 *
 * "Score accepted" was 278 rows of finished business on a page whose other two
 * numbers were queues, so the bar mixed a backlog with an archive.
 *
 * Appeals was also a separate sidebar page, which listed appealed schools twice and
 * never beside the verification they dispute. The verifier list has moved to Users,
 * where a verifier's profile already lives; assignment does not need it, because
 * the picker in each row shows how loaded everyone is.
 */
export function VerificationTabs({
  data,
  initialTab = 'todo',
}: {
  data: VerificationQueue;
  /** From ?tab= so a link can open the right list and the view is shareable. */
  initialTab?: VerificationTab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<VerificationTab>(initialTab);
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [q, setQ] = useState('');
  /** Was its own tab, then a single toggle whose label only described one of the
   *  two groups. Three states, each named for what it shows. */
  const [assignment, setAssignment] = useState<'' | 'assigned' | 'unassigned'>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local deltas so a row assigned a moment ago shows the verifier's new load
  // without waiting for a refetch.
  const [delta, setDelta] = useState<Record<string, number>>({});
  const loadOf = useCallback(
    (v: VerifierSummary) => v.assigned + (delta[v.id] ?? 0),
    [delta],
  );

  const eligibleFor = useCallback(
    (districtCode: string, keep?: string | null) =>
      data.verifiers
        // A verifier with no district set covers anywhere: that is missing data, not
        // a restriction, so they are offered rather than hidden.
        .filter((v) => !v.districtCode || v.districtCode === districtCode || v.id === keep)
        .sort((a, b) => loadOf(a) - loadOf(b)),
    [data.verifiers, loadOf],
  );

  const districts = useMemo(
    // Drawn from both lists. Built from the queue alone, the dropdown would omit
    // any district whose schools have all been verified — exactly the districts
    // somebody browsing the Verified tab is looking for.
    () =>
      [
        ...new Map(
          [...data.rows, ...data.verified].map((r) => [r.districtCode, r.district]),
        ).entries(),
      ]
        .filter(([c]) => c)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [data.rows, data.verified],
  );
  const blocks = useMemo(
    () =>
      [
        ...new Map(
          [...data.rows, ...data.verified]
            .filter((r) => !district || r.districtCode === district)
            .map((r) => [r.blockCode, r.block]),
        ).entries(),
      ]
        .filter(([c]) => c)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [data.rows, data.verified, district],
  );

  const match = useCallback(
    (r: { school: string; udise: string; districtCode: string; blockCode: string }) =>
      (!district || r.districtCode === district) &&
      (!block || r.blockCode === block) &&
      (!q ||
        r.school.toLowerCase().includes(q.trim().toLowerCase()) ||
        r.udise.includes(q.trim())),
    [district, block, q],
  );

  const matched = useMemo(() => data.rows.filter(match), [data.rows, match]);
  const queueRows = useMemo(
    () =>
      assignment === 'assigned'
        ? matched.filter((r) => r.verifierId)
        : assignment === 'unassigned'
          ? matched.filter((r) => !r.verifierId)
          : matched,
    [matched, assignment],
  );
  /** Counted off `matched`, not `queueRows`, so each chip keeps its own number
   *  while another chip is active. */
  const assignedCount = useMemo(() => matched.filter((r) => r.verifierId).length, [matched]);
  // Only appeals SSSA has not answered. A ruled appeal is finished work and lives
  // on Finalization & Results with the other completed verifications.
  const toDecideRows = useMemo(
    () => data.verified.filter((r) => match(r) && r.appealPending),
    [data.verified, match],
  );

  function assign(row: QueueRow, verifierId: string, verifierName: string) {
    setBusy(row.udise);
    setMessage(null);
    startTransition(async () => {
      const res = await assignSchoolsToVerifier(data.cycleId, verifierId, [row.udise]);
      setBusy(null);
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setDelta((d) => ({ ...d, [verifierId]: (d[verifierId] ?? 0) + 1 }));
      setMessage(`${row.school} assigned to ${verifierName}.`);
      router.refresh();
    });
  }

  function change(row: QueueRow, toId: string, toName: string) {
    if (!row.assignmentId || toId === row.verifierId) {
      setEditing(null);
      return;
    }
    setBusy(row.udise);
    startTransition(async () => {
      await reassignVerifier(row.assignmentId!, toId);
      setBusy(null);
      setEditing(null);
      setDelta((d) => ({
        ...d,
        [row.verifierId!]: (d[row.verifierId!] ?? 0) - 1,
        [toId]: (d[toId] ?? 0) + 1,
      }));
      setMessage(`${row.school} moved to ${toName}.`);
      router.refresh();
    });
  }

  const th = 'border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-gray-500';
  const selectCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  /** Widths are fixed so the picker and the name occupy the same span. Without
   *  that, clicking Change swaps a short name for a 240px select and every column
   *  to its left jumps. */
  const VERIFIER_COL = 264;
  const ACTION_COL = 96;
  const REMIND_COL = 104;

  /** The name, or the picker when there is nobody yet or somebody is changing it. */
  function VerifierCell({ row }: { row: QueueRow }) {
    const isEditing = editing === row.udise;
    const options = eligibleFor(row.districtCode, row.verifierId).filter(
      (v) => v.id === row.verifierId || loadOf(v) < MAX_PER_VERIFIER,
    );

    if (row.verifierId && !isEditing) {
      return (
        <Link
          href={`/app/sssa/users/${row.verifierId}`}
          className="font-semibold hover:underline"
          style={{ color: NAVY }}
        >
          {row.verifierName}
        </Link>
      );
    }

    if (options.length === 0) {
      return <span className="text-[12px] text-red-700">No verifier in {row.district}</span>;
    }

    return (
      <select
        autoFocus={isEditing}
        defaultValue={row.verifierId ?? ''}
        disabled={pending && busy === row.udise}
        onChange={(e) => {
          const v = options.find((o) => o.id === e.target.value);
          if (!v) return;
          if (row.verifierId) change(row, v.id, v.name);
          else assign(row, v.id, v.name);
        }}
        className={`w-full truncate rounded-lg border px-2.5 py-1.5 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B] disabled:opacity-50 ${
          row.verifierId ? 'border-gray-300' : 'border-[#E0A49C]'
        }`}
      >
        {!row.verifierId && (
          <option value="">{busy === row.udise ? 'Assigning…' : 'Choose verifier…'}</option>
        )}
        {options.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} — {loadOf(v)} of {v.capacity ?? MAX_PER_VERIFIER}
          </option>
        ))}
      </select>
    );
  }

  /** Its own column. Sharing a cell with the name meant it started wherever that
   *  name happened to end, so the buttons stepped raggedly down the page. */
  function VerifierAction({ row }: { row: QueueRow }) {
    if (!row.verifierId || editing === row.udise) return null;
    return (
      <button
        type="button"
        onClick={() => setEditing(row.udise)}
        disabled={pending && busy === row.udise}
        className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] disabled:opacity-50"
      >
        {busy === row.udise ? 'Saving…' : 'Change'}
      </button>
    );
  }

  function SchoolTable({
    rows,
    action,
    showRemind,
  }: {
    rows: QueueRow[];
    action: string;
    /** Dropped entirely on the Not assigned view: every row there has nobody to
     *  chase, so the column would be a header over a column of blanks. */
    showRemind: boolean;
  }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
          Nothing here.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table
          className={`w-full ${showRemind ? 'min-w-[880px]' : 'min-w-[760px]'} overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]`}
        >
          <thead>
            <tr>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>District</th>
              <th className={`${th} text-right`}>Waiting</th>
              <th className={`${th} text-left`} style={{ width: VERIFIER_COL }}>
                {action}
              </th>
              {showRemind && (
                <th className={`${th} text-right`} style={{ width: REMIND_COL }}>
                  Remind
                </th>
              )}
              <th className={th} style={{ width: ACTION_COL }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                <td className="px-4 py-3">
                  <span className="block font-semibold" style={{ color: NAVY }}>
                    {r.school}
                  </span>
                  <span className="text-[11.5px] text-gray-500">{r.block}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.district}</td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: waitColor(r.daysWaiting) }}
                >
                  {r.daysWaiting} days
                </td>
                <td className="px-4 py-3" style={{ width: VERIFIER_COL }}>
                  <VerifierCell row={r} />
                </td>
                {/* Left blank rather than dashed on an unassigned row in the All
                    view: there is nobody to chase, and a dash reads as a value. */}
                {showRemind && (
                  <td className="px-4 py-3 text-right" style={{ width: REMIND_COL }}>
                    {r.verifierId ? (
                      <RemindVerifierButton udise={r.udise} lastRemindedAt={r.remindedAt ?? undefined} />
                    ) : null}
                  </td>
                )}
                <td className="px-4 py-3" style={{ width: ACTION_COL }}>
                  <VerifierAction row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /** A score over its band. One decimal: two indicators out of dozens shift a
   *  weighted percentage by tenths, and rounding to whole numbers printed a
   *  school's self and verified scores as the same figure. */
  function Score({ score, band, tone = 'ink' }: { score: number | null; band: string | null; tone?: 'ink' | 'red' | 'green' }) {
    if (score == null) return <span className="text-gray-400">—</span>;
    const color = tone === 'red' ? RED : tone === 'green' ? '#1C7A4A' : '#111827';
    return (
      <span className="flex flex-col items-end leading-tight">
        <span className="font-bold tabular-nums" style={{ color }}>
          {score.toFixed(1)}
        </span>
        {band && <span className="text-[10.5px] text-gray-500">{band}</span>}
      </span>
    );
  }

  /** Appeals waiting on SSSA. Self and verified are what the school is arguing
   *  about; Final is not shown, because until the decision is made it is only ever
   *  a copy of Verified — a column that repeats its neighbour on every row and then
   *  changes the moment you leave the page. */
  function AppealTable({ rows }: { rows: VerifiedRow[] }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
          Nothing here matches those filters.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
          <thead>
            <tr>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>District</th>
              <th className={`${th} text-left`}>Block</th>
              <th className={`${th} text-left`}>Verifier</th>
              <th className={`${th} text-right`}>Self</th>
              <th className={`${th} text-right`}>Verified</th>
              <th className={th} style={{ width: ACTION_COL }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dropped =
                r.selfScore != null && r.verifiedScore != null && r.verifiedScore < r.selfScore;
              return (
                <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                  <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                    {r.school}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.district}</td>
                  <td className="px-4 py-3 text-gray-700">{r.block}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.verifierId ? (
                      <Link href={`/app/sssa/users/${r.verifierId}`} className="hover:underline">
                        {r.verifierName}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Score score={r.selfScore} band={r.selfBand} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Score score={r.verifiedScore} band={r.verifiedBand} tone={dropped ? 'red' : 'ink'} />
                  </td>
                  <td className="px-4 py-3 text-right" style={{ width: ACTION_COL }}>
                    <Link
                      href={`/app/sssa/finalization/appeal/${r.udise}`}
                      className="inline-block whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-bold hover:bg-gray-50"
                      style={{ borderColor: NAVY, color: NAVY }}
                    >
                      Decide
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Two counts, both of them work outstanding. Nothing on this bar needs a caveat
  // about what it includes.
  const TABS: { id: VerificationTab; label: string; count: number; hot?: boolean }[] = [
    { id: 'todo', label: 'To check', count: data.waiting },
    { id: 'decide', label: 'To decide', count: data.awaitingDecisionCount, hot: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => {
              setTab(t.id);
              setEditing(null);
              // Written straight into the history entry, not pushed through the
              // router: the tab is client state, so without this the URL stayed
              // /verifiers and opening a school then pressing Back returned to a
              // page with no ?tab= — which defaults to the first tab, not the one
              // you were on. replaceState updates the entry in place, so no
              // navigation happens and the district and search filters survive.
              if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                window.history.replaceState(null, '', t.id === 'todo' ? path : `${path}?tab=${t.id}`);
              }
            }}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${
              t.id === tab
                ? 'border-[#1B2A6B] text-[#1B2A6B]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                t.id === tab
                  ? t.hot && t.count > 0
                    ? 'bg-[#C8372D] text-white'
                    : 'bg-[#1B2A6B] text-white'
                  : t.hot && t.count > 0
                    ? 'bg-red-50 text-red-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {inr(t.count)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search school or UDISE"
            className="min-w-[190px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          />
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setBlock('');
            }}
            className={selectCls}
          >
            <option value="">All districts</option>
            {districts.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <select value={block} onChange={(e) => setBlock(e.target.value)} className={selectCls}>
            <option value="">All blocks</option>
            {blocks.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {tab === 'todo' && (
            // Both halves are nameable and reachable. One toggle labelled "No verifier
            // yet" only described the state it switched to, so its count read as a
            // badge on the whole list rather than the size of one group in it.
            <span className="inline-flex overflow-hidden rounded-full border border-gray-300">
              {(
                [
                  { id: '', label: 'All', count: matched.length },
                  { id: 'assigned', label: 'Waiting on verifier', count: assignedCount },
                  {
                    id: 'unassigned',
                    label: 'Not assigned',
                    count: matched.length - assignedCount,
                    hot: true,
                  },
                ] as const
              ).map((f, i) => {
                const on = assignment === f.id;
                return (
                  <button
                    key={f.id || 'all'}
                    type="button"
                    onClick={() => setAssignment(f.id)}
                    aria-pressed={on}
                    className={`whitespace-nowrap px-3 py-1.5 text-[12px] font-bold ${
                      i > 0 ? 'border-l border-gray-300' : ''
                    } ${on ? 'bg-[#1B2A6B] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {f.label}{' '}
                    <span
                      className={`tabular-nums ${
                        on ? 'opacity-80' : 'hot' in f && f.hot && f.count > 0 ? 'text-red-700' : 'text-gray-400'
                      }`}
                    >
                      {inr(f.count)}
                    </span>
                  </button>
                );
              })}
            </span>
          )}
          <span className="ml-auto text-[12.5px] tabular-nums text-gray-500">
            {inr(tab === 'todo' ? queueRows.length : toDecideRows.length)} shown
          </span>
        </div>

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700">
          {message}
        </p>
      )}

      {tab === 'todo' && (
        <SchoolTable
          rows={queueRows}
          action={assignment === 'unassigned' ? 'Assign to' : 'Verifier'}
          showRemind={assignment !== 'unassigned'}
        />
      )}

      {tab === 'decide' && <AppealTable rows={toDecideRows} />}
    </div>
  );
}
