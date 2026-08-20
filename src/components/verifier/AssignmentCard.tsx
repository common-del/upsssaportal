'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { declareConflict } from '@/lib/actions/cohort';
import type { Assignment } from '@/lib/verification/reveal';

/**
 * A field verifier's assignment, sealed or revealed.
 *
 * Gold throughout, per the brief's visual system: gold is the field track, navy is the desk. A
 * verifier glancing at a screen should be able to tell which half of the system they are in
 * without reading a word.
 *
 * The sealed card cannot show the school because the school is not in its props. There is no
 * conditional hiding here and no place to add one: `Assignment` is a union, and the sealed
 * member has no school fields to render.
 */

const GOLD = '#BF9000';
const GOLD_TINT = '#D0AD42';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SealedCard({ assignment }: { assignment: Assignment & { state: 'SEALED' } }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 bg-white shadow-sm" style={{ borderColor: GOLD_TINT }}>
      <div className="px-5 py-3" style={{ backgroundColor: GOLD }}>
        <p className="text-sm font-bold text-white">Not yet revealed</p>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            District
          </p>
          <p className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
            {assignment.districtName}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
              Travel window
            </p>
            <p className="text-sm text-gray-800">
              {formatDate(assignment.travelWindowStart)} to {formatDate(assignment.travelWindowEnd)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
              Inspection date
            </p>
            <p className="text-sm text-gray-800">{formatDate(assignment.notifiedDate)}</p>
          </div>
        </div>
        <div className="rounded-lg p-3" style={{ backgroundColor: '#FBF1DE' }}>
          <p className="text-sm font-semibold" style={{ color: '#7A5209' }}>
            The school unlocks at {formatDateTime(assignment.revealAt)}
          </p>
          <p className="mt-1 text-xs" style={{ color: '#7A5209' }}>
            Which school you are visiting is not held on this device before then. Travel to the
            district and open this card on the morning of the inspection.
          </p>
        </div>
      </div>
    </div>
  );
}

function RevealedCard({ assignment }: { assignment: Assignment & { state: 'REVEALED' } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const needsDeclaration = assignment.conflictDeclaredAt === null;

  function declare(hasConflict: boolean) {
    setError('');
    startTransition(async () => {
      const res = await declareConflict(assignment.visitId, hasConflict);
      if (!res.success) return setError(res.error ?? 'Could not record your answer.');
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 bg-white shadow-sm" style={{ borderColor: GOLD }}>
      <div className="px-5 py-3" style={{ backgroundColor: GOLD }}>
        <p className="text-sm font-bold text-white">Revealed · visit today</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-xl font-bold" style={{ color: NAVY_DEEP }}>
            {assignment.schoolName}
          </p>
          <p className="mt-1 font-mono text-xs" style={{ color: INK_MUTED }}>
            {assignment.schoolUdise}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            {assignment.blockName}, {assignment.districtName}
          </p>
          {assignment.addressEn && (
            <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
              {assignment.addressEn}
            </p>
          )}
        </div>

        {/* The declaration is asked at the moment of reveal, because until now the verifier could
            not know whether they had a connection to this school. */}
        {needsDeclaration ? (
          <div className="rounded-lg border-2 p-4" style={{ borderColor: GOLD_TINT, backgroundColor: '#FDF8EC' }}>
            <p className="text-sm font-bold" style={{ color: '#7A5209' }}>
              Before you begin
            </p>
            <p className="mt-1 text-sm" style={{ color: '#7A5209' }}>
              Do you have any personal, family or professional connection to this school, or have
              you held a position here or in this cluster?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => declare(false)}
                disabled={pending}
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: GOLD }}
              >
                No connection, begin the visit
              </button>
              <button
                type="button"
                onClick={() => declare(true)}
                disabled={pending}
                className="rounded-lg border-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: '#96271E', color: '#96271E' }}
              >
                I have a connection, reassign this
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-[#96271E]">
                {error}
              </p>
            )}
          </div>
        ) : assignment.recusedAt ? (
          <p className="rounded-lg bg-[#FBE9E7] px-3 py-2 text-sm font-semibold text-[#96271E]">
            You stood down from this visit. It is waiting to be reassigned.
          </p>
        ) : (
          <p className="rounded-lg bg-[#E7F5EE] px-3 py-2 text-sm font-semibold text-[#14603A]">
            No conflict declared. You may begin the visit.
          </p>
        )}
      </div>
    </div>
  );
}

export function AssignmentCard({ assignment }: { assignment: Assignment }) {
  return assignment.state === 'SEALED' ? (
    <SealedCard assignment={assignment} />
  ) : (
    <RevealedCard assignment={assignment} />
  );
}
