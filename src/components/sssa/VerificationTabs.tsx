'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { assignSchoolsToVerifier, reassignVerifier } from '@/lib/actions/verification';
import type { QueueRow, VerificationQueue, VerifierSummary } from '@/lib/sssa/verificationQueue';

const NAVY = '#1B2A6B';
const RED = '#C8372D';
const MAX_PER_VERIFIER = 50;

const inr = (n: number) => n.toLocaleString('en-IN');
const waitColor = (d: number) => (d >= 14 ? RED : d >= 7 ? '#B8791A' : '#111827');

type Tab = 'queue' | 'unassigned' | 'people';

/**
 * Verification as three tabs over one dataset.
 *
 * The page used to stack a queue, an idle-verifier table and an assignment panel
 * with its own tabs down a single scroll — four lists, two of them the same schools
 * seen twice. These are the same rows filtered three ways, so nothing is duplicated
 * and the tab counts cannot disagree with the tables under them.
 *
 * Assignment happens in the row, on either school tab. The picker only offers
 * verifiers in that school's district, so the rule is enforced by what is in the
 * list rather than by a notice above it.
 */
export function VerificationTabs({ data }: { data: VerificationQueue }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('queue');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [q, setQ] = useState('');
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
    () =>
      [...new Map(data.rows.map((r) => [r.districtCode, r.district])).entries()]
        .filter(([c]) => c)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [data.rows],
  );
  const blocks = useMemo(
    () =>
      [
        ...new Map(
          data.rows
            .filter((r) => !district || r.districtCode === district)
            .map((r) => [r.blockCode, r.block]),
        ).entries(),
      ]
        .filter(([c]) => c)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [data.rows, district],
  );

  const match = useCallback(
    (r: QueueRow) =>
      (!district || r.districtCode === district) &&
      (!block || r.blockCode === block) &&
      (!q ||
        r.school.toLowerCase().includes(q.trim().toLowerCase()) ||
        r.udise.includes(q.trim())),
    [district, block, q],
  );

  const queueRows = useMemo(() => data.rows.filter(match), [data.rows, match]);
  const unassignedRows = useMemo(() => queueRows.filter((r) => !r.verifierId), [queueRows]);

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

  const TABS: { id: Tab; label: string; count: number; hot?: boolean }[] = [
    { id: 'queue', label: 'Queue', count: data.waiting },
    { id: 'unassigned', label: 'Unassigned', count: data.unassigned, hot: true },
    { id: 'people', label: 'Verifiers', count: data.verifiers.length },
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

      {tab !== 'people' && (
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
          <span className="ml-auto text-[12.5px] tabular-nums text-gray-500">
            {inr(tab === 'queue' ? queueRows.length : unassignedRows.length)} shown
          </span>
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700">
          {message}
        </p>
      )}

      {tab === 'queue' && <SchoolTable rows={queueRows} action="Verifier" />}
      {tab === 'unassigned' && <SchoolTable rows={unassignedRows} action="Assign to" />}

      {tab === 'people' && (
        <>
          <p className="text-[12.5px] text-gray-500">
            Emptiest first. Open a name for their profile.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Verifier</th>
                  <th className={`${th} text-left`}>District</th>
                  <th className={`${th} text-right`}>Assigned</th>
                  <th className={`${th} text-right`}>Verified</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {data.verifiers.map((v) => {
                  const load = loadOf(v);
                  const cap = v.capacity ?? MAX_PER_VERIFIER;
                  const pct = cap > 0 ? Math.min(100, Math.round((load / cap) * 100)) : 0;
                  return (
                    <tr key={v.id} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/sssa/users/${v.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: NAVY }}
                        >
                          {v.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{v.district ?? '—'}</td>
                      <td
                        className="px-4 py-3 text-right font-bold tabular-nums"
                        style={{ color: load === 0 ? RED : '#111827' }}
                      >
                        {load}
                        <span className="font-normal text-gray-500"> of {cap}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {v.verified}
                      </td>
                      <td className="px-4 py-3" style={{ width: 120 }}>
                        <span className="block h-1.5 overflow-hidden rounded bg-gray-100">
                          <span
                            className="block h-full rounded"
                            style={{ width: `${pct}%`, background: pct >= 100 ? RED : NAVY }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
