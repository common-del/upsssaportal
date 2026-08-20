'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DeskDecision } from '@prisma/client';
import {
  completeDeskScreening,
  escalateIndicator,
  saveDeskDecision,
  type DeskCase,
  type DeskCaseIndicator,
} from '@/lib/actions/deskScreening';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

/**
 * The indicator review workspace.
 *
 * Split view, per the brief: what the school claimed and what evidence it attached on one side,
 * the decision on the other. AUTO indicators arrive decided by the cross-match and are read-only,
 * so a verifier cannot overrule a government record from here; if they disagree, they escalate.
 *
 * The score is not merely hidden while decisions are outstanding, it is absent. The server does
 * not compute or send it until the last manual indicator is decided, so there is nothing in the
 * page payload to read early. That is what makes the anti-anchoring rule real rather than a
 * matter of what this component chooses to render.
 */

const DECISIONS: { value: DeskDecision; label: string; needsReason: boolean }[] = [
  { value: 'EVIDENCE_SUPPORTS_LEVEL', label: 'Evidence supports the level', needsReason: false },
  { value: 'EVIDENCE_INSUFFICIENT', label: 'Evidence is not enough', needsReason: true },
  { value: 'EVIDENCE_CONTRADICTS_LEVEL', label: 'Evidence contradicts the level', needsReason: true },
  { value: 'EVIDENCE_MISSING', label: 'No evidence attached', needsReason: true },
];

const AUTO_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  MATCH: { bg: '#E7F5EE', fg: '#14603A', label: 'Matches the record' },
  MISMATCH: { bg: '#FBE9E7', fg: '#96271E', label: 'Does not match the record' },
  NOT_CHECKABLE: { bg: '#EDF1F9', fg: NAVY, label: 'No comparable record' },
};

function AutoPanel({ indicator }: { indicator: DeskCaseIndicator }) {
  const style = AUTO_STYLE[indicator.autoOutcome ?? 'NOT_CHECKABLE']!;
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: style.bg }}>
      <p className="text-xs font-bold" style={{ color: style.fg }}>
        {style.label}
      </p>
      <dl className="mt-2 space-y-1 text-xs" style={{ color: style.fg }}>
        {indicator.autoSource && (
          <div className="flex gap-2">
            <dt className="font-semibold">Source</dt>
            <dd>{indicator.autoSource.replace(/_/g, ' ')}</dd>
          </div>
        )}
        {indicator.autoExternalValue !== null && (
          <div className="flex gap-2">
            <dt className="font-semibold">Record says</dt>
            <dd>{indicator.autoExternalValue}</dd>
          </div>
        )}
        {indicator.autoReadAt && (
          <div className="flex gap-2">
            {/* Shown because a bulk reconciliation is stale by construction, and a mismatch
                against a month-old record is a different thing from one against today's. */}
            <dt className="font-semibold">Read on</dt>
            <dd>{new Date(indicator.autoReadAt).toLocaleDateString('en-IN')}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-[11px]" style={{ color: style.fg, opacity: 0.85 }}>
        Checked automatically. If you disagree with the record, escalate rather than overriding it.
      </p>
    </div>
  );
}

