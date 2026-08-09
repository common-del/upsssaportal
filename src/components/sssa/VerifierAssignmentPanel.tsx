'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignSchoolsToVerifier, reassignVerifier } from '@/lib/actions/verification';

const MAX_PER_VERIFIER = 50;
const NAVY = '#1B2A6B';

export type UnassignedSchool = {
  udise: string;
  name: string;
  districtCode: string;
  district: string;
  blockCode: string;
  block: string;
};

export type VerifierRow = {
  id: string;
  name: string;
  workload: number;
  districtCode?: string | null;
};

export type AssignedRow = {
  assignmentId: string;
  udise: string;
  schoolName: string;
  district: string;
  districtCode: string;
  block: string;
  blockCode: string;
  verifierId: string;
  verifierName: string;
};

/**
 * Assignment, one row at a time.
 *
 * This was two panes: tick schools on the left, pick a verifier on the right,
 * press assign. That asks you to hold a selection in your head while scrolling a
 * separate list, and it stated the district rule in a notice while still offering
 * every verifier in the picker — so the rule was yours to remember and the
 * server's to reject. Each row now carries a picker containing only the verifiers
 * eligible for that school.
 *
 * On the assigned side the verifier is text, not a live select. A dropdown as the
 * default state means you cannot read who holds a school without parsing a form
 * control, and one stray click silently reassigns it. Reassignment is deliberate:
 * press Change, pick, or cancel.
 */
