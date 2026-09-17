'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acknowledgeIntegrityReport } from '@/lib/actions/audit';

const RED = '#96271E';

/**
 * Recording that the Authority has seen a report of inducement or pressure.
 *
 * One button, no confirmation. Acknowledging is not a ruling and does not close anything: it
 * says somebody read it. The consequential action is on the subject's own record, and that has
 * its own friction.
 */
export function AcknowledgeReport({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function acknowledge() {
    setError('');
    startTransition(async () => {
      const res = await acknowledgeIntegrityReport(id);
      if (!res.success) return setError(res.error ?? 'Could not acknowledge it.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={acknowledge}
        disabled={pending}
        className="min-h-[44px] rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: RED }}
      >
        {pending ? 'Recording…' : 'Acknowledge'}
      </button>
      {error && (
        <p role="alert" className="text-[13px] font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}
