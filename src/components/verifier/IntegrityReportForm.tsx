'use client';

import { useState, useTransition } from 'react';
import { fileIntegrityReport } from '@/lib/actions/audit';

const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * Filing a report of inducement or pressure, from anywhere in the verification workforce.
 * Kept quiet visually: a disclosure control at the foot of a working screen, not a banner,
 * because the person using it may be doing so in the room where the pressure happened.
 */
export function IntegrityReportForm() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [about, setAbout] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    setError('');
    startTransition(async () => {
      const res = await fileIntegrityReport(body, about || undefined);
      if (res.success) {
        setDone(true);
        setBody('');
        setAbout('');
      } else {
        setError(res.error ?? 'Could not file the report.');
      }
    });
  }

  if (done) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-4 text-sm font-semibold" style={{ color: GREEN }}>
        Filed. The Audit Cell and your supervisor can both see it; only the Audit Cell can mark
        it handled.
      </p>
    );
  }

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-bold underline"
          style={{ color: INK_MUTED }}
        >
          Report pressure or an inducement
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-900">Report pressure or an inducement</p>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            If anyone has offered you anything or leaned on you over a verification, record it
            here. It goes to the Audit Cell as well as your supervisor.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What happened: who, where, and what was offered or demanded."
            className="w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
          />
          <input
            type="text"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Portal username of the person involved, if you know it (optional)"
            className="w-full rounded-lg border-2 border-gray-300 p-2.5 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: '#1F3864' }}
            >
              {pending ? 'Filing...' : 'File the report'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700"
            >
              Cancel
            </button>
            {error && (
              <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
