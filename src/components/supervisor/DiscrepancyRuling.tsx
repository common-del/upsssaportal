'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  openResponseWindow,
  ruleOnDiscrepancies,
  type DiscrepancyDetail,
  type Ruling,
} from '@/lib/actions/supervisor';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD_DARK = '#7A5209';

/**
 * The ruling workspace for one case.
 *
 * Per discrepancy the supervisor either upholds the field verifier's proposed level or
 * revises to a different one. The publish button applies every ruling and routes the run;
 * the server enforces the window rules again, so nothing here is the gate, it only explains
 * the gate.
 */
export function DiscrepancyRuling({ detail }: { detail: DiscrepancyDetail }) {
  const router = useRouter();
  const [rulings, setRulings] = useState<Map<string, Ruling>>(
    () =>
      new Map(
        detail.items
          .filter((i) => i.decided)
          .map((i) => [
            i.parameterId,
            i.revisedLevel === null
              ? { parameterId: i.parameterId, action: 'UPHOLD' as const }
              : { parameterId: i.parameterId, action: 'REVISE' as const, revisedLevel: i.revisedLevel },
          ]),
      ),
  );
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const windowPhase = detail.state === 'SCHOOL_RESPONSE_WINDOW';
  const canRule = windowPhase ? !detail.windowOpen : !detail.windowEnabled;
  const ruled = detail.items.filter((i) => rulings.has(i.parameterId)).length;

  function setRuling(parameterId: string, ruling: Ruling) {
    setRulings((m) => new Map(m).set(parameterId, ruling));
  }

  function openWindow() {
    setError('');
    startTransition(async () => {
      const res = await openResponseWindow(detail.runId);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not open the window.');
    });
  }

  function publish(referBack: boolean) {
    setError('');
    startTransition(async () => {
      const res = await ruleOnDiscrepancies(detail.runId, [...rulings.values()], referBack);
      if (res.success) router.push('/app/supervisor/discrepancies');
      else setError(res.error ?? 'Could not complete the ruling.');
    });
  }

  return (
    <div className="space-y-5">
      {/* Where the case stands */}
      {!windowPhase && detail.windowEnabled && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: '#D0AD42', backgroundColor: '#FDF8EC' }}>
          <p className="text-sm font-bold" style={{ color: GOLD_DARK }}>
            The school has not yet been offered its response window.
          </p>
          <p className="mt-1 text-sm" style={{ color: GOLD_DARK }}>
            Opening it shows the school the proposed corrections below and starts the configured
            clock. Publication is blocked until the school responds or the window closes.
          </p>
          <button
            type="button"
            onClick={openWindow}
            disabled={pending}
            className="mt-3 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: NAVY }}
          >
            {pending ? 'Opening...' : 'Open the response window'}
          </button>
        </div>
      )}

      {windowPhase && detail.windowOpen && (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-4 text-sm font-semibold" style={{ color: GOLD_DARK }}>
          The window is open until{' '}
          {detail.windowClosesAt && new Date(detail.windowClosesAt).toLocaleString('en-IN')} and the
          school has not responded yet. Ruling unlocks when it responds or the window closes.
        </p>
      )}

      {detail.response && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: GREEN, backgroundColor: '#E7F5EE' }}>
          <p className="text-sm font-bold" style={{ color: GREEN }}>
            The school&apos;s response, submitted{' '}
            {new Date(detail.response.submittedAt).toLocaleString('en-IN')}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{detail.response.body}</p>
        </div>
      )}

      {/* The discrepancies */}
      <div className="space-y-4">
        {detail.items.map((item) => {
          const ruling = rulings.get(item.parameterId);
          return (
            <div key={item.parameterId} className="rounded-xl border-2 border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
                    {item.code}
                  </p>
                  <p className="text-base font-bold text-gray-900">{item.title}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: RED }}>
                  Claimed {item.claimedLevel} → found {item.proposedLevel}
                </p>
              </div>

              <blockquote className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                {item.basis}
              </blockquote>
              {item.photoBlobUrl && (
                <a
                  href={item.photoBlobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-bold underline"
                  style={{ color: NAVY }}
                >
                  View the field photograph
                </a>
              )}

              {canRule && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRuling(item.parameterId, { parameterId: item.parameterId, action: 'UPHOLD' })}
                    className="rounded-lg border-2 px-4 py-2 text-sm font-bold"
                    style={{
                      borderColor: NAVY,
                      backgroundColor: ruling?.action === 'UPHOLD' ? NAVY : 'white',
                      color: ruling?.action === 'UPHOLD' ? 'white' : NAVY,
                    }}
                  >
                    Uphold level {item.proposedLevel}
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
                    or revise to
                  </span>
                  {item.levels.map((l) => (
                    <button
                      key={l.order}
                      type="button"
                      onClick={() =>
                        setRuling(item.parameterId, {
                          parameterId: item.parameterId,
                          action: 'REVISE',
                          revisedLevel: l.order,
                        })
                      }
                      className="min-w-10 rounded-lg border-2 px-3 py-2 text-sm font-bold"
                      style={{
                        borderColor: '#D1D5DB',
                        backgroundColor:
                          ruling?.action === 'REVISE' && ruling.revisedLevel === l.order ? NAVY_DEEP : 'white',
                        color:
                          ruling?.action === 'REVISE' && ruling.revisedLevel === l.order ? 'white' : NAVY_DEEP,
                      }}
                      title={l.labelEn}
                    >
                      {l.order}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The exit */}
      {canRule && (
        <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: NAVY }}>
          <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
            {ruled} of {detail.items.length} discrepancies ruled
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => publish(false)}
              disabled={pending || ruled < detail.items.length}
              className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: NAVY }}
            >
              {pending ? 'Working...' : 'Apply rulings and publish'}
            </button>
            {windowPhase && (
              <button
                type="button"
                onClick={() => publish(true)}
                disabled={pending}
                className="rounded-lg border-2 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: GOLD_DARK, color: GOLD_DARK }}
              >
                Refer back for a re-visit instead
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {error}
            </p>
          )}
        </div>
      )}
      {!canRule && error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}
