'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { allocateNextDeskCases } from '@/lib/actions/supervisor';

const NAVY = '#1F3864';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * Batch allocation: hand the oldest unassigned desk cases to one online verifier. The
 * supervisor picks who and how many; the server picks which, oldest first, so allocation
 * cannot be used to steer particular schools to particular screeners.
 */
export function AllocateForm({
  verifiers,
  unassigned,
}: {
  verifiers: { profileId: string; name: string; openCount: number }[];
  unassigned: number;
}) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(verifiers[0]?.profileId ?? '');
  const [count, setCount] = useState(20);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (verifiers.length === 0 || unassigned === 0) {
    return (
      <p className="text-sm" style={{ color: '#5F7190' }}>
        {unassigned === 0
          ? 'Nothing is waiting for allocation.'
          : 'No certified online verifiers are available to allocate to.'}
      </p>
    );
  }

  function allocate() {
    setMessage(null);
    startTransition(async () => {
      const res = await allocateNextDeskCases(profileId, count);
      if (res.success) {
        setMessage({ kind: 'ok', text: `${res.allocated} case${res.allocated === 1 ? '' : 's'} allocated.` });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: res.error ?? 'Allocation failed.' });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: '#5F7190' }}>
          Verifier
        </span>
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
        >
          {verifiers.map((v) => (
            <option key={v.profileId} value={v.profileId}>
              {v.name} ({v.openCount} open)
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: '#5F7190' }}>
          Cases
        </span>
        <input
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setCount(Number.parseInt(e.target.value, 10) || 1)}
          className="w-24 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={allocate}
        disabled={pending}
        className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        style={{ backgroundColor: NAVY }}
      >
        {pending ? 'Allocating...' : 'Allocate oldest first'}
      </button>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className="text-sm font-semibold" style={{ color: message.kind === 'ok' ? GREEN : RED }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
