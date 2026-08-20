'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buildCohort, type BuildResult } from '@/lib/actions/cohort';

const NAVY = '#1F3864';
const INK_MUTED = '#5F7190';

/**
 * Commit the cohort.
 *
 * Behind a typed confirmation because this is not reversible from the interface: it creates a
 * field visit per school and moves every selected run out of the census queue. A misclick here
 * is a state-wide inspection schedule.
 */
export function CohortBuildForm({ selectedCount }: { selectedCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<BuildResult | null>(null);

  const ready = start !== '' && end !== '' && confirm.trim().toUpperCase() === 'BUILD';

  function submit() {
    setError('');
    startTransition(async () => {
      const res = await buildCohort(start, end);
      if (!res.success) return setError(res.error ?? 'Could not build the cohort.');
      setResult(res);
      setConfirm('');
      router.refresh();
    });
  }

  const input =
    'mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1F3864] focus:outline-none focus:ring-1 focus:ring-[#1F3864]';
  const label = 'block text-xs font-semibold text-gray-700';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Build this year&apos;s cohort</h2>
      <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
        Inspection dates are spread across the window rather than all set to its first day. Each
        school&apos;s reveal moment is fixed at build time from its own date, so changing the reveal
        hour later will not move a reveal a verifier has already been told about.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="windowStart">
            Travel window starts
          </label>
          <input
            id="windowStart"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label} htmlFor="windowEnd">
            Travel window ends
          </label>
          <input
            id="windowEnd"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className={label} htmlFor="confirm">
          Type BUILD to confirm {selectedCount.toLocaleString('en-IN')} visits
        </label>
        <input
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="BUILD"
          className={input}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-[#96271E]">
          {error}
        </p>
      )}

      {result?.success && (
        <div className="mt-3 space-y-1 rounded-lg bg-[#E7F5EE] px-3 py-2.5 text-sm text-[#14603A]">
          <p className="font-semibold">
            {result.visitsCreated?.toLocaleString('en-IN')} visits created.
          </p>
          {/* Reported rather than hidden: a school in the cohort with nobody allocated is a
              staffing gap, and it is better seen here than discovered on the inspection date. */}
          {(result.unassigned ?? 0) > 0 && (
            <p>
              {result.unassigned?.toLocaleString('en-IN')} selected schools have no eligible
              verifier and need allocating by hand.
            </p>
          )}
          {(result.excludedSkips ?? 0) > 0 && (
            <p>
              {result.excludedSkips?.toLocaleString('en-IN')} had every candidate verifier ruled out
              by a district roster or a conflict-of-interest exclusion.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || pending}
        className="mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: NAVY }}
      >
        {pending ? 'Building…' : 'Build cohort'}
      </button>
    </section>
  );
}
