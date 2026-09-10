'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveEscalation } from '@/lib/actions/supervisor';
import type { DeskDecision } from '@prisma/client';
import type {
  AppealDecision,
  DecisionRow,
  DecisionsInboxData,
  DiscrepancyDecision,
  EscalationDecision,
} from '@/lib/sssa/decisionsInbox';

/**
 * The Decisions inbox, in two modes.
 *
 * Focus is the default: the page deals the longest-waiting ruling with everything
 * needed to act on it, and a progress bar stands in for the rest. Chosen over the
 * list after SSSA found twenty-two simultaneous cards overwhelming — one decision
 * at a time cannot overwhelm. Skip sends a case to the back of this sitting's line
 * (client state only: reload and the queue is honest again).
 *
 * The list stays one toggle away for the overview jobs focus mode is bad at:
 * scanning, jumping, batching a type. Escalations rule inline in both modes;
 * appeals and discrepancy cases open their existing screens.
 */

const APPEAL = '#B3271D';
const ESCALATION = '#1F3864';
const DISCREPANCY = '#B8791A';
const DISCREPANCY_INK = '#9A6410';
const NAVY_DEEP = '#073763';
const NAVY = '#1B2A6B';

const inr = (n: number) => n.toLocaleString('en-IN');
const waitClass = (d: number) => (d >= 14 ? 'text-[#B3271D]' : d >= 7 ? 'text-[#9A6410]' : 'text-gray-500');

export type DecisionsFilter = 'all' | 'appeals' | 'escalations' | 'discrepancies';
export type DecisionsView = 'focus' | 'list';

const KIND_OF: Record<Exclude<DecisionsFilter, 'all'>, DecisionRow['kind']> = {
  appeals: 'APPEAL',
  escalations: 'ESCALATION',
  discrepancies: 'DISCREPANCY',
};

