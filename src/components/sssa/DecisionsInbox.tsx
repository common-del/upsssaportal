'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveEscalation } from '@/lib/actions/supervisor';
import type { DeskDecision } from '@prisma/client';
import type {
  DecisionRow,
  DecisionsInboxData,
  DiscrepancyDecision,
  EscalationDecision,
} from '@/lib/sssa/decisionsInbox';

/**
 * The Decisions page, third shape, settled with SSSA over three mock-up rounds.
 *
 * Three tabs. Overview is the default and only informs: who-count tiles that double
 * as doors, the backlog's age as one bar, and four standing signals. Appeals and
 * Verification issues are the work tabs: stacked cards, every one the same six
 * slots whatever its kind — who raised it and the consequence, a waiting clock, the
 * one big fact, a who-line, the substance quoted (honestly empty when the school
 * never replied), one button. "Rule oldest first" in the header deals the same
 * cards one at a time, worst first, across every kind.
 *
 * Attribution language is SSSA's: escalations are "raised by an online verifier",
 * discrepancy cases are "from the on-ground verifier", whose signed-off findings
 * the portal compared against the school's claim to open the case automatically.
 */

const APPEAL = '#B3271D';
const ESCALATION = '#1F3864';
const DISCREPANCY = '#B8791A';
const DISCREPANCY_INK = '#9A6410';
const NAVY_DEEP = '#073763';
const NAVY = '#1B2A6B';
const GREEN = '#14603A';

const inr = (n: number) => n.toLocaleString('en-IN');
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const waitClass = (d: number) => (d >= 14 ? 'text-[#B3271D]' : d >= 7 ? 'text-[#9A6410]' : 'text-gray-500');

export type DecisionsTab = 'overview' | 'appeals' | 'issues';
export type IssuesWho = 'all' | 'verifier' | 'field';

