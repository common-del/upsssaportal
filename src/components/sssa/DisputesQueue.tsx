'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * TODO: Add a dedicated Dispute model (parameter-level SA vs verifier scores) when schema supports it.
 * Current queue uses public Ticket records as the dispute workflow proxy.
 */

export type DisputeQueueRow = {
  id: string;
  schoolName: string;
  parameter: string;
  saScore: string;
  verifierScore: string;
  reason: string;
  filedAt: string;
  status: string;
  statusLabel: string;
  detail: string;
};

export function DisputesQueue({ rows }: { rows: DisputeQueueRow[] }) {
  const [tab, setTab] = useState<'open' | 'review' | 'resolved' | 'all'>('open');
  const [district, setDistrict] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DisputeQueueRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === 'open' && (r.status === 'RESOLVED' || r.status === 'REJECTED')) return false;
      if (tab === 'review' && r.status !== 'RESPONDED') return false;
      if (tab === 'resolved' && r.status !== 'RESOLVED') return false;
      if (district && !r.detail.toLowerCase().includes(district.toLowerCase())) return false;
      if (search && !r.schoolName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, tab, district, search]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-800">No disputes have been filed yet.</p>
        <p className="mt-2 text-sm text-gray-500">
          When schools or parents file parameter disputes, they will appear in this queue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['open', 'Open'],
            ['review', 'Under Review'],
            ['resolved', 'Resolved'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold',
              tab === key ? 'bg-[#1B2A6B] text-white' : 'bg-white text-gray-600 border border-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <input
          type="search"
          placeholder="Search school"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Filter district (text)"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3">SA</th>
                <th className="px-4 py-3">Verifier</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Filed</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    'cursor-pointer border-b border-gray-50 hover:bg-gray-50',
                    selected?.id === r.id && 'bg-blue-50/50',
                  )}
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-3 font-medium">{r.schoolName}</td>
                  <td className="px-4 py-3 text-gray-600">{r.parameter}</td>
                  <td className="px-4 py-3">{r.saScore}</td>
                  <td className="px-4 py-3">{r.verifierScore}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-gray-600">{r.reason}</td>
                  <td className="px-4 py-3 text-gray-500">{r.filedAt}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {r.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          {selected ? (
            <>
              <h3 className="font-bold text-[#1B2A6B]">Dispute detail</h3>
              <p className="mt-2 text-sm text-gray-600">{selected.detail}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Parameter disputed</dt>
                  <dd className="font-medium">{selected.parameter}</dd>
                </div>
                <div className="flex gap-4">
                  <div>
                    <dt className="text-gray-500">SA score</dt>
                    <dd>{selected.saScore}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Verifier score</dt>
                    <dd>{selected.verifierScore}</dd>
                  </div>
                </div>
              </dl>
              <p className="mt-4 text-xs text-gray-500">Evidence files: not attached in ticket workflow.</p>
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  title="Coming soon"
                  className="w-full rounded-lg bg-[#1B2A6B] py-2 text-xs font-semibold text-white"
                >
                  Uphold school
                </button>
                <button
                  type="button"
                  title="Coming soon"
                  className="w-full rounded-lg border border-gray-300 py-2 text-xs font-semibold text-gray-700"
                >
                  Uphold verifier
                </button>
                <button
                  type="button"
                  title="Coming soon"
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900"
                >
                  Send back for re-verification
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a row to view details and resolution actions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