function writeUrl(filter: DecisionsFilter, view: DecisionsView) {
  // Kept in the URL so Back, reload and shared links land on the same slice and mode.
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('type', filter);
  if (view !== 'focus') params.set('view', view);
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

const RULINGS: { value: DeskDecision; label: string }[] = [
  { value: 'EVIDENCE_SUPPORTS_LEVEL', label: 'Evidence supports the claimed level' },
  { value: 'EVIDENCE_INSUFFICIENT', label: 'Evidence insufficient' },
  { value: 'EVIDENCE_CONTRADICTS_LEVEL', label: 'Evidence contradicts the claim' },
  { value: 'EVIDENCE_MISSING', label: 'Evidence missing' },
];

/** The inline four-option ruling, shared by the focus card and the list row. */
function EscalationRulingForm({ row }: { row: EscalationDecision }) {
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
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {RULINGS.map((d) => (
          <label
            key={d.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2.5 text-[12px] font-semibold"
            style={{
              borderColor: decision === d.value ? ESCALATION : '#E5E7EB',
              backgroundColor: decision === d.value ? '#EEF2F9' : 'white',
              color: NAVY_DEEP,
            }}
          >
            <input
              type="radio"
              name={`ruling-${row.runId}-${row.parameterId}`}
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
        className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-[12.5px]"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={rule}
          disabled={pending}
          className="rounded-lg px-5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: ESCALATION }}
        >
          {pending ? 'Recording...' : 'Rule and unfreeze the case'}
        </button>
        {error && (
          <p role="alert" className="text-[12.5px] font-semibold" style={{ color: APPEAL }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus mode
// ─────────────────────────────────────────────────────────────────────────────

function FocusQuote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-800">
      <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
    </blockquote>
  );
}

function SkipButton({ onSkip, remaining }: { onSkip: () => void; remaining: number }) {
  if (remaining <= 1) return null;
  return (
    <button
      type="button"
      onClick={onSkip}
      className="rounded-lg border-2 border-gray-300 px-4 py-2 text-[12.5px] font-bold text-gray-600 hover:bg-gray-50"
    >
      Skip for now
    </button>
  );
}

function FocusCard({ row, onSkip, remaining }: { row: DecisionRow; onSkip: () => void; remaining: number }) {
  if (row.kind === 'APPEAL') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5" style={{ borderLeft: `4px solid ${APPEAL}` }}>
        <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: APPEAL }}>
          Appeal · filed by the school · an upheld appeal changes the published score
        </p>
        <p className="mt-1.5 text-[20px] font-extrabold tabular-nums text-gray-900">
          {row.selfScore != null ? row.selfScore.toFixed(1) : '—'} {row.selfBand ?? ''}{' '}
          <span className="font-normal text-gray-400">self →</span>{' '}
          <span style={{ color: APPEAL }}>
            {row.verifiedScore != null ? row.verifiedScore.toFixed(1) : '—'} {row.verifiedBand ?? ''}
          </span>{' '}
          <span className="font-normal text-gray-400">verified</span>
        </p>
        <p className="mt-1 text-[12.5px] text-gray-500">
          {row.school} · {row.district}
          {row.verifierName ? ` · verification signed off by ${row.verifierName}` : ''} ·{' '}
          {inr(row.contested)} indicator{row.contested === 1 ? '' : 's'} contested
        </p>
        {row.grounds && <FocusQuote label="The school's grounds">{row.grounds}</FocusQuote>}
        <div className="mt-4 flex items-center gap-2.5">
          <Link
            href={`/app/sssa/finalization/appeal/${row.udise}`}
            className="rounded-lg px-5 py-2 text-[12.5px] font-bold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Open the appeal
          </Link>
          <SkipButton onSkip={onSkip} remaining={remaining} />
        </div>
      </div>
    );
  }

  if (row.kind === 'DISCREPANCY') {
    const response =
      row.response === 'RESPONDED'
        ? row.respondedDaysAgo === 0
          ? 'The school responded today.'
          : `The school responded ${row.respondedDaysAgo} day${row.respondedDaysAgo === 1 ? '' : 's'} ago.`
        : row.response === 'WINDOW_OPEN'
          ? `The school's response window is open, ${row.windowDaysLeft} day${row.windowDaysLeft === 1 ? '' : 's'} left.`
          : row.response === 'WINDOW_CLOSED'
            ? 'No response from the school; the window has closed.'
            : 'The response window has not been opened yet.';
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5" style={{ borderLeft: `4px solid ${DISCREPANCY}` }}>
        <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: DISCREPANCY_INK }}>
          Discrepancy · opened by the system · blocks publication until ruled
        </p>
        <p className="mt-1.5 text-[20px] font-extrabold tabular-nums text-gray-900">
          <span style={{ color: DISCREPANCY_INK }}>
            {inr(row.found)}
            {row.checked != null ? ` of ${inr(row.checked)}` : ''}
          </span>{' '}
          indicators found below the claim
        </p>
        <p className="mt-1 text-[12.5px] text-gray-500">
          {row.school} · {row.district}
          {row.fieldVerifierName ? ` · field visit signed off by ${row.fieldVerifierName}` : ''}
        </p>
        <p className="mt-2 text-[12.5px] font-semibold text-gray-700">{response}</p>
        <div className="mt-4 flex items-center gap-2.5">
          <Link
            href={`/app/sssa/discrepancies/${row.runId}`}
            className="rounded-lg px-5 py-2 text-[12.5px] font-bold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Open the case
          </Link>
          <SkipButton onSkip={onSkip} remaining={remaining} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5" style={{ borderLeft: `4px solid ${ESCALATION}` }}>
      <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: ESCALATION }}>
        Escalation · raised by your verifier · your ruling unfreezes the case
      </p>
      <p className="mt-1.5 text-[17px] font-extrabold text-gray-900">
        <span className="mr-2 font-mono text-[13px]" style={{ color: ESCALATION }}>
          {row.parameterCode}
        </span>
        {row.parameterTitle}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-gray-500">
        <span>
          Screening {row.school} · {row.district} · raised by {row.verifierName}
        </span>
        {row.claimedLevel !== null && (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white" style={{ backgroundColor: ESCALATION }}>
            Claimed Level {row.claimedLevel}
          </span>
        )}
      </p>
      {row.rationale && <FocusQuote label={`Why ${row.verifierName} could not rule`}>{row.rationale}</FocusQuote>}
      <div className="mt-4">
        <EscalationRulingForm row={row} />
        <div className="mt-2.5">
          <SkipButton onSkip={onSkip} remaining={remaining} />
        </div>
      </div>
    </div>
  );
}