function writeUrl(tab: DecisionsTab, who: IssuesWho, focus: boolean) {
  // Kept in the URL so Back, reload and shared links land on the same slice.
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (focus) params.set('view', 'focus');
  else {
    if (tab !== 'overview') params.set('tab', tab);
    if (tab === 'issues' && who !== 'all') params.set('who', who);
  }
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// The inline four-option ruling for escalations
// ─────────────────────────────────────────────────────────────────────────────

const RULINGS: { value: DeskDecision; label: string }[] = [
  { value: 'EVIDENCE_SUPPORTS_LEVEL', label: 'Evidence supports the claimed level' },
  { value: 'EVIDENCE_INSUFFICIENT', label: 'Evidence insufficient' },
  { value: 'EVIDENCE_CONTRADICTS_LEVEL', label: 'Evidence contradicts the claim' },
  { value: 'EVIDENCE_MISSING', label: 'Evidence missing' },
];

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
    <div className="mt-3 border-t border-gray-100 pt-3">
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
// The one card: six slots, whatever the kind
// ─────────────────────────────────────────────────────────────────────────────

function discrepancyResponseLine(row: DiscrepancyDecision): string {
  if (row.response === 'RESPONDED') {
    return row.respondedDaysAgo === 0
      ? 'school responded today'
      : `school responded ${days(row.respondedDaysAgo ?? 0)} ago`;
  }
  if (row.response === 'WINDOW_OPEN') return `response window open, ${days(row.windowDaysLeft ?? 0)} left`;
  if (row.response === 'WINDOW_CLOSED') return 'window closed unanswered';
  return 'response window not opened yet';
}

function discrepancyQuote(row: DiscrepancyDecision): string {
  if (row.responseBody) return row.responseBody;
  if (row.response === 'WINDOW_CLOSED') {
    const closed = row.windowClosedOn
      ? new Date(row.windowClosedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
      : null;
    return `None. The response window closed${closed ? ` on ${closed}` : ''} without a reply, so the case can be ruled as it stands.`;
  }
  if (row.response === 'WINDOW_OPEN') {
    return `Not yet. The window is open for another ${days(row.windowDaysLeft ?? 0)}.`;
  }
  return 'Not sought yet. The response window has not been opened for this case.';
}

/** One skeleton for every decision: kind line, waiting clock, the big fact, a
 *  who-line, the substance quoted, one action. Nothing floats, nothing is missing. */
function DecisionCard({ row, showWait = true }: { row: DecisionRow; showWait?: boolean }) {
  const [ruling, setRuling] = useState(false);

  const spec =
    row.kind === 'APPEAL'
      ? { edge: APPEAL, ink: APPEAL, kind: 'Filed by the school · an upheld appeal changes the published score' }
      : row.kind === 'ESCALATION'
        ? { edge: ESCALATION, ink: ESCALATION, kind: 'Raised by an online verifier · freezes its case until you rule' }
        : { edge: DISCREPANCY, ink: DISCREPANCY_INK, kind: 'From the on-ground verifier · field visit differs from the claim · blocks publication' };

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5" style={{ borderLeft: `4px solid ${spec.edge}` }}>
      <p className="pr-20 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: spec.ink }}>
        {spec.kind}
      </p>
      {showWait && (
        <span className={`absolute right-4 top-4 text-[11.5px] font-extrabold tabular-nums ${waitClass(row.waitingDays)}`}>
          {days(row.waitingDays)}
        </span>
      )}

      {row.kind === 'APPEAL' && (
        <>
          <p className="mt-1.5 text-[18px] font-extrabold tabular-nums text-gray-900">
            {row.selfScore != null ? row.selfScore.toFixed(1) : '—'} {row.selfBand ?? ''}{' '}
            <span className="font-normal text-gray-400">self →</span>{' '}
            <span style={{ color: APPEAL }}>
              {row.verifiedScore != null ? row.verifiedScore.toFixed(1) : '—'} {row.verifiedBand ?? ''}
            </span>{' '}
            <span className="font-normal text-gray-400">verified</span>
          </p>
          <p className="mt-1 text-[12.5px] text-gray-500">
            {row.school} · {row.district}
            {row.verifierName ? ` · verified by ${row.verifierName}` : ''} · {inr(row.contested)} indicator
            {row.contested === 1 ? '' : 's'} contested
          </p>
          <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-800">
            <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              The school&apos;s grounds
            </span>
            {row.grounds ?? 'No written grounds on the appeal; the contested indicators carry the argument.'}
          </blockquote>
          <div className="mt-4">
            <Link
              href={`/app/sssa/finalization/appeal/${row.udise}`}
              className="inline-block rounded-lg px-5 py-2 text-[12.5px] font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              Open the appeal
            </Link>
          </div>
        </>
      )}

      {row.kind === 'ESCALATION' && (
        <>
          <p className="mt-1.5 text-[17px] font-extrabold text-gray-900">
            <span className="mr-2 font-mono text-[13px]" style={{ color: ESCALATION }}>
              {row.parameterCode}
            </span>
            {row.parameterTitle}
          </p>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Screening {row.school} · {row.district} · raised by {row.verifierName}, Online Verifier
            {row.claimedLevel !== null ? ` · claimed Level ${row.claimedLevel}` : ''}
          </p>
          <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-800">
            <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              The verifier&apos;s reason
            </span>
            {row.rationale ?? 'No written reason was recorded with the escalation.'}
          </blockquote>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setRuling((r) => !r)}
              aria-expanded={ruling}
              className="rounded-lg px-5 py-2 text-[12.5px] font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              {ruling ? 'Close the form' : 'Rule this indicator'}
            </button>
          </div>
          {ruling && <EscalationRulingForm row={row} />}
        </>
      )}

      {row.kind === 'DISCREPANCY' && (
        <>
          <p className="mt-1.5 text-[18px] font-extrabold tabular-nums text-gray-900">
            <span style={{ color: DISCREPANCY_INK }}>
              {inr(row.found)}
              {row.checked != null ? ` of ${inr(row.checked)}` : ''}
            </span>{' '}
            indicators found below the claim
          </p>
          <p className="mt-1 text-[12.5px] text-gray-500">
            {row.school} · {row.district}
            {row.fieldVerifierName ? ` · field visit signed off by ${row.fieldVerifierName}` : ''} ·{' '}
            {discrepancyResponseLine(row)}
          </p>
          <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-800">
            <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              The school&apos;s response
            </span>
            {discrepancyQuote(row)}
          </blockquote>
          <div className="mt-4">
            <Link
              href={`/app/sssa/discrepancies/${row.runId}`}
              className="inline-block rounded-lg px-5 py-2 text-[12.5px] font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              Open the case
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule oldest first: the one-at-a-time mode, over every kind
// ─────────────────────────────────────────────────────────────────────────────

function shortLabel(row: DecisionRow): string {
  if (row.kind === 'APPEAL') return `${row.school} appeal`;
  if (row.kind === 'DISCREPANCY') return `${row.school} case`;
  return `indicator ${row.parameterCode} escalation`;
}

function FocusMode({ rows, onExit }: { rows: DecisionRow[]; onExit: () => void }) {
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
        <button type="button" onClick={onExit} className="ml-auto text-[12px] font-bold text-gray-500 hover:text-gray-800">
          Back to the tabs
        </button>
      </div>

      <DecisionCard row={current} />

      <div className="flex flex-wrap items-center gap-3">
        {ordered.length > 1 && (
          <button
            type="button"
            onClick={() => setSkipped((s) => [...s.filter((k) => k !== current.key), current.key])}
            className="rounded-lg border-2 border-gray-300 px-4 py-1.5 text-[12px] font-bold text-gray-600 hover:bg-gray-50"
          >
            Skip for now
          </button>
        )}
        {upNext.length > 0 && (
          <p className="text-[12px] text-gray-400">
            Next: {upNext.map((r) => `${shortLabel(r)}, ${days(r.waitingDays)}`).join(' · ')}
            {ordered.length > 3 && ` · ${inr(ordered.length - 3)} more behind them`}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The Overview tab
// ─────────────────────────────────────────────────────────────────────────────

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">{label}</p>
      {children}
    </div>
  );
}

function Overview({ data, openTab }: { data: DecisionsInboxData; openTab: (tab: DecisionsTab, who: IssuesWho) => void }) {
  const { counts, overview, rows } = data;
  const oldestOf = (kind: DecisionRow['kind']) => rows.find((r) => r.kind === kind)?.waitingDays ?? 0;
  const total = Math.max(1, counts.total);
  const maxDistrict = Math.max(1, overview.districts[0]?.count ?? 1);
  const decidedTotal = Math.max(1, overview.appealsDecided.decided);

  const tiles: { count: number; label: string; sub: string; colour: string; tab: DecisionsTab; who: IssuesWho }[] = [
    {
      count: counts.appeals,
      label: 'Appeals',
      sub: `filed by schools · oldest ${days(oldestOf('APPEAL'))}`,
      colour: APPEAL,
      tab: 'appeals',
      who: 'all',
    },
    {
      count: counts.escalations,
      label: 'From online verifiers',
      sub: `frozen cases · oldest ${days(oldestOf('ESCALATION'))}`,
      colour: ESCALATION,
      tab: 'issues',
      who: 'verifier',
    },
    {
      count: counts.discrepancies,
      label: 'From on-ground verifiers',
      sub: `field visit differs from the claim · oldest ${days(oldestOf('DISCREPANCY'))}`,
      colour: DISCREPANCY,
      tab: 'issues',
      who: 'field',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
          <p className="text-[26px] font-extrabold leading-tight tabular-nums text-gray-900">{inr(counts.total)}</p>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">Waiting on you</p>
          <p className="mt-0.5 text-[11.5px] text-gray-500">across everything below</p>
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3.5" style={{ borderTop: `4px solid ${t.colour}` }}>
            <p className="text-[26px] font-extrabold leading-tight tabular-nums" style={{ color: t.colour === DISCREPANCY ? DISCREPANCY_INK : t.colour }}>
              {inr(t.count)}
            </p>
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">{t.label}</p>
            <p className="mt-0.5 text-[11.5px] text-gray-500">{t.count > 0 ? t.sub : 'nothing waiting'}</p>
            {t.count > 0 && (
              <button
                type="button"
                onClick={() => openTab(t.tab, t.who)}
                className="mt-1.5 text-[11.5px] font-bold"
                style={{ color: NAVY_DEEP }}
              >
                Open →
              </button>
            )}
          </div>
        ))}
      </div>

      <Panel label="The backlog by age">
        <div className="mt-2 flex h-3.5 overflow-hidden rounded-full bg-gray-100">
          {overview.ageBands.over14 > 0 && (
            <span style={{ width: `${(overview.ageBands.over14 / total) * 100}%`, backgroundColor: APPEAL }} />
          )}
          {overview.ageBands.oneToTwo > 0 && (
            <span style={{ width: `${(overview.ageBands.oneToTwo / total) * 100}%`, backgroundColor: '#D9A24A' }} />
          )}
          {overview.ageBands.under7 > 0 && (
            <span style={{ width: `${(overview.ageBands.under7 / total) * 100}%`, backgroundColor: '#C6CBD6' }} />
          )}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] tabular-nums text-gray-500">
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: APPEAL }} />
            {inr(overview.ageBands.over14)} waiting over two weeks
          </span>
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: '#D9A24A' }} />
            {inr(overview.ageBands.oneToTwo)} between one and two weeks
          </span>
          <span>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: '#C6CBD6' }} />
            {inr(overview.ageBands.under7)} under a week
          </span>
        </p>
        <p className="mt-2 text-[12.5px] tabular-nums text-gray-500">
          You ruled{' '}
          <b className="font-bold" style={{ color: GREEN }}>
            {inr(overview.ruledThisWeek)}
          </b>{' '}
          this week · the oldest wait is <b className="font-bold text-gray-900">{days(counts.oldestDays)}</b>
        </p>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel label="Where the backlog sits">
          <div className="mt-2 flex flex-col gap-1.5">
            {overview.districts.map((d) => (
              <p key={d.name} className="flex items-center gap-2.5 text-[12px] tabular-nums text-gray-600">
                <i
                  className="inline-block h-2 rounded-sm"
                  style={{ width: `${Math.max(8, (d.count / maxDistrict) * 110)}px`, backgroundColor: NAVY, opacity: 0.85 }}
                />
                {d.name} {inr(d.count)}
              </p>
            ))}
            {overview.otherDistrictsCount > 0 && (
              <p className="flex items-center gap-2.5 text-[12px] tabular-nums text-gray-500">
                <i
                  className="inline-block h-2 rounded-sm"
                  style={{
                    width: `${Math.max(8, (overview.otherDistrictsCount / maxDistrict) * 110)}px`,
                    backgroundColor: NAVY,
                    opacity: 0.35,
                  }}
                />
                other districts {inr(overview.otherDistrictsCount)}
              </p>
            )}
            {overview.districts.length === 0 && <p className="text-[12px] text-gray-500">Nothing waiting anywhere.</p>}
          </div>
        </Panel>
        <Panel label="Appeals decided this cycle">
          {overview.appealsDecided.decided === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-gray-500">None decided yet.</p>
          ) : (
            <>
              <p className="mt-1 text-[14px] font-bold tabular-nums text-gray-900">
                {inr(overview.appealsDecided.decided)} decided: {inr(overview.appealsDecided.upheld)} upheld,{' '}
                {inr(overview.appealsDecided.dismissed)} dismissed
              </p>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                <span style={{ width: `${(overview.appealsDecided.upheld / decidedTotal) * 100}%`, backgroundColor: GREEN }} />
                <span style={{ width: `${(overview.appealsDecided.dismissed / decidedTotal) * 100}%`, backgroundColor: '#C6CBD6' }} />
              </div>
              <p className="mt-1.5 text-[12px] text-gray-500">How often schools win when they contest.</p>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel label="Your pace">
          {overview.medianDaysToDecideAppeal == null ? (
            <p className="mt-1.5 text-[12.5px] text-gray-500">No appeals decided yet this cycle.</p>
          ) : (
            <>
              <p className="mt-1 text-[14px] font-bold tabular-nums text-gray-900">
                {days(overview.medianDaysToDecideAppeal)} median to decide an appeal
              </p>
              <p className="mt-1 text-[12px] text-gray-500">Across the appeals decided this cycle.</p>
            </>
          )}
        </Panel>
        <Panel label="Most escalated indicator">
          {overview.mostEscalated == null ? (
            <p className="mt-1.5 text-[12.5px] text-gray-500">Nothing has been escalated this cycle.</p>
          ) : (
            <>
              <p className="mt-1 text-[14px] font-bold tabular-nums text-gray-900">
                <span className="mr-1.5 font-mono text-[12.5px]" style={{ color: ESCALATION }}>
                  {overview.mostEscalated.code}
                </span>
                escalated {inr(overview.mostEscalated.times)} time{overview.mostEscalated.times === 1 ? '' : 's'} this cycle
              </p>
              <p className="mt-1 text-[12px] text-gray-500">{overview.mostEscalated.title}. A rubric worth clarifying.</p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The shell
// ─────────────────────────────────────────────────────────────────────────────

export function DecisionsInbox({
  data,
  initialTab = 'overview',
  initialWho = 'all',
  initialFocus = false,
}: {
  data: DecisionsInboxData;
  initialTab?: DecisionsTab;
  initialWho?: IssuesWho;
  initialFocus?: boolean;
}) {
  const [tab, setTab] = useState<DecisionsTab>(initialTab);
  const [who, setWho] = useState<IssuesWho>(initialWho);
  const [focus, setFocus] = useState(initialFocus && data.counts.total > 0);

  const appealRows = useMemo(() => data.rows.filter((r) => r.kind === 'APPEAL'), [data.rows]);
  const issueRows = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (r.kind === 'ESCALATION' || r.kind === 'DISCREPANCY') &&
          (who === 'all' || (who === 'verifier' ? r.kind === 'ESCALATION' : r.kind === 'DISCREPANCY')),
      ),
    [data.rows, who],
  );

  function go(nextTab: DecisionsTab, nextWho: IssuesWho) {
    setTab(nextTab);
    setWho(nextWho);
    setFocus(false);
    writeUrl(nextTab, nextWho, false);
  }

  const tabs: { id: DecisionsTab; label: string; count: number | null }[] = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'appeals', label: 'Appeals', count: data.counts.appeals },
    { id: 'issues', label: 'Verification issues', count: data.counts.escalations + data.counts.discrepancies },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {data.counts.total === 0 ? (
            'Nothing is waiting on you. Every case is moving.'
          ) : (
            <>
              <b className="font-bold tabular-nums text-gray-900">{inr(data.counts.total)}</b> waiting on you ·
              oldest has waited{' '}
              <b className="font-bold tabular-nums text-gray-900">{days(data.counts.oldestDays)}</b>
            </>
          )}
        </p>
        {data.counts.total > 0 && !focus && (
          <button
            type="button"
            onClick={() => {
              setFocus(true);
              writeUrl(tab, who, true);
            }}
            className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Rule oldest first
          </button>
        )}
      </div>

      {focus ? (
        <FocusMode
          rows={data.rows}
          onExit={() => {
            setFocus(false);
            writeUrl(tab, who, false);
          }}
        />
      ) : (
        <>
          <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => go(t.id, t.id === 'issues' ? who : 'all')}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${
                  t.id === tab ? 'border-[#1B2A6B] text-[#1B2A6B]' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                      t.id === tab ? 'bg-[#1B2A6B] text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {inr(t.count)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'overview' && <Overview data={data} openTab={go} />}

          {tab === 'appeals' &&
            (appealRows.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
                No appeals are waiting on a decision.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {appealRows.map((r) => (
                  <DecisionCard key={r.key} row={r} />
                ))}
              </div>
            ))}

          {tab === 'issues' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'All', count: data.counts.escalations + data.counts.discrepancies },
                    { id: 'verifier', label: 'Raised by online verifiers', count: data.counts.escalations, colour: ESCALATION },
                    { id: 'field', label: 'From on-ground verifiers', count: data.counts.discrepancies, colour: DISCREPANCY_INK },
                  ] as const
                ).map((c) => {
                  const on = who === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => go('issues', c.id)}
                      className={`rounded-full border-2 px-3.5 py-1 text-[12px] font-bold ${
                        on ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white' : 'border-gray-300 bg-white hover:bg-gray-50'
                      }`}
                      style={!on && 'colour' in c && c.colour ? { color: c.colour } : undefined}
                    >
                      {c.label} <span className="tabular-nums opacity-75">{inr(c.count)}</span>
                    </button>
                  );
                })}
              </div>
              {issueRows.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
                  Nothing of this kind is waiting.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {issueRows.map((r) => (
                    <DecisionCard key={r.key} row={r} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
