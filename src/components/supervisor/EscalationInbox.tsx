'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveEscalation, type EscalationRow } from '@/lib/actions/supervisor';
import type { DeskDecision } from '@prisma/client';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';

/**
 * The escalation inbox. An escalated indicator froze its whole case, so every card here is a
 * school whose screening cannot finish until the supervisor rules. The ruling picks the desk
 * decision the verifier could not, with a written reason the verifier reads back on the case.
 */

const DECISIONS: { value: DeskDecision; label: string }[] = [
  { value: 'EVIDENCE_SUPPORTS_LEVEL', label: 'Evidence supports the claimed level' },
  { value: 'EVIDENCE_INSUFFICIENT', label: 'Evidence insufficient' },
  { value: 'EVIDENCE_CONTRADICTS_LEVEL', label: 'Evidence contradicts the claim' },
  { value: 'EVIDENCE_MISSING', label: 'Evidence missing' },
];

function EscalationCard({ row }: { row: EscalationRow }) {
  const router = useRouter();
  const [decision, setDecision] = useState<DeskDecision>('EVIDENCE_INSUFFICIENT');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function rule() {
    setError('');
    startTransition(async () => {
      const res = await resolveEscalation(row.runId, row.parameterId, decision, note);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not record the ruling.');
    });
  }

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
            {row.parameterCode}
          </p>
          <p className="text-base font-bold text-gray-900">{row.parameterTitle}</p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            {row.schoolName} · {row.districtName} · escalated by {row.verifierName}
            {row.escalatedAt && ` on ${new Date(row.escalatedAt).toLocaleDateString('en-IN')}`}
          </p>
        </div>
        {row.claimedLevel !== null && (
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: NAVY }}>
            Claimed Level {row.claimedLevel}
          </span>
        )}
      </div>

      {row.rationale && (
        <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
          {row.rationale}
        </blockquote>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {DECISIONS.map((d) => (
          <label
            key={d.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2.5 text-sm font-semibold"
            style={{
              borderColor: decision === d.value ? NAVY : '#E5E7EB',
              backgroundColor: decision === d.value ? '#EEF2F9' : 'white',
              color: NAVY_DEEP,
            }}
          >
            <input
              type="radio"
              name={`decision-${row.runId}-${row.parameterId}`}
              checked={decision === d.value}
              onChange={() => setDecision(d.value)}
            />
            {d.label}
          </label>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Your ruling, in words the verifier can apply next time this comes up."
        className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={rule}
          disabled={pending}
          className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: NAVY }}
        >
          {pending ? 'Recording...' : 'Rule and unfreeze the case'}
        </button>
        {error && (
          <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function EscalationInbox({ rows }: { rows: EscalationRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
        Nothing is escalated. Every desk case is moving.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <EscalationCard key={`${r.runId}:${r.parameterId}`} row={r} />
      ))}
    </div>
  );
}
