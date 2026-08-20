'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishCensusQueue } from '@/lib/actions/programmeAdmin';

const NAVY = '#1F3864';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * The publish button for the census queue: screened schools not drawn into this year's
 * field cohort, published on the strength of the desk check. Batched, because publication
 * recomputes each school's public Result and 1,75,000 in one request is a job, not a click.
 */
export function PublishControl({ censusQueueCount }: { censusQueueCount: number }) {
  const router = useRouter();
  const [result, setResult] = useState<{ published: number; failed: number; remaining: number; firstErrors: string[] } | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function publish() {
    setError('');
    startTransition(async () => {
      const res = await publishCensusQueue();
      if (res.success) {
        setResult(res);
        router.refresh();
      } else {
        setError(res.error ?? 'Publication failed.');
      }
    });
  }

  if (censusQueueCount === 0 && !result) {
    return (
      <p className="text-sm" style={{ color: INK_MUTED }}>
        The census queue is empty. Schools arrive here after desk screening when they are not
        drawn for a field visit.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={publish}
        disabled={pending || censusQueueCount === 0}
        className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: NAVY }}
      >
        {pending
          ? 'Publishing...'
          : `Publish the next ${Math.min(200, censusQueueCount).toLocaleString('en-IN')} of ${censusQueueCount.toLocaleString('en-IN')}`}
      </button>
      {result && (
        <p role="status" className="text-sm font-semibold" style={{ color: result.failed > 0 ? RED : GREEN }}>
          {result.published.toLocaleString('en-IN')} published
          {result.failed > 0 && `, ${result.failed} refused`}
          {result.remaining > 0 && `, ${result.remaining.toLocaleString('en-IN')} still queued`}.
        </p>
      )}
      {result && result.firstErrors.length > 0 && (
        <ul className="space-y-1">
          {result.firstErrors.map((e, i) => (
            <li key={i} className="text-xs" style={{ color: RED }}>
              {e}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}
