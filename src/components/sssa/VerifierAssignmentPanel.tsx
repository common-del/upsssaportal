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
  verifierId: string;
  verifierName: string;
};

/**
 * Assignment, one row at a time.
 *
 * This was two panes: tick schools on the left, pick a verifier on the right,
 * press assign. That asks you to hold a selection in your head while scrolling a
 * separate list, and it stated the district rule in a notice — "verifiers can only
 * be assigned schools in their own district" — while still offering every verifier
 * in the dropdown, so the rule was yours to remember and the app's to reject.
 *
 * Each row now carries its own picker containing only the verifiers who are
 * actually eligible for that school. The rule is enforced by what is in the list
 * rather than by a sentence above it, there is no selection to lose, and a school
 * with nobody eligible says so on its own line instead of failing on submit.
 *
 * Bulk assignment survives for the case it is genuinely good at — one verifier
 * taking a whole block — but it is no longer the only way to assign anything.
 */
export function VerifierAssignmentPanel({
  cycleId,
  unassigned,
  verifiers,
  assigned,
  districts,
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
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local workload so a row assigned a moment ago shows its new count without a
  // round trip — otherwise assigning three schools to one verifier shows the same
  // "11/50" three times and looks like nothing happened.
  const [extra, setExtra] = useState<Record<string, number>>({});
  const loadOf = useCallback(
    (v: VerifierRow) => v.workload + (extra[v.id] ?? 0),
    [extra],
  );

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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassigned.filter(
      (s) =>
        (!district || s.districtCode === district) &&
        (!q || s.name.toLowerCase().includes(q) || s.udise.includes(q)),
    );
  }, [unassigned, district, search]);

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

  function assignAllShown() {
    // Only meaningful once narrowed to a district, because a verifier cannot take
    // schools outside their own.
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['unassigned', 'assigned'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${
              tab === t ? 'text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            style={tab === t ? { background: NAVY } : undefined}
          >
            {t === 'unassigned' ? `Unassigned (${unassigned.length})` : `Assigned (${assigned.length})`}
          </button>
        ))}
      </div>

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700">
          {message}
        </p>
      )}

      {tab === 'unassigned' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search school or UDISE"
              className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
            />
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.nameEn}
                </option>
              ))}
            </select>
            {district && lightest && rows.length > 1 && (
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
            <span className="ml-auto text-[13px] tabular-nums text-gray-500">
              {rows.length} shown
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-[13px] text-gray-500">
              Nothing to assign.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Block</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Assign to</th>
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
                            // Says so on the row rather than offering a verifier the
                            // server would reject.
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
          )}
        </>
      )}

      {tab === 'assigned' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((a) => {
                // Reassignment obeys the same district rule as assignment. The
                // current holder is always included so the row can render even if
                // their district was changed after the assignment was made.
                const options = eligibleFor(a.districtCode);
                const list = options.some((v) => v.id === a.verifierId)
                  ? options
                  : [...verifiers.filter((v) => v.id === a.verifierId), ...options];
                return (
                  <tr key={a.assignmentId} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      {a.schoolName}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.district}</td>
                    <td className="px-4 py-3">
                      <select
                        defaultValue={a.verifierId}
                        disabled={pending}
                        onChange={(e) =>
                          startTransition(async () => {
                            await reassignVerifier(a.assignmentId, e.target.value);
                            router.refresh();
                          })
                        }
                        className="w-full max-w-[260px] rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B] disabled:opacity-50"
                      >
                        {list.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} — {loadOf(v)}/{MAX_PER_VERIFIER}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
