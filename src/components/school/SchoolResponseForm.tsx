'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSchoolResponse } from '@/lib/actions/schoolResponse';

const NAVY = '#1F3864';
const RED = '#96271E';

export function SchoolResponseForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    setError('');
    startTransition(async () => {
      const res = await submitSchoolResponse(runId, body);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not submit your response.');
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Your written response. Name each indicator you dispute, say what the position on the ground actually is, and point to the evidence for it. Upload any supporting documents in the Evidence Manager and refer to them here by name."
        className="w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: NAVY }}
        >
          {pending ? 'Submitting...' : 'Submit the response'}
        </button>
        <p className="text-xs text-gray-600">
          One response per verification. It goes to the supervisor before anything is published.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}
