'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activateRubric, createRubricVersion, type RubricRow } from '@/lib/actions/programmeAdmin';
import type { RiskThresholdBasis } from '@prisma/client';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * Rubric versioning. Versions are append-only; every stored risk score keeps the version
 * that computed it, so this screen changes what happens to future cases and provably not
 * what happened to past ones. That property is the whole design, and the copy says so.
 */

const WEIGHT_FIELDS: { key: string; label: string; help: string }[] = [
  { key: 'AUTO_MISMATCH', label: 'Automated mismatch', help: 'Per indicator where an external source contradicts the claim.' },
  { key: 'EVIDENCE_SUPPORTS_LEVEL', label: 'Evidence supports', help: 'Usually zero: a supported claim is not risk.' },
  { key: 'EVIDENCE_INSUFFICIENT', label: 'Evidence insufficient', help: 'Uploaded, but does not establish the level.' },
  { key: 'EVIDENCE_MISSING', label: 'Evidence missing', help: 'Nothing uploaded at all.' },
  { key: 'EVIDENCE_CONTRADICTS_LEVEL', label: 'Evidence contradicts', help: 'The upload disproves the claim. The heaviest per-indicator input.' },
  { key: 'ESCALATED_RUN', label: 'Escalated case', help: 'Applied once per case that needed a supervisor, not per indicator.' },
];

const BASES: { value: RiskThresholdBasis; label: string; help: string }[] = [
  {
    value: 'MATCHED_INDICATORS_ONLY',
    label: 'Matched indicators only',
    help: 'Deviation measured over indicators an external source actually checked. Falls back to total score below the minimum AUTO count.',
  },
  {
    value: 'TOTAL_SCORE',
    label: 'Total score',
    help: 'Deviation measured over every decided indicator.',
  },
  {
    value: 'PER_DOMAIN_WORST',
    label: 'Worst domain',
    help: 'The single worst domain decides, so one collapsed domain cannot hide in a good average.',
  },
];

export function RubricManager({ rubrics }: { rubrics: RubricRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const active = rubrics.find((r) => r.isActive);
    return Object.fromEntries(WEIGHT_FIELDS.map((f) => [f.key, String(active?.weights[f.key] ?? 0)]));
  });
  const [basis, setBasis] = useState<RiskThresholdBasis>('MATCHED_INDICATORS_ONLY');
  const [threshold, setThreshold] = useState('20');
  const [minAuto, setMinAuto] = useState('5');
  const [activate, setActivate] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setMessage(null);
    startTransition(async () => {
      const res = await createRubricVersion({
        label,
        weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number.parseInt(v, 10)])),
        thresholdBasis: basis,
        thresholdValue: Number.parseInt(threshold, 10),
        minimumAutoIndicatorsForBasis: Number.parseInt(minAuto, 10),
        activate,
      });
      if (res.success) {
        setMessage({ kind: 'ok', text: `Version ${res.version} created${activate ? ' and activated' : ''}.` });
        setOpen(false);
        setLabel('');
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: res.error ?? 'Could not create the version.' });
      }
    });
  }

  function makeActive(id: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await activateRubric(id);
      if (res.success) router.refresh();
      else setMessage({ kind: 'error', text: res.error ?? 'Could not activate.' });
    });
  }

  return (
    <section className="rounded-xl border-2 border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            Risk rubric versions
          </h2>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            Every stored score keeps the version that computed it, so a new version changes
            future screening and never a past decision. Verifiers cannot edit any of this, per
            the terms of reference.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border-2 px-4 py-2 text-sm font-bold"
          style={{ borderColor: NAVY, color: NAVY }}
        >
          {open ? 'Close' : 'New version'}
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-lg border-2 p-4" style={{ borderColor: NAVY }}>
          <label className="block text-sm font-bold text-gray-900">
            Label
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Why this version exists, e.g. Calibrated after first quarter audits"
              className="mt-1 block w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {WEIGHT_FIELDS.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="font-bold text-gray-900">{f.label}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={weights[f.key] ?? '0'}
                  onChange={(e) => setWeights((w) => ({ ...w, [f.key]: e.target.value }))}
                  className="mt-1 block w-24 rounded-lg border-2 border-gray-300 px-3 py-2"
                />
                <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                  {f.help}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-bold text-gray-900">Threshold basis</span>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as RiskThresholdBasis)}
                className="mt-1 block w-full rounded-lg border-2 border-gray-300 px-3 py-2"
              >
                {BASES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                {BASES.find((b) => b.value === basis)?.help}
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-900">Threshold value</span>
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="mt-1 block w-24 rounded-lg border-2 border-gray-300 px-3 py-2"
              />
              <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                Above this, the case goes to a video walkthrough. The flowchart says 20 but not
                20 of what; the basis setting is that decision.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-900">Minimum AUTO indicators</span>
              <input
                type="number"
                min={0}
                max={50}
                value={minAuto}
                onChange={(e) => setMinAuto(e.target.value)}
                className="mt-1 block w-24 rounded-lg border-2 border-gray-300 px-3 py-2"
              />
              <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                Below this many externally checked indicators, matched-only falls back to total
                score rather than measuring a percentage of almost nothing.
              </span>
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-gray-900">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            Activate immediately for all future screening
          </label>

          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="mt-3 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: NAVY }}
          >
            {pending ? 'Creating...' : 'Create the version'}
          </button>
        </div>
      )}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className="mt-3 text-sm font-semibold" style={{ color: message.kind === 'ok' ? GREEN : RED }}>
          {message.text}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
              <th className="py-2 pr-3 font-bold">Version</th>
              <th className="py-2 pr-3 font-bold">Label</th>
              <th className="py-2 pr-3 font-bold">Threshold</th>
              <th className="py-2 pr-3 font-bold">Weights</th>
              <th className="py-2 pr-3 font-bold">Scores computed</th>
              <th className="py-2 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rubrics.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 align-top">
                <td className="py-2 pr-3 font-mono font-bold" style={{ color: NAVY_DEEP }}>
                  v{r.version}
                </td>
                <td className="py-2 pr-3">
                  <p className="font-semibold text-gray-900">{r.label}</p>
                  <p className="text-xs" style={{ color: INK_MUTED }}>
                    {r.createdBy}, {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {r.thresholdValue} on {r.thresholdBasis.replaceAll('_', ' ').toLowerCase()}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {Object.entries(r.weights)
                    .map(([k, v]) => `${k.split('_').map((w) => w[0]).join('')}:${v}`)
                    .join(' ')}
                </td>
                <td className="py-2 pr-3 font-mono">{r.scoreCount.toLocaleString('en-IN')}</td>
                <td className="py-2">
                  {r.isActive ? (
                    <span className="rounded-full bg-[#E7F5EE] px-2 py-0.5 text-xs font-bold" style={{ color: GREEN }}>
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeActive(r.id)}
                      disabled={pending}
                      className="rounded-lg border-2 px-3 py-1 text-xs font-bold disabled:opacity-60"
                      style={{ borderColor: NAVY, color: NAVY }}
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
