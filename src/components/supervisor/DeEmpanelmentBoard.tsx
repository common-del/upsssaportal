'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmDeEmpanelment, type DeEmpanelmentCase } from '@/lib/actions/supervisor';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * The de-empanelment case view the brief specifies: the contradiction rate against both the
 * percentage and absolute rules, with the minimum-cases floor visible. The screen recommends
 * and a person confirms; the button never appears without the numbers that justify it sitting
 * directly above.
 */

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm" style={{ color: met ? RED : INK_MUTED }}>
      <span aria-hidden className="mt-0.5 font-bold">
        {met ? '▲' : '·'}
      </span>
      <span className={met ? 'font-bold' : ''}>{children}</span>
    </li>
  );
}

function CaseCard({ item }: { item: DeEmpanelmentCase }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const e = item.evaluation;

  function confirm() {
    setError('');
    startTransition(async () => {
      const res = await confirmDeEmpanelment(item.profileId, reason);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not confirm.');
    });
  }

  return (
    <div
      className="rounded-xl border-2 bg-white p-5"
      style={{ borderColor: item.deEmpanelledAt ? '#D1D5DB' : e.recommended ? RED : '#E5E7EB' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-gray-900">{item.name}</p>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {item.cell === 'FIELD' ? 'Field cell' : 'Online cell'} · empanelled workforce
          </p>
        </div>
        {item.deEmpanelledAt ? (
          <span className="rounded-full bg-[#FBE9E7] px-3 py-1 text-xs font-bold" style={{ color: RED }}>
            De-empanelled {new Date(item.deEmpanelledAt).toLocaleDateString('en-IN')}
          </span>
        ) : e.recommended ? (
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: RED }}>
            Removal recommended
          </span>
        ) : (
          <span className="rounded-full bg-[#E7F5EE] px-3 py-1 text-xs font-bold" style={{ color: GREEN }}>
            In good standing
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {e.auditedCount}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Audited cases
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: e.contradictedCount > 0 ? RED : NAVY_DEEP }}>
            {e.contradictedCount}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Contradicted
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {e.contradictionRatePct === null ? 'n/a' : `${e.contradictionRatePct.toFixed(0)}%`}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Contradiction rate
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        <Rule met={e.rateRule.triggered}>
          Rate rule: at or above {e.rateRule.thresholdPct}% of audited cases contradicted.{' '}
          {e.floorMet
            ? `Floor of ${e.rateRule.minimumCases} audited cases met.`
            : `Not applied: only ${e.auditedCount} of the minimum ${e.rateRule.minimumCases} audited cases.`}
        </Rule>
        <Rule met={e.countRule.triggered}>
          Count rule: {e.rolling12MonthCount} proven contradiction
          {e.rolling12MonthCount === 1 ? '' : 's'} in the rolling 12 months, against a limit of{' '}
          {e.countRule.threshold}.
        </Rule>
      </ul>

      {item.deEmpanelledAt ? (
        item.deEmpanelledReason && (
          <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            {item.deEmpanelledReason}
          </blockquote>
        )
      ) : confirming ? (
        <div className="mt-4 rounded-lg border-2 p-4" style={{ borderColor: RED }}>
          <p className="text-sm font-bold" style={{ color: RED }}>
            Confirm de-empanelment
          </p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            This ends the empanelment, returns open desk cases to the pool and stands the
            verifier down from unstarted visits. Signed-off work stays on record.
          </p>
          <textarea
            value={reason}
            onChange={(e2) => setReason(e2.target.value)}
            rows={3}
            placeholder="The grounds, in full. This is kept on the verifier's record."
            className="mt-2 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: RED }}
            >
              {pending ? 'Recording...' : 'Confirm removal'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border-2 border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {error}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-lg border-2 px-5 py-2.5 text-sm font-bold"
          style={{ borderColor: RED, color: RED }}
        >
          Open a de-empanelment case
        </button>
      )}
    </div>
  );
}

export function DeEmpanelmentBoard({ items }: { items: DeEmpanelmentCase[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
        No empanelled verifiers in your cell. Serving staff are not empanelled, so these rules do
        not apply to them.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((i) => (
        <CaseCard key={i.profileId} item={i} />
      ))}
    </div>
  );
}