function shortLabel(row: DecisionRow): string {
  if (row.kind === 'APPEAL') return `${row.school} appeal`;
  if (row.kind === 'DISCREPANCY') return `${row.school} discrepancy`;
  return `indicator ${row.parameterCode} escalation`;
}

function FocusMode({ rows }: { rows: DecisionRow[] }) {
  // Skipped keys go to the back of this sitting's line. Client state on purpose:
  // nothing about the queue itself changes, and a reload deals worst-first again.
  const [skipped, setSkipped] = useState<string[]>([]);

  const ordered = useMemo(() => {
    const rank = new Map(skipped.map((k, i) => [k, i]));
    const fresh = rows.filter((r) => !rank.has(r.key));
    const deferred = rows.filter((r) => rank.has(r.key)).sort((a, b) => rank.get(a.key)! - rank.get(b.key)!);
    return [...fresh, ...deferred];
  }, [rows, skipped]);

  const current = ordered[0];
  if (!current) return null;

  const position = rows.length - ordered.length + 1;
  const upNext = ordered.slice(1, 3);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-extrabold tabular-nums text-gray-900">
          {inr(position)} of {inr(rows.length)}
        </span>
        <span
          className="h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={rows.length}
          aria-valuenow={position}
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(4, Math.round((position / rows.length) * 100))}%`, backgroundColor: NAVY }}
          />
        </span>
        <span className={`text-[12px] font-bold tabular-nums ${waitClass(current.waitingDays)}`}>
          {current.waitingDays} day{current.waitingDays === 1 ? '' : 's'} waiting
        </span>
      </div>

      <FocusCard
        row={current}
        remaining={ordered.length}
        onSkip={() => setSkipped((s) => [...s.filter((k) => k !== current.key), current.key])}
      />

      {upNext.length > 0 && (
        <p className="text-[12px] text-gray-400">
          Next: {upNext.map((r) => `${shortLabel(r)}, ${r.waitingDays} day${r.waitingDays === 1 ? '' : 's'}`).join(' · ')}
          {ordered.length > 3 && ` · ${inr(ordered.length - 3)} more behind them`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List mode (the original inbox rows)
// ─────────────────────────────────────────────────────────────────────────────

function TypeChip({ kind }: { kind: DecisionRow['kind'] }) {
  const spec =
    kind === 'APPEAL'
      ? { colour: APPEAL, label: 'Appeal', consequence: 'changes a published score' }
      : kind === 'ESCALATION'
        ? { colour: ESCALATION, label: 'Escalation', consequence: 'freezes its case' }
        : { colour: DISCREPANCY, label: 'Discrepancy', consequence: 'blocks publication' };
  return (
    <span
      className="w-[104px] shrink-0 rounded-md py-1 text-center text-white"
      style={{ backgroundColor: spec.colour }}
    >
      <span className="block text-[9.5px] font-extrabold uppercase tracking-wider">{spec.label}</span>
      <span className="block text-[8.5px] font-semibold opacity-80">{spec.consequence}</span>
    </span>
  );
}

function FromLine({ colour, label, children }: { colour: string; label: string; children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[12.5px] text-gray-700">
      <span className="mr-1.5 text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: colour }}>
        {label}
      </span>
      {children}
    </p>
  );
}

function Score({ value, band }: { value: number | null; band: string | null }) {
  if (value == null) return <>—</>;
  return (
    <>
      {value.toFixed(1)}
      {band ? ` ${band}` : ''}
    </>
  );
}

function AppealRow({ row }: { row: AppealDecision }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4" style={{ borderLeft: `4px solid ${APPEAL}` }}>
      <TypeChip kind="APPEAL" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold tabular-nums text-gray-900">
          <Score value={row.selfScore} band={row.selfBand} />
          <span className="mx-1.5 font-normal text-gray-400">self →</span>
          <span style={{ color: APPEAL }}>
            <Score value={row.verifiedScore} band={row.verifiedBand} />
          </span>
          <span className="ml-1.5 font-normal text-gray-400">verified</span>
          <span className="ml-2 text-[11.5px] font-semibold text-gray-500">
            {inr(row.contested)} indicator{row.contested === 1 ? '' : 's'} contested
          </span>
        </p>
        <FromLine colour={APPEAL} label="Filed by the school">
          {row.school} contests the verification
          {row.verifierName ? ` signed off by ${row.verifierName}` : ''}
        </FromLine>
        <p className="mt-1 text-[12px] text-gray-500">
          {[row.district, row.block ? `${row.block} block` : ''].filter(Boolean).join(' · ')} · written grounds on the appeal
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={`text-[11.5px] font-bold tabular-nums ${waitClass(row.waitingDays)}`}>
          {row.waitingDays} day{row.waitingDays === 1 ? '' : 's'}
        </span>
        <Link
          href={`/app/sssa/finalization/appeal/${row.udise}`}
          className="rounded-lg border-2 px-4 py-1.5 text-[12px] font-bold"
          style={{ borderColor: NAVY_DEEP, color: NAVY_DEEP }}
        >
          Decide
        </Link>
      </div>
    </div>
  );
}

function DiscrepancyRow({ row }: { row: DiscrepancyDecision }) {
  const response =
    row.response === 'RESPONDED'
      ? {
          cls: 'bg-emerald-50 text-emerald-800',
          text:
            row.respondedDaysAgo === 0
              ? 'School responded today'
              : `School responded ${row.respondedDaysAgo} day${row.respondedDaysAgo === 1 ? '' : 's'} ago`,
        }
      : row.response === 'WINDOW_OPEN'
        ? { cls: 'bg-amber-50 text-amber-800', text: `Response window open, ${row.windowDaysLeft} day${row.windowDaysLeft === 1 ? '' : 's'} left` }
        : row.response === 'WINDOW_CLOSED'
          ? { cls: 'bg-gray-100 text-gray-600', text: 'No response, window closed' }
          : { cls: 'bg-gray-100 text-gray-600', text: 'Response window not opened yet' };

  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4" style={{ borderLeft: `4px solid ${DISCREPANCY}` }}>
      <TypeChip kind="DISCREPANCY" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold tabular-nums text-gray-900">
          <span style={{ color: DISCREPANCY_INK }}>
            {inr(row.found)}
            {row.checked != null ? ` of ${inr(row.checked)}` : ''}
          </span>{' '}
          indicator{row.found === 1 && row.checked == null ? '' : 's'} found below the claim
        </p>
        <FromLine colour={DISCREPANCY_INK} label="Opened by the system">
          {row.fieldVerifierName
            ? `${row.fieldVerifierName}'s signed-off field visit differs from what the school declared`
            : 'The signed-off field visit differs from what the school declared'}
        </FromLine>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
          <span>
            {row.school} · {row.district}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${response.cls}`}>{response.text}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={`text-[11.5px] font-bold tabular-nums ${waitClass(row.waitingDays)}`}>
          {row.waitingDays} day{row.waitingDays === 1 ? '' : 's'}
        </span>
        <Link
          href={`/app/sssa/discrepancies/${row.runId}`}
          className="rounded-lg border-2 px-4 py-1.5 text-[12px] font-bold"
          style={{ borderColor: NAVY_DEEP, color: NAVY_DEEP }}
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function EscalationRow({ row }: { row: EscalationDecision }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4" style={{ borderLeft: `4px solid ${ESCALATION}` }}>
      <div className="flex items-start gap-4">
        <TypeChip kind="ESCALATION" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-gray-900">
            <span className="mr-2 font-mono text-[12px] font-bold" style={{ color: ESCALATION }}>
              {row.parameterCode}
            </span>
            {row.parameterTitle}
          </p>
          <FromLine colour={ESCALATION} label="Raised by your verifier">
            {row.verifierName}, Online Verifier, cannot rule on this indicator from the evidence
          </FromLine>
          <p className="mt-1 text-[12px] text-gray-500">
            Screening {row.school} · {row.district}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`text-[11.5px] font-bold tabular-nums ${waitClass(row.waitingDays)}`}>
            {row.waitingDays} day{row.waitingDays === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="rounded-lg border-2 px-4 py-1.5 text-[12px] font-bold"
            style={{ borderColor: NAVY_DEEP, color: NAVY_DEEP }}
          >
            {open ? 'Close' : 'Rule'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {row.claimedLevel !== null && (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: ESCALATION }}>
                Claimed Level {row.claimedLevel}
              </span>
            )}
          </div>
          {row.rationale && (
            <blockquote className="mt-2 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-800">{row.rationale}</blockquote>
          )}
          <div className="mt-3">
            <EscalationRulingForm row={row} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The shell: filter chips, mode toggle, legend
// ─────────────────────────────────────────────────────────────────────────────

export function DecisionsInbox({
  data,
  initialFilter = 'all',
  initialView = 'focus',
}: {
  data: DecisionsInboxData;
  /** From ?type= so the old pages' redirects land on their own slice. */
  initialFilter?: DecisionsFilter;
  /** From ?view=; focus is the default experience. */
  initialView?: DecisionsView;
}) {
  const [filter, setFilter] = useState<DecisionsFilter>(initialFilter);
  const [view, setView] = useState<DecisionsView>(initialView);

  const rows = useMemo(
    () => (filter === 'all' ? data.rows : data.rows.filter((r) => r.kind === KIND_OF[filter])),
    [data.rows, filter],
  );

  const chips: { id: DecisionsFilter; label: string; count: number; colour?: string }[] = [
    { id: 'all', label: 'All', count: data.counts.total },
    { id: 'appeals', label: 'Appeals', count: data.counts.appeals, colour: APPEAL },
    { id: 'escalations', label: 'Escalations', count: data.counts.escalations, colour: ESCALATION },
    { id: 'discrepancies', label: 'Discrepancies', count: data.counts.discrepancies, colour: DISCREPANCY_INK },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const on = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setFilter(c.id);
                writeUrl(c.id, view);
              }}
              aria-pressed={on}
              className={`rounded-full border-2 px-3.5 py-1 text-[12px] font-bold ${
                on ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
              style={!on && c.colour ? { color: c.colour } : undefined}
            >
              {c.label} <span className="tabular-nums opacity-75">{inr(c.count)}</span>
            </button>
          );
        })}
        <span className="ml-auto inline-flex overflow-hidden rounded-full border border-gray-300">
          {(
            [
              { id: 'focus', label: 'One at a time' },
              { id: 'list', label: 'Full list' },
            ] as const
          ).map((m, i) => {
            const on = view === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setView(m.id);
                  writeUrl(filter, m.id);
                }}
                aria-pressed={on}
                className={`whitespace-nowrap px-3 py-1.5 text-[12px] font-bold ${
                  i > 0 ? 'border-l border-gray-300' : ''
                } ${on ? 'bg-[#1B2A6B] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {m.label}
              </button>
            );
          })}
        </span>
      </div>

      <p className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-gray-500">
        <span>
          <b className="font-extrabold" style={{ color: APPEAL }}>Appeals</b> are filed by schools
        </span>
        <span>
          <b className="font-extrabold" style={{ color: ESCALATION }}>Escalations</b> are raised by your online verifiers
        </span>
        <span>
          <b className="font-extrabold" style={{ color: DISCREPANCY_INK }}>Discrepancies</b> are opened by the system when a field visit differs from the school&apos;s claim
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
          {filter === 'all' ? 'Nothing is waiting on you. Every case is moving.' : 'Nothing of this kind is waiting.'}
        </p>
      ) : view === 'focus' ? (
        <FocusMode key={filter} rows={rows} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) =>
            r.kind === 'APPEAL' ? (
              <AppealRow key={r.key} row={r} />
            ) : r.kind === 'ESCALATION' ? (
              <EscalationRow key={r.key} row={r} />
            ) : (
              <DiscrepancyRow key={r.key} row={r} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
