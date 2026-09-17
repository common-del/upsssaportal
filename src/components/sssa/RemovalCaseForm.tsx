'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmDeEmpanelment } from '@/lib/actions/supervisor';

const RED = '#96271E';
const INK_MUTED = '#5F7190';

/**
 * Ending one verifier's empanelment, from their own page.
 *
 * Two deliberate frictions kept from the board this replaced. The grounds are required and must
 * be written out, because this ends somebody's livelihood and the record has to say why in a
 * sentence a person wrote. And the button never appears without the numbers that justify it
 * directly above, so a removal is always read in the context of the rules it answers.
 *
 * The form opens closed. A destructive control sitting permanently open on a page somebody
 * visits to read a caseload is an invitation to a stray click.
 */
export function RemovalCaseForm({
  profileId,
  name,
  recommended,
}: {
  profileId: string;
  name: string;
  /** Either rule is over its line. Changes the wording, never the requirement. */
  recommended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError('');
    startTransition(async () => {
      const res = await confirmDeEmpanelment(profileId, reason);
      if (!res.success) return setError(res.error ?? 'Could not confirm the removal.');
      setOpen(false);
      setReason('');
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded-lg px-4 py-3 text-[13.5px] font-bold text-white"
        style={{ backgroundColor: RED }}
      >
        Start a removal case
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 bg-white p-4" style={{ borderColor: RED }}>
      <p className="text-sm font-bold" style={{ color: RED }}>
        End {name}&apos;s empanelment
      </p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK_MUTED }}>
        {recommended
          ? 'Both the record above and this note are kept. Open desk cases go back to the pool and unstarted visits are reassigned; work already signed off stands.'
          : 'Neither rule is over its line, so this is a removal on other grounds. Say what they are. Open desk cases go back to the pool and unstarted visits are reassigned.'}
      </p>

      <label htmlFor="removal-reason" className="mt-3 block text-xs font-semibold text-gray-700">
        Grounds for removal
      </label>
      <textarea
        id="removal-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="At least a sentence. This is kept on the record."
        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#96271E] focus:outline-none focus:ring-1 focus:ring-[#96271E]"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending || reason.trim().length < 20}
          className="min-h-[44px] rounded-lg px-4 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: RED }}
        >
          {pending ? 'Recording…' : 'Confirm the removal'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-3 text-[13.5px] font-semibold text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
