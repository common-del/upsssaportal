'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { assignSchoolsToVerifier, reassignVerifier } from '@/lib/actions/verification';
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

export type VerificationTab = 'todo' | 'accepted' | 'appealed';

/**
 * The whole verification lifecycle, in three tabs named after what has to happen.
 *
 * A school submits, a verifier checks it, and then exactly one of two things
 * follows: the school takes the score, or it appeals. So there are three states
 * anyone can act on — waiting to be checked, settled, and with SSSA. Each is a tab.
 *
 * Getting here took removing three things that all described the data correctly
 * and still made the page hard to read:
 *
 * "Unassigned" was `rows.filter(r => !r.verifierId)` — a strict subset of the
 * queue beside it, so two counts sat side by side over overlapping piles of the
 * same schools. It is a toggle on the first tab.
 *
 * Four outcome labels — matched, marked down and accepted, under appeal, appeal
 * decided — were four things to remember for two possible actions. Whether the
 * scores happened to match is not a different situation from the school accepting
 * a lower one; in both the verification stands and nobody owes anything. Open
 * versus decided is carried by the Decide button and the waiting count, which is
 * where an officer looks anyway.
 *
 * Appeals was a separate sidebar page. It was the third outcome of this one, and
 * splitting it meant an appealed school appeared in two places with two tables and
 * no way to see it beside the verification it disputes.
 *
 * The verifier list has moved to Users, where a verifier's profile already lives.
 * Assignment does not need it — the picker in each row shows how loaded everyone is.
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
  /** Was its own tab. The rows never differed, only the filter. */
  const [unassignedOnly, setUnassignedOnly] = useState(false);
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
    () => (unassignedOnly ? matched.filter((r) => !r.verifierId) : matched),
    [matched, unassignedOnly],
  );
  /** For the toggle's own count, which has to survive the toggle being on. */
  const unassignedCount = useMemo(() => matched.filter((r) => !r.verifierId).length, [matched]);
  const acceptedRows = useMemo(
    () => data.verified.filter((r) => match(r) && !r.appealed),
    [data.verified, match],
  );
  const appealedRows = useMemo(
    () => data.verified.filter((r) => match(r) && r.appealed),
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

  function VerifierCell({ row }: { row: QueueRow }) {
    const isEditing = editing === row.udise;
    const options = eligibleFor(row.districtCode, row.verifierId).filter(
      (v) => v.id === row.verifierId || loadOf(v) < MAX_PER_VERIFIER,
    );

    if (row.verifierId && !isEditing) {
      return (
        <>
          <Link
            href={`/app/sssa/users/${row.verifierId}`}
            className="font-semibold hover:underline"
            style={{ color: NAVY }}
          >
            {row.verifierName}
          </Link>
          <button
            type="button"
            onClick={() => setEditing(row.udise)}
            disabled={pending && busy === row.udise}
            className="ml-2 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] disabled:opacity-50"
          >
            {busy === row.udise ? 'Saving…' : 'Change'}
          </button>
        </>
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
        className={`w-[240px] max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B] disabled:opacity-50 ${
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

  function SchoolTable({ rows, action }: { rows: QueueRow[]; action: string }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
          Nothing here.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
          <thead>
            <tr>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>District</th>
              <th className={`${th} text-right`}>Waiting</th>
              <th className={`${th} text-left`} style={{ width: 268 }}>
                {action}
              </th>
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
                <td className="px-4 py-3">
                  <VerifierCell row={r} />
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

  function VerifiedTable({ rows, appeal }: { rows: VerifiedRow[]; appeal?: boolean }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
          Nothing here matches those filters.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className={`w-full ${appeal ? 'min-w-[940px]' : 'min-w-[840px]'} overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]`}>
          <thead>
            <tr>
              <th className={`${th} text-left`}>School</th>
              <th className={`${th} text-left`}>District</th>
              <th className={`${th} text-left`}>Block</th>
              <th className={`${th} text-left`}>Verifier</th>
              <th className={`${th} text-right`}>Self</th>
              <th className={`${th} text-right`}>Verified</th>
              {/* Final only where an appeal can move it. On the accepted tab it
                  would repeat Verified on every row. */}
              {appeal && <th className={`${th} text-right`}>Final</th>}
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dropped =
                r.selfScore != null && r.verifiedScore != null && r.verifiedScore < r.selfScore;
              const raised =
                r.finalScore != null && r.verifiedScore != null && r.finalScore > r.verifiedScore;
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
                  {appeal && (
                    <td className="px-4 py-3 text-right">
                      {/* Green only where the appeal actually moved it — colour on an
                          unchanged figure would imply a decision that never happened. */}
                      <Score score={r.finalScore} band={r.finalBand} tone={raised ? 'green' : 'ink'} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={
                        appeal
                          ? `/app/sssa/finalization/appeal/${r.udise}`
                          : `/public/schools/${r.udise}`
                      }
                      className="inline-block whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-bold hover:bg-gray-50"
                      style={{ borderColor: NAVY, color: NAVY }}
                    >
                      {appeal ? (r.appealPending ? 'Decide' : 'View') : 'View'}
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

  const TABS: { id: VerificationTab; label: string; count: number; hot?: boolean }[] = [
    { id: 'todo', label: 'To check', count: data.waiting },
    { id: 'accepted', label: 'Score accepted', count: data.acceptedCount },
    // Hot only while something is undecided: an appealed school SSSA has already
    // ruled on is not work, and colouring the tab red for it would cry wolf.
    {
      id: 'appealed',
      label: 'Appealed',
      count: data.appealedCount,
      hot: data.appealPendingCount > 0,
    },
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
            // This was a tab of its own. As a toggle the relationship is obvious —
            // these schools are part of the list, not a separate pile — and the two
            // counts can no longer be read as adding up.
            <button
              type="button"
              onClick={() => setUnassignedOnly((v) => !v)}
              aria-pressed={unassignedOnly}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold ${
                unassignedOnly ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              No verifier yet{' '}
              <span className={`tabular-nums ${unassignedOnly ? 'opacity-80' : 'text-red-700'}`}>
                {inr(unassignedCount)}
              </span>
            </button>
          )}
          {tab === 'appealed' && data.appealPendingCount > 0 && (
            <span className="whitespace-nowrap text-[12.5px] tabular-nums text-gray-500">
              <b style={{ color: RED }}>{inr(data.appealPendingCount)}</b> waiting on a decision
            </span>
          )}
          <span className="ml-auto text-[12.5px] tabular-nums text-gray-500">
            {inr(
              tab === 'todo'
                ? queueRows.length
                : tab === 'accepted'
                  ? acceptedRows.length
                  : appealedRows.length,
            )}{' '}
            shown
          </span>
        </div>

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700">
          {message}
        </p>
      )}

      {tab === 'todo' && (
        <SchoolTable rows={queueRows} action={unassignedOnly ? 'Assign to' : 'Verifier'} />
      )}

      {tab === 'accepted' && <VerifiedTable rows={acceptedRows} />}

      {tab === 'appealed' && <VerifiedTable rows={appealedRows} appeal />}
    </div>
  );
}
