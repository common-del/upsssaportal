'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  reconcileAuditCase,
  saveAuditFinding,
  submitAuditCase,
  type AuditCaseDetail,
  type AuditIndicator,
} from '@/lib/actions/audit';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD_DARK = '#7A5209';

/**
 * The blind re-verification, in two phases the server enforces.
 *
 * Before submission this screen holds only the school's claims and the auditor's own entries;
 * the primary verifier's findings are not in the payload at all, so there is nothing here to
 * reveal early. After submission the same screen becomes the reconciliation view: audit
 * against primary, side by side, ending in a signed verdict.
 */
export function AuditCaseWorkspace({ detail }: { detail: AuditCaseDetail }) {
  return detail.submittedAt ? <ReconciliationView detail={detail} /> : <BlindEntry detail={detail} />;
}

function BlindEntry({ detail }: { detail: AuditCaseDetail }) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, { level: number | null; note: string }>>(() =>
    Object.fromEntries(detail.indicators.map((i) => [i.parameterId, { level: i.myLevel, note: i.myNote ?? '' }])),
  );
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const recorded = detail.indicators.filter((i) => local[i.parameterId]?.level != null).length;

  function save(indicator: AuditIndicator, level: number) {
    const entry = { level, note: local[indicator.parameterId]?.note ?? '' };
    setLocal((s) => ({ ...s, [indicator.parameterId]: entry }));
    setError('');
    startTransition(async () => {
      const res = await saveAuditFinding(detail.caseId, indicator.parameterId, level, entry.note);
      if (!res.success) setError(res.error ?? 'Could not save.');
    });
  }

  function saveNote(indicator: AuditIndicator) {
    const entry = local[indicator.parameterId];
    if (!entry || entry.level === null) return;
    startTransition(async () => {
      await saveAuditFinding(detail.caseId, indicator.parameterId, entry.level!, entry.note);
    });
  }

  function submit() {
    setError('');
    startTransition(async () => {
      const res = await submitAuditCase(detail.caseId);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not submit.');
    });
  }

  const byDomain = useMemo(() => {
    const groups = new Map<string, AuditIndicator[]>();
    for (const i of detail.indicators) {
      const list = groups.get(i.domainTitleEn) ?? [];
      list.push(i);
      groups.set(i.domainTitleEn, list);
    }
    return groups;
  }, [detail.indicators]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 p-4" style={{ borderColor: NAVY, backgroundColor: '#EEF2F9' }}>
        <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
          You are re-verifying blind.
        </p>
        <p className="mt-1 text-sm" style={{ color: NAVY_DEEP }}>
          The primary verifier&apos;s findings are not on this page and cannot be fetched until
          you submit. Record what you observe; re-check as many indicators as the visit allows.
          Notes are required wherever you later intend to stand behind a contradiction.
        </p>
      </div>

      <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
        {recorded} of {detail.indicators.length} indicators re-checked
      </p>

      {[...byDomain.entries()].map(([domain, indicators]) => (
        <section key={domain} className="space-y-3">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            {domain}
          </h2>
          {indicators.map((indicator) => {
            const entry = local[indicator.parameterId] ?? { level: null, note: '' };
            return (
              <div key={indicator.parameterId} className="rounded-xl border-2 border-gray-200 bg-white p-4">
                <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
                  {indicator.code}
                </p>
                <p className="mt-0.5 text-base font-bold text-gray-900">{indicator.titleEn}</p>
                <p className="text-sm" style={{ color: INK_MUTED }}>
                  {indicator.titleHi}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: NAVY_DEEP }}>
                  {indicator.claimedLevel !== null
                    ? `School claimed Level ${indicator.claimedLevel}`
                    : 'The school made no claim for this indicator.'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {indicator.levels.map((level) => {
                    const selected = entry.level === level.order;
                    return (
                      <button
                        key={level.order}
                        type="button"
                        onClick={() => save(indicator, level.order)}
                        className="min-h-12 rounded-lg border-2 p-2.5 text-left"
                        style={{
                          borderColor: selected ? NAVY : '#D1D5DB',
                          backgroundColor: selected ? NAVY : 'white',
                        }}
                      >
                        <span className="block text-sm font-bold" style={{ color: selected ? 'white' : NAVY_DEEP }}>
                          Level {level.order}
                        </span>
                        <span className="mt-0.5 block text-xs" style={{ color: selected ? 'white' : '#374151' }}>
                          {level.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={entry.note}
                  onChange={(e) =>
                    setLocal((s) => ({ ...s, [indicator.parameterId]: { ...entry, note: e.target.value } }))
                  }
                  onBlur={() => saveNote(indicator)}
                  rows={2}
                  placeholder="What you observed."
                  className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
                />
              </div>
            );
          })}
        </section>
      ))}

      <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: NAVY }}>
        <p className="text-sm" style={{ color: INK_MUTED }}>
          Submitting locks your entries and reveals the primary verifier&apos;s findings for
          reconciliation. Nothing can be edited afterwards.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending || recorded === 0}
          className="mt-3 rounded-lg px-6 py-3 text-base font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: NAVY }}
        >
          {pending ? 'Submitting...' : 'Submit the blind re-verification'}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ReconciliationView({ detail }: { detail: AuditCaseDetail }) {
  const router = useRouter();
  const [note, setNote] = useState(detail.reconciliationNote ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const reChecked = detail.indicators.filter((i) => i.myLevel !== null);
  const disagreements = reChecked.filter((i) => i.primaryLevel !== null && i.myLevel !== i.primaryLevel);

  function verdict(contradicted: boolean) {
    setError('');
    startTransition(async () => {
      const res = await reconcileAuditCase(detail.caseId, contradicted, note);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not record the verdict.');
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {detail.findingCount}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Indicators compared
          </p>
        </div>
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold" style={{ color: detail.contradictionCount > 0 ? RED : GREEN }}>
            {detail.contradictionCount}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Levels that differ
          </p>
        </div>
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {detail.findingCount === 0 ? 'n/a' : `${Math.round((detail.contradictionCount / detail.findingCount) * 100)}%`}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            Disagreement share
          </p>
        </div>
      </div>

      {disagreements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold" style={{ color: RED }}>
            Where you and the primary verifier differ
          </h2>
          {disagreements.map((i) => (
            <div key={i.parameterId} className="rounded-xl border-2 bg-white p-4" style={{ borderColor: RED }}>
              <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
                {i.code}
              </p>
              <p className="text-base font-bold text-gray-900">{i.titleEn}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
                    Primary verifier
                  </p>
                  <p className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
                    Level {i.primaryLevel}
                  </p>
                  {i.primaryNote && <p className="mt-1 text-sm text-gray-700">{i.primaryNote}</p>}
                  {i.primaryPhotoBlobUrl && (
                    <a
                      href={i.primaryPhotoBlobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm font-bold underline"
                      style={{ color: NAVY }}
                    >
                      Their photograph
                    </a>
                  )}
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#EEF2F9' }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
                    Your re-check
                  </p>
                  <p className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
                    Level {i.myLevel}
                  </p>
                  {i.myNote && <p className="mt-1 text-sm text-gray-700">{i.myNote}</p>}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {detail.reconciledAt ? (
        <div
          className="rounded-xl border-2 p-5"
          style={{
            borderColor: detail.contradicted ? RED : GREEN,
            backgroundColor: detail.contradicted ? '#FBE9E7' : '#E7F5EE',
          }}
        >
          <p className="text-base font-bold" style={{ color: detail.contradicted ? RED : GREEN }}>
            {detail.contradicted
              ? 'Reconciled as a contradiction. It counts towards the primary verifier’s de-empanelment record.'
              : 'Reconciled as consistent with the primary verification.'}
          </p>
          {detail.reconciliationNote && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{detail.reconciliationNote}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: NAVY }}>
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            Your verdict
          </h2>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            Do your findings contradict the primary verifier&apos;s report? The counts above
            inform this; they do not decide it. A level apart on one indicator out of eighty is
            not the same fact as a classroom that plainly does not exist.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Your grounds. Required for a contradiction verdict, and shown to the supervisor and the verifier."
            className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => verdict(false)}
              disabled={pending}
              className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: GREEN }}
            >
              Consistent
            </button>
            <button
              type="button"
              onClick={() => verdict(true)}
              disabled={pending}
              className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: RED }}
            >
              Contradiction
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: GOLD_DARK }}>
            {reChecked.length} indicator{reChecked.length === 1 ? '' : 's'} re-checked on site.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
