'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buildAuditSample, claimAuditCase, type AuditOverview, type AuditQueueRow } from '@/lib/actions/audit';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

function CaseRow({ row }: { row: AuditQueueRow }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function claim() {
    setError('');
    startTransition(async () => {
      const res = await claimAuditCase(row.caseId);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not claim.');
    });
  }

  const status = row.reconciledAt
    ? row.contradicted
      ? { text: 'Contradiction', colour: RED }
      : { text: 'Consistent', colour: GREEN }
    : row.submittedAt
      ? { text: 'Awaiting reconciliation', colour: '#7A5209' }
      : row.mine
        ? { text: 'In progress', colour: NAVY }
        : { text: 'Unclaimed', colour: INK_MUTED };

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            {row.schoolName}
          </p>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {row.districtName} · <span className="font-mono text-xs">{row.schoolUdise}</span> ·
            sampled {new Date(row.sampledAt).toLocaleDateString('en-IN')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border-2 px-3 py-1 text-xs font-bold" style={{ borderColor: status.colour, color: status.colour }}>
            {status.text}
          </span>
          {row.mine ? (
            <Link
              href={`/app/audit/${row.caseId}`}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              Open
            </Link>
          ) : (
            !row.submittedAt && (
              <button
                type="button"
                onClick={claim}
                disabled={pending}
                className="rounded-lg border-2 px-4 py-2 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                {pending ? 'Claiming...' : 'Claim'}
              </button>
            )
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function AuditQueueClient({ overview }: { overview: AuditOverview }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function build() {
    setMessage('');
    setError('');
    startTransition(async () => {
      const res = await buildAuditSample();
      if (res.success) {
        setMessage(
          res.created === 0
            ? 'Nothing new to draw. Every eligible verification is already sampled.'
            : `${res.created} case${res.created === 1 ? '' : 's'} drawn into the audit sample.`,
        );
        router.refresh();
      } else {
        setError(res.error ?? 'The draw failed.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
              {overview.candidateCount.toLocaleString('en-IN')} published verification
              {overview.candidateCount === 1 ? '' : 's'} not yet in any sample
            </p>
            <p className="mt-0.5 text-sm" style={{ color: INK_MUTED }}>
              The draw takes {overview.samplePercentage}%{' '}
              {overview.sampleBasis === 'PER_DISTRICT' ? 'per district' : 'statewide'}, seeded on
              the server. Running it twice adds nothing new, and the draw can be re-derived later
              to prove it was not steered.
            </p>
          </div>
          <button
            type="button"
            onClick={build}
            disabled={pending || overview.candidateCount === 0}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: NAVY }}
          >
            {pending ? 'Drawing...' : 'Draw the sample'}
          </button>
        </div>
        {message && (
          <p role="status" className="mt-2 text-sm font-semibold" style={{ color: GREEN }}>
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          My cases ({overview.mine.length})
        </h2>
        {overview.mine.length === 0 ? (
          <p className="text-sm" style={{ color: INK_MUTED }}>
            Claim a case below to begin a blind re-verification.
          </p>
        ) : (
          overview.mine.map((r) => <CaseRow key={r.caseId} row={r} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Unclaimed ({overview.unclaimed.length})
        </h2>
        {overview.unclaimed.length === 0 ? (
          <p className="text-sm" style={{ color: INK_MUTED }}>
            Nothing waiting. Draw the sample when new verifications publish.
          </p>
        ) : (
          overview.unclaimed.map((r) => <CaseRow key={r.caseId} row={r} />)
        )}
      </section>
    </div>
  );
}