function IndicatorRow({
  indicator,
  runId,
  frozen,
  onChanged,
}: {
  indicator: DeskCaseIndicator;
  runId: string;
  frozen: boolean;
  onChanged: () => void;
}) {
  const [decision, setDecision] = useState<DeskDecision | ''>(indicator.decision ?? '');
  const [reason, setReason] = useState(indicator.rationale ?? '');
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const needsReason = DECISIONS.find((d) => d.value === decision)?.needsReason ?? false;

  function save() {
    setError('');
    startTransition(async () => {
      if (!decision) return setError('Choose a decision.');
      const res = await saveDeskDecision(runId, indicator.parameterId, decision, reason);
      if (!res.success) return setError(res.error ?? 'Could not save.');
      setSaved(true);
      onChanged();
    });
  }

  function escalate() {
    setError('');
    startTransition(async () => {
      const res = await escalateIndicator(runId, indicator.parameterId, reason);
      if (!res.success) return setError(res.error ?? 'Could not escalate.');
      setEscalating(false);
      onChanged();
    });
  }

  return (
    <li className="grid gap-4 px-5 py-4 lg:grid-cols-2">
      {/* Left: what the school claimed and what it attached. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs font-semibold" style={{ color: INK_MUTED }}>
            {indicator.code}
          </span>
          <span className="text-sm font-semibold text-gray-900">{indicator.titleEn}</span>
        </div>
        <p className="mt-1 text-xs" style={{ color: INK_MUTED }}>
          {indicator.titleHi}
        </p>

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            The school claims level {indicator.claimedLevel ?? '—'}
          </p>
          {indicator.claimedLabelEn && (
            <p className="mt-1 text-sm leading-relaxed text-gray-800">
              {indicator.claimedLabelEn}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: INK_MUTED }}>
            {indicator.evidenceCount === 0
              ? 'No evidence attached'
              : `${indicator.evidenceCount} evidence ${indicator.evidenceCount === 1 ? 'file' : 'files'} attached`}
          </p>
        </div>
      </div>

      {/* Right: the decision, or the automated result where there is nothing to decide. */}
      <div>
        {indicator.isAuto ? (
          <AutoPanel indicator={indicator} />
        ) : indicator.escalated ? (
          <div className="rounded-lg bg-[#FBE9E7] p-3">
            <p className="text-xs font-bold text-[#96271E]">Escalated to a supervisor</p>
            <p className="mt-1 text-sm text-[#96271E]">{indicator.rationale}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <select
              value={decision}
              disabled={frozen || pending}
              onChange={(e) => {
                setDecision(e.target.value as DeskDecision);
                setSaved(false);
              }}
              aria-label={`Decision for indicator ${indicator.code}`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1F3864] focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
            >
              <option value="">Choose a decision</option>
              {DECISIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            {(needsReason || escalating) && (
              <textarea
                value={reason}
                disabled={frozen || pending}
                onChange={(e) => {
                  setReason(e.target.value);
                  setSaved(false);
                }}
                rows={3}
                placeholder={
                  escalating
                    ? 'What about this indicator cannot be resolved?'
                    : 'Why? This is quoted back to the school if it appeals.'
                }
                aria-label={`Reason for indicator ${indicator.code}`}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1F3864] focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {escalating ? (
                <>
                  <button
                    type="button"
                    onClick={escalate}
                    disabled={pending}
                    className="rounded-lg bg-[#96271E] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Confirm escalation
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscalating(false)}
                    className="text-xs font-semibold"
                    style={{ color: INK_MUTED }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={save}
                    disabled={frozen || pending || !decision}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: NAVY }}
                  >
                    {pending ? 'Saving…' : 'Save decision'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEscalating(true);
                      setReason('');
                    }}
                    disabled={frozen || pending}
                    className="rounded-lg border border-[#96271E] px-3 py-2 text-xs font-bold text-[#96271E] disabled:opacity-60"
                  >
                    Escalate
                  </button>
                  {saved && (
                    <span className="text-xs font-semibold text-[#14603A]">Saved</span>
                  )}
                </>
              )}
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-[#96271E]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function DeskCaseWorkspace({ deskCase }: { deskCase: DeskCase }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [routed, setRouted] = useState<string | null>(null);

  function complete() {
    setError('');
    startTransition(async () => {
      const res = await completeDeskScreening(deskCase.runId);
      if (!res.success) return setError(res.error ?? 'Could not finish the case.');
      setRouted(res.routedTo ?? null);
      router.refresh();
    });
  }

  const byDomain = new Map<string, DeskCaseIndicator[]>();
  for (const i of deskCase.indicators) {
    byDomain.set(i.domainTitleEn, [...(byDomain.get(i.domainTitleEn) ?? []), i]);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
              Case
            </p>
            <p className="font-mono text-lg font-bold" style={{ color: NAVY_DEEP }}>
              {deskCase.school.maskedCode}
            </p>
            <p className="text-xs" style={{ color: INK_MUTED }}>
              {deskCase.school.category}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm tabular-nums" style={{ color: INK_MUTED }}>
              {deskCase.manualDecided} of {deskCase.manualCount} decisions entered
            </p>
            {/* The score, or an explanation of why there is not one yet. Never a placeholder
                number, because a placeholder anchors just as well as a real one. */}
            {deskCase.score ? (
              <div className="mt-2">
                <p className="text-2xl font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                  {deskCase.score.value}
                  <span className="text-sm font-semibold" style={{ color: INK_MUTED }}>
                    {' '}
                    risk · {deskCase.score.band}
                  </span>
                </p>
                <p className="text-xs" style={{ color: INK_MUTED }}>
                  {deskCase.score.aboveThreshold
                    ? 'Above the threshold, so this goes to a video walkthrough.'
                    : 'Below the threshold, so this joins the census queue.'}
                </p>
              </div>
            ) : (
              <p className="mt-2 max-w-xs text-xs" style={{ color: INK_MUTED }}>
                The risk score appears once all {deskCase.remainingDecisions} remaining decisions
                are entered. It is withheld so it cannot influence them.
              </p>
            )}
          </div>
        </div>

        {deskCase.score?.basisFallbackReason && (
          <p className="mt-3 rounded-lg bg-[#FBF1DE] px-3 py-2 text-xs text-[#7A5209]">
            {deskCase.score.basisFallbackReason}
          </p>
        )}

        {deskCase.frozen && (
          <p className="mt-3 rounded-lg bg-[#FBE9E7] px-3 py-2 text-xs font-semibold text-[#96271E]">
            This case is escalated and frozen. A supervisor has to resolve it before it can be
            routed.
          </p>
        )}

        {routed && (
          <p className="mt-3 rounded-lg bg-[#E7F5EE] px-3 py-2 text-xs font-semibold text-[#14603A]">
            Case finished and routed to {routed.replace(/_/g, ' ').toLowerCase()}.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={complete}
            disabled={pending || deskCase.remainingDecisions > 0 || deskCase.frozen || routed !== null}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: NAVY }}
          >
            {pending ? 'Finishing…' : 'Finish and route this case'}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-[#96271E]">
              {error}
            </p>
          )}
        </div>
      </section>

      {[...byDomain.entries()].map(([domain, indicators]) => (
        <section
          key={domain}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="px-5 py-3" style={{ backgroundColor: NAVY }}>
            <h2 className="text-sm font-bold text-white">{domain}</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {indicators.map((i) => (
              <IndicatorRow
                key={i.parameterId}
                indicator={i}
                runId={deskCase.runId}
                frozen={deskCase.frozen}
                onChanged={() => router.refresh()}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
