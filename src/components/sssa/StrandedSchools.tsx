'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reallocateSchool, type StrandedSchool } from '@/lib/actions/reallocation';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GOLD_INK = '#7A5209';
const RED = '#96271E';

/**
 * Schools in the cohort with nobody going to them.
 *
 * This panel is the visible half of the reallocation fix. A verifier standing down at the reveal
 * now hands the visit straight on, so most recusals never reach this list; what does reach it is
 * the case the automatic rule cannot solve, which is a district where everybody eligible has
 * already stood down or nobody is empanelled at all. That is a staffing decision, and it belongs
 * in front of a person rather than in a retry loop.
 *
 * Each row carries its own choice of verifier rather than one control for the whole list, because
 * eligibility is per school: the person who may take a school in Sitapur is not on the list for a
 * school in Sonbhadra, and a single picker above the table would have to lie about that.
 */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({ row }: { row: StrandedSchool }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  function send(profileId?: string) {
    setError('');
    setNote('');
    startTransition(async () => {
      const res = await reallocateSchool(row.runId, profileId);
      if (!res.success) return setError(res.error ?? 'Could not reallocate this school.');
      setNote(
        res.outsideWindow
          ? 'Sent. The date falls after the travel window closes.'
          : 'Sent.',
      );
      router.refresh();
    });
  }

  const none = row.options.length === 0;

  return (
    <div className="border-b border-gray-100 px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-snug" style={{ color: NAVY_DEEP }}>
            {row.schoolName}
          </p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: INK_MUTED }}>
            <span className="font-mono">{row.udise}</span> · {row.blockName}, {row.districtName}
          </p>
        </div>
        <p className="text-[12.5px] font-semibold" style={{ color: GOLD_INK }}>
          {row.reason === 'STOOD_DOWN'
            ? `${row.stoodDownBy ?? 'The verifier'} stood down${row.stoodDownAt ? ` on ${formatDate(row.stoodDownAt)}` : ''}`
            : 'Nobody was eligible at the draw'}
        </p>
      </div>

      {none ? (
        <p className="mt-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold" style={{ backgroundColor: '#FBE9E7', color: RED }}>
          Nobody is eligible for this school. Empanel a field verifier for {row.districtName}, or lift
          an exclusion, and it can be sent from here.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2.5">
          <span className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor={`who-${row.runId}`}
              className="text-[10px] font-bold uppercase tracking-wider text-gray-400"
            >
              Send instead
            </label>
            <select
              id={`who-${row.runId}`}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="rounded-lg border px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1"
              style={{ borderColor: '#D6DCE7', color: '#3C4A61' }}
            >
              <option value="">Whoever is carrying least</option>
              {row.options.map((o) => (
                <option key={o.profileId} value={o.profileId}>
                  {o.name} ({o.openVisits} open)
                </option>
              ))}
            </select>
          </span>
          <button
            type="button"
            onClick={() => send(choice === '' ? undefined : choice)}
            disabled={pending}
            className="min-h-[40px] rounded-lg px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: NAVY }}
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
          <span className="pb-2 text-[12px]" style={{ color: INK_MUTED }}>
            The new verifier is told tomorrow at the earliest, and sees the school on the morning of
            the visit as usual.
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
      {note && (
        <p className="mt-2 text-[13px] font-semibold" style={{ color: '#14603A' }}>
          {note}
        </p>
      )}
    </div>
  );
}

export function StrandedSchools({ rows }: { rows: StrandedSchool[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ backgroundColor: GOLD }}>
        <h2 className="text-sm font-bold text-white">Schools in the cohort with nobody going to them</h2>
        <span className="text-xs text-white/90">
          {rows.length.toLocaleString('en-IN')} {rows.length === 1 ? 'school' : 'schools'}
        </span>
      </div>
      {rows.map((row) => (
        <Row key={row.runId} row={row} />
      ))}
    </section>
  );
}