export function VerifierAssignmentPanel({
  cycleId,
  unassigned,
  verifiers,
  assigned,
  districts,
  blocks,
}: {
  cycleId: string;
  unassigned: UnassignedSchool[];
  verifiers: VerifierRow[];
  assigned: AssignedRow[];
  districts: { code: string; nameEn: string }[];
  blocks: { code: string; nameEn: string; districtCode: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'unassigned' | 'assigned'>('unassigned');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local workload so a row assigned a moment ago shows its new count without a
  // round trip — otherwise assigning three schools to one verifier shows the same
  // "11/50" three times and looks like nothing happened.
  const [extra, setExtra] = useState<Record<string, number>>({});
  const loadOf = useCallback((v: VerifierRow) => v.workload + (extra[v.id] ?? 0), [extra]);

  const eligibleFor = useMemo(() => {
    const byDistrict = new Map<string, VerifierRow[]>();
    for (const v of verifiers) {
      // A verifier with no district set can cover anywhere; that is a data gap,
      // not a permission, so they are offered everywhere rather than nowhere.
      const key = v.districtCode ?? '*';
      byDistrict.set(key, [...(byDistrict.get(key) ?? []), v]);
    }
    // Lightest load first, so the default choice spreads work rather than piling
    // it on whoever happens to sort first alphabetically.
    return (districtCode: string) =>
      [...(byDistrict.get(districtCode) ?? []), ...(byDistrict.get('*') ?? [])].sort(
        (a, b) => loadOf(a) - loadOf(b),
      );
  }, [verifiers, loadOf]);

  // Only blocks in the chosen district, so the second filter cannot contradict
  // the first. Picking a district clears a block that no longer belongs to it.
  const blocksShown = useMemo(
    () => blocks.filter((b) => !district || b.districtCode === district),
    [blocks, district],
  );
  function pickDistrict(code: string) {
    setDistrict(code);
    if (code && !blocks.some((b) => b.code === block && b.districtCode === code)) setBlock('');
  }

  const matches = useCallback(
    (r: { districtCode: string; blockCode: string; name: string; udise: string }) => {
      const q = search.trim().toLowerCase();
      return (
        (!district || r.districtCode === district) &&
        (!block || r.blockCode === block) &&
        (!q || r.name.toLowerCase().includes(q) || r.udise.includes(q))
      );
    },
    [district, block, search],
  );

  const rows = useMemo(() => unassigned.filter(matches), [unassigned, matches]);
  const assignedRows = useMemo(
    () =>
      assigned.filter((a) =>
        matches({
          districtCode: a.districtCode,
          blockCode: a.blockCode,
          name: a.schoolName,
          udise: a.udise,
        }),
      ),
    [assigned, matches],
  );

  function assign(udise: string, verifierId: string, verifierName: string) {
    setBusy(udise);
    setMessage(null);
    startTransition(async () => {
      const res = await assignSchoolsToVerifier(cycleId, verifierId, [udise]);
      setBusy(null);
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setExtra((e) => ({ ...e, [verifierId]: (e[verifierId] ?? 0) + res.assigned }));
      setMessage(`Assigned to ${verifierName}.`);
      router.refresh();
    });
  }

  function reassign(assignmentId: string, from: string, to: string, toName: string) {
    setBusy(assignmentId);
    startTransition(async () => {
      await reassignVerifier(assignmentId, to);
      setBusy(null);
      setEditing(null);
      setExtra((e) => ({
        ...e,
        [from]: (e[from] ?? 0) - 1,
        [to]: (e[to] ?? 0) + 1,
      }));
      setMessage(`Moved to ${toName}.`);
      router.refresh();
    });
  }

  function assignAllShown() {
    const target = eligibleFor(district)[0];
    if (!target) return;
    const udises = rows.slice(0, MAX_PER_VERIFIER - loadOf(target)).map((r) => r.udise);
    if (udises.length === 0) return;
    setBusy('bulk');
    startTransition(async () => {
      const res = await assignSchoolsToVerifier(cycleId, target.id, udises);
      setBusy(null);
      setExtra((e) => ({ ...e, [target.id]: (e[target.id] ?? 0) + res.assigned }));
      setMessage(res.error ?? `Assigned ${res.assigned} schools to ${target.name}.`);
      router.refresh();
    });
  }

  const lightest = district ? eligibleFor(district)[0] : null;
  const shown = tab === 'unassigned' ? rows.length : assignedRows.length;

  const selectCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';
  const th = 'border-b border-gray-100 px-4 py-3 text-left font-bold';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['unassigned', 'assigned'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setEditing(null);
            }}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${
              tab === t
                ? 'text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            style={tab === t ? { background: NAVY } : undefined}
          >
            {t === 'unassigned'
              ? `Unassigned (${unassigned.length})`
              : `Assigned (${assigned.length})`}
          </button>
        ))}
      </div>

      {/* One filter bar for both tabs, so narrowing to a block and switching tabs
          keeps you in the same place instead of resetting. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search school or UDISE"
          className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
        />
        <select value={district} onChange={(e) => pickDistrict(e.target.value)} className={selectCls}>
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.nameEn}
            </option>
          ))}
        </select>
        <select value={block} onChange={(e) => setBlock(e.target.value)} className={selectCls}>
          <option value="">All blocks</option>
          {blocksShown.map((b) => (
            <option key={b.code} value={b.code}>
              {b.nameEn}
            </option>
          ))}
        </select>
        {tab === 'unassigned' && district && lightest && rows.length > 1 && (
          <button
            type="button"
            onClick={assignAllShown}
            disabled={pending}
            className="rounded-lg border px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Assign all {rows.length} to {lightest.name}
          </button>
        )}
        <span className="ml-auto text-[13px] tabular-nums text-gray-500">{shown} shown</span>
      </div>

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700">
          {message}
        </p>
      )}

      {tab === 'unassigned' &&
        (rows.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-[13px] text-gray-500">
            Nothing to assign.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className={th}>School</th>
                  <th className={th}>Block</th>
                  <th className={th}>Assign to</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const options = eligibleFor(s.districtCode).filter(
                    (v) => loadOf(v) < MAX_PER_VERIFIER,
                  );
                  return (
                    <tr key={s.udise} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-3">
                        <span className="block font-semibold" style={{ color: NAVY }}>
                          {s.name}
                        </span>
                        <span className="font-mono text-xs text-gray-500">{s.udise}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {s.block}
                        <span className="block text-xs text-gray-500">{s.district}</span>
                      </td>
                      <td className="px-4 py-3">
                        {options.length === 0 ? (
                          <span className="text-xs text-red-700">
                            No verifier available in {s.district}
                          </span>
                        ) : (
                          <select
                            defaultValue=""
                            disabled={pending && busy === s.udise}
                            onChange={(e) => {
                              const v = options.find((o) => o.id === e.target.value);
                              if (v) assign(s.udise, v.id, v.name);
                              e.target.value = '';
                            }}
                            className="w-full max-w-[260px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B] disabled:opacity-50"
                          >
                            <option value="">
                              {busy === s.udise ? 'Assigning…' : 'Choose verifier…'}
                            </option>
                            {options.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} — {loadOf(v)}/{MAX_PER_VERIFIER}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'assigned' &&
        (assignedRows.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-[13px] text-gray-500">
            No assigned schools match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className={th}>School</th>
                  <th className={th}>Block</th>
                  <th className={th}>Verifier</th>
                  <th className="border-b border-gray-100 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {assignedRows.map((a) => {
                  // Reassignment obeys the same district rule as assignment. The
                  // current holder is always included so the row still renders if
                  // their district changed after the assignment was made.
                  const options = eligibleFor(a.districtCode);
                  const list = options.some((v) => v.id === a.verifierId)
                    ? options
                    : [...verifiers.filter((v) => v.id === a.verifierId), ...options];
                  const held = verifiers.find((v) => v.id === a.verifierId);
                  const isEditing = editing === a.assignmentId;
                  const full = held ? loadOf(held) >= MAX_PER_VERIFIER : false;

                  return (
                    <tr key={a.assignmentId} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                        {a.schoolName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {a.block}
                        <span className="block text-xs text-gray-500">{a.district}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            autoFocus
                            defaultValue={a.verifierId}
                            disabled={pending && busy === a.assignmentId}
                            onChange={(e) => {
                              const v = list.find((o) => o.id === e.target.value);
                              if (v && v.id !== a.verifierId) {
                                reassign(a.assignmentId, a.verifierId, v.id, v.name);
                              } else {
                                setEditing(null);
                              }
                            }}
                            className="w-full max-w-[250px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B] disabled:opacity-50"
                          >
                            {list.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} — {loadOf(v)}/{MAX_PER_VERIFIER}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <span className="font-medium text-gray-900">{a.verifierName}</span>
                            {held && (
                              <span
                                className="ml-2 text-xs tabular-nums"
                                style={{ color: full ? '#C8372D' : '#6B7280' }}
                              >
                                {loadOf(held)}/{MAX_PER_VERIFIER}
                                {full ? ' · at capacity' : ''}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(isEditing ? null : a.assignmentId)}
                          disabled={pending && busy === a.assignmentId}
                          className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
                          style={
                            isEditing
                              ? { borderColor: '#D1D5DB', color: '#6B7280' }
                              : { borderColor: NAVY, color: NAVY }
                          }
                        >
                          {busy === a.assignmentId ? 'Saving…' : isEditing ? 'Cancel' : 'Change'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
