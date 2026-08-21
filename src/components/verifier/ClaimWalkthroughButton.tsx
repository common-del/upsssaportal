'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { claimWalkthrough } from '@/lib/actions/walkthrough';

export function ClaimWalkthroughButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError('');
          startTransition(async () => {
            const res = await claimWalkthrough(runId);
            if (res.success) router.refresh();
            else setError(res.error ?? 'Could not claim.');
          });
        }}
        className="rounded-lg border-2 px-4 py-2 text-sm font-bold disabled:opacity-60"
        style={{ borderColor: '#1F3864', color: '#1F3864' }}
      >
        {pending ? 'Claiming...' : 'Claim'}
      </button>
      {error && (
        <span role="alert" className="text-xs font-semibold text-[#96271E]">
          {error}
        </span>
      )}
    </span>
  );
}
