'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acknowledgeIntegrityReport, type IntegrityReportRow } from '@/lib/actions/audit';

const NAVY = '#1F3864';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

export function IntegrityInbox({ rows }: { rows: IntegrityReportRow[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function acknowledge(id: string) {
    setError('');
    startTransition(async () => {
      const res = await acknowledgeIntegrityReport(id);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not acknowledge.');
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
        No reports filed.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border-2 border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">
              From {r.reportedBy}
              {r.about && <span style={{ color: RED }}> · about {r.about}</span>}
            </p>
            <p className="text-xs" style={{ color: INK_MUTED }}>
              {new Date(r.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{r.body}</p>
          <div className="mt-3">
            {r.auditAcknowledgedAt ? (
              <p className="text-xs font-bold" style={{ color: GREEN }}>
                Acknowledged {new Date(r.auditAcknowledgedAt).toLocaleString('en-IN')}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => acknowledge(r.id)}
                disabled={pending}
                className="rounded-lg border-2 px-4 py-2 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                Acknowledge receipt
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
