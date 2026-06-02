'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignSchoolsToVerifier, reassignVerifier } from '@/lib/actions/verification';
import { cn } from '@/lib/cn';

const MAX_PER_VERIFIER = 50;

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
  verifierId: string;
  verifierName: string;
};

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [verifierId, setVerifierId] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedVerifier = verifiers.find((v) => v.id === verifierId);

  // When a verifier is selected, auto-filter left pane to their district
  const effectiveDistrict = selectedVerifier?.districtCode ?? district;

  const blocksFiltered = useMemo(
    () => blocks.filter((b) => !effectiveDistrict || b.districtCode === effectiveDistrict),
    [blocks, effectiveDistrict],
  );

  const filteredUnassigned = useMemo(() => {
    const q = search.toLowerCase();
    return unassigned.filter((s) => {
      if (effectiveDistrict && s.districtCode !== effectiveDistrict) return false;
      if (block && s.blockCode !== block) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.udise.includes(q)) return false;
      return true;
    });
  }, [unassigned, effectiveDistrict, block, search]);

  const toggle = (udise: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(udise)) next.delete(udise);
      else next.add(udise);
      return next;
    });
  };

  const canAssignMore = selectedVerifier
    ? selectedVerifier.workload + selected.size <= MAX_PER_VERIFIER
    : true;

  const assign = () => {
    if (!verifierId || selected.size === 0) return;
    if (!canAssignMore) {
      setMessage(`Verifier ${selectedVerifier?.name} would exceed the 50-school cap.`);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await assignSchoolsToVerifier(cycleId, verifierId, [...selected]);
      setMessage(res.error ?? `Assigned ${res.assigned} school(s).`);
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Verifiers can only be assigned schools in their own district. Maximum {MAX_PER_VERIFIER} schools per verifier.
      </div>

      <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(['unassigned', 'assigned'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-semibold',
              tab === t ? 'bg-[#1B2A6B] text-white' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {t === 'unassigned' ? `Unassigned (${unassigned.length})` : `Assigned Schools (${assigned.length})`}
          </button>
        ))}
      </div>

      {message && (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">{message}</p>
      )}

      {tab === 'unassigned' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: school list */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <select
                value={effectiveDistrict}
                onChange={(e) => {
                  if (!selectedVerifier?.districtCode) {
                    setDistrict(e.target.value);
                    setBlock('');
                  }
                }}
                disabled={Boolean(selectedVerifier?.districtCode)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-60"
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.nameEn}
                  </option>
                ))}
              </select>
              <select
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                disabled={!effectiveDistrict}
              >
                <option value="">All blocks</option>
                {blocksFiltered.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.nameEn}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Search school or UDISE"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
              {filteredUnassigned.length === 0 ? (
                <li className="text-sm text-gray-500">No unassigned submitted schools match filters.</li>
              ) : (
                filteredUnassigned.map((s) => (
                  <li key={s.udise} className="flex items-start gap-2 rounded-lg border border-gray-100 p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(s.udise)}
                      onChange={() => toggle(s.udise)}
                      className="mt-1"
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">
                        {s.district} · {s.block} · {s.udise}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Right: verifier selection */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-[#1B2A6B]">Verifiers</h3>
            <ul className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
              {verifiers.map((v) => {
                const isFull = v.workload >= MAX_PER_VERIFIER;
                return (
                  <li key={v.id} className={cn('rounded-lg bg-gray-50 px-3 py-2', isFull && 'opacity-60')}>
                    <div className="flex justify-between">
                      <span className={isFull ? 'text-gray-400' : ''}>{v.name}</span>
                      <span className={cn('text-xs font-semibold', isFull ? 'text-red-500' : 'text-[#1B2A6B]')}>
                        {isFull ? `Full (${v.workload}/${MAX_PER_VERIFIER})` : `${v.workload}/${MAX_PER_VERIFIER}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn('h-full rounded-full transition-all', isFull ? 'bg-red-500' : 'bg-[#1B2A6B]')}
                        style={{ width: `${Math.min((v.workload / MAX_PER_VERIFIER) * 100, 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Assign selected to
              <select
                value={verifierId}
                onChange={(e) => {
                  setVerifierId(e.target.value);
                  setBlock('');
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select verifier…</option>
                {verifiers.map((v) => {
                  const isFull = v.workload >= MAX_PER_VERIFIER;
                  return (
                    <option key={v.id} value={v.id} disabled={isFull}>
                      {v.name} ({v.workload}/{MAX_PER_VERIFIER}){isFull ? ' — Full' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            {selectedVerifier && (
              <p className="mt-2 text-xs text-gray-500">
                District: {districts.find((d) => d.code === selectedVerifier.districtCode)?.nameEn ?? 'Not set'} · Left pane filtered to this district.
              </p>
            )}
            {selected.size > 0 && selectedVerifier && !canAssignMore && (
              <p className="mt-2 text-xs font-medium text-red-600">
                Adding {selected.size} would exceed the 50-school cap (currently {selectedVerifier.workload}).
              </p>
            )}
            <button
              type="button"
              disabled={pending || !verifierId || selected.size === 0 || !canAssignMore}
              onClick={assign}
              className="mt-4 w-full rounded-xl bg-[#1B2A6B] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? 'Assigning…' : `Assign Selected (${selected.size})`}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Verifier</th>
                <th className="px-4 py-3">Reassign</th>
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No assignments yet.
                  </td>
                </tr>
              ) : (
                assigned.map((row) => (
                  <tr key={row.assignmentId} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.schoolName}</p>
                      <p className="text-xs text-gray-500">{row.udise}</p>
                    </td>
                    <td className="px-4 py-3">{row.district}</td>
                    <td className="px-4 py-3">{row.verifierName}</td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          startTransition(async () => {
                            await reassignVerifier(row.assignmentId, v);
                            router.refresh();
                          });
                          e.target.value = '';
                        }}
                      >
                        <option value="">Reassign…</option>
                        {verifiers
                          .filter((ver) => ver.id !== row.verifierId && ver.workload < MAX_PER_VERIFIER)
                          .map((ver) => (
                            <option key={ver.id} value={ver.id}>
                              {ver.name} ({ver.workload}/{MAX_PER_VERIFIER})
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
