'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProgrammeConfig, type ConfigChangeRow } from '@/lib/actions/programmeAdmin';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD_DARK = '#7A5209';

/**
 * The section 6 editor. Each field carries its explanation inline, and where the source
 * documents disagree the disagreement is stated in the help text, because the brief requires
 * the screen to say so rather than presenting a contested number as settled.
 */

type FieldDef = {
  key: string;
  label: string;
  help: string;
  /** Stated only where the source documents actually disagree. */
  conflict?: string;
  input:
    | { kind: 'int'; min: number; max: number; nullable?: boolean; nullMeans?: string }
    | { kind: 'bool' }
    | { kind: 'enum'; options: { value: string; label: string }[] };
};

type Section = { title: string; fields: FieldDef[] };

const SECTIONS: Section[] = [
  {
    title: 'Field cohort',
    fields: [
      {
        key: 'fieldCohortPercentage',
        label: 'Field cohort percentage',
        help: 'Share of schools receiving a physical visit.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'cohortBasis',
        label: 'Cohort basis',
        help: 'What the percentage is a share of. Unresolved in the source documents, and it moves the field workforce by roughly three times: a third of each year\'s intake is a third as many visits as a third of all schools.',
        conflict: 'The source documents do not say. Recorded as an open decision in BRIEF_REVIEW.md section 2.',
        input: {
          kind: 'enum',
          options: [
            { value: 'ALL_SCHOOLS', label: 'All schools (larger cohort)' },
            { value: 'ANNUAL_INTAKE', label: 'This year\'s intake (smaller cohort)' },
          ],
        },
      },
      {
        key: 'revisitIntervalYears',
        label: 'Revisit interval (years)',
        help: 'A published school is not due another physical visit for this long.',
        input: { kind: 'int', min: 1, max: 10 },
      },
      {
        key: 'cycleSpanYears',
        label: 'Cycle span (years)',
        help: 'One verification cycle covers every school over this many years. Confirmed by SSSA as 3, which is what makes desk screening staffable.',
        input: { kind: 'int', min: 1, max: 5 },
      },
    ],
  },
  {
    title: 'Student spot check',
    fields: [
      {
        key: 'spotCheckMode',
        label: 'Spot check mode',
        help: 'How many children a field verifier tests.',
        conflict: 'The terms of reference say 10 randomly selected students. The role card and the flowchart say 10% of students. These are different instruments, so both are built and this mode chooses.',
        input: {
          kind: 'enum',
          options: [
            { value: 'FIXED_COUNT', label: 'Fixed count' },
            { value: 'PERCENTAGE', label: 'Percentage of enrolment' },
          ],
        },
      },
      {
        key: 'spotCheckFixedCount',
        label: 'Fixed count',
        help: 'Children tested when the mode is fixed count.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'spotCheckPercentage',
        label: 'Percentage',
        help: 'Share of enrolment tested when the mode is percentage.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'spotCheckMinimum',
        label: 'Minimum children',
        help: 'Floor for very small schools, applied in percentage mode only.',
        input: { kind: 'int', min: 1, max: 50 },
      },
    ],
  },
  {
    title: 'Audit sample',
    fields: [
      {
        key: 'auditSamplePercentage',
        label: 'Audit sample percentage',
        help: 'Share of published, field-visited verifications independently re-checked.',
        conflict: 'The flowchart says 1% per district. The terms of reference say 3% to 5%. Defaulted to the terms of reference as the more recent and specific document.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'auditSampleBasis',
        label: 'Audit sample basis',
        help: 'Per district guarantees every district some audit coverage; statewide ranks one pool.',
        input: {
          kind: 'enum',
          options: [
            { value: 'PER_DISTRICT', label: 'Per district' },
            { value: 'STATEWIDE', label: 'Statewide' },
          ],
        },
      },
    ],
  },
  {
    title: 'De-empanelment',
    fields: [
      {
        key: 'deEmpanelContradictionRate',
        label: 'Contradiction rate (%)',
        help: 'Share of audited cases contradicted at or above which removal is recommended.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'deEmpanelMinimumAuditedCases',
        label: 'Minimum audited cases',
        help: 'The rate rule stays silent below this many audited cases.',
        conflict: 'Not in the source documents. Without a floor, one contradiction in the first five audited cases reads as 20% and would end an empanelment on a sample of five.',
        input: { kind: 'int', min: 1, max: 100 },
      },
      {
        key: 'deEmpanelAbsoluteCount',
        label: 'Absolute count (rolling 12 months)',
        help: 'Proven contradictions inside a rolling year at or above which removal is recommended, regardless of the rate.',
        input: { kind: 'int', min: 1, max: 20 },
      },
    ],
  },
  {
    title: 'Deadlines and windows',
    fields: [
      {
        key: 'submissionExtensionDays',
        label: 'Submission extension (days)',
        help: 'Extension a non-submitter gets after the deadline reminder before becoming a priority field case.',
        input: { kind: 'int', min: 0, max: 90 },
      },
      {
        key: 'videoWalkthroughTurnaroundDays',
        label: 'Walkthrough turnaround (days)',
        help: 'How long a flagged case may wait for its video walkthrough.',
        input: { kind: 'int', min: 1, max: 60 },
      },
      {
        key: 'dayOfRevealHour',
        label: 'Reveal hour',
        help: 'Local hour on the notified date at which a field verifier\'s school unlocks. The terms of reference say the morning of the visit; midnight would hand the school over the evening before.',
        input: { kind: 'int', min: 5, max: 12 },
      },
      {
        key: 'schoolResponseWindowDays',
        label: 'Response window (days)',
        help: 'How long a school has to respond to proposed corrections before the supervisor may rule.',
        input: { kind: 'int', min: 1, max: 60 },
      },
      {
        key: 'schoolResponseWindowEnabled',
        label: 'Response window enabled',
        help: 'The window is an addition, not a requirement of either source document. It is on by default because a score corrected downward with no right of reply is the likeliest point of legal challenge in a public disclosure system.',
        input: { kind: 'bool' },
      },
      {
        key: 'deskScreeningManualSampleSize',
        label: 'Desk screening sample size',
        help: 'How many manual indicators desk screening presents per case.',
        conflict: 'Leave empty for every applicable indicator, which is what the terms of reference require. Setting a number narrows screening to the mismatches plus a sample, which is the lever if screening capacity runs short.',
        input: { kind: 'int', min: 1, max: 100, nullable: true, nullMeans: 'All indicators' },
      },
    ],
  },
];

export function ProgrammeConfigForm({
  config,
  changes,
}: {
  config: Record<string, string | number | boolean | null>;
  changes: ConfigChangeRow[];
}) {
  const router = useRouter();
  const initial = useMemo(() => {
    const out: Record<string, string> = {};
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        const v = config[f.key];
        out[f.key] = v === null || v === undefined ? '' : String(v);
      }
    }
    return out;
  }, [config]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = Object.keys(values).filter((k) => values[k] !== initial[k]);

  function save() {
    setMessage(null);
    const updates: Record<string, string | number | boolean | null> = {};
    for (const key of dirty) {
      const def = SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key)!;
      const raw = values[key] ?? '';
      if (def.input.kind === 'int') updates[key] = raw === '' ? null : Number.parseInt(raw, 10);
      else if (def.input.kind === 'bool') updates[key] = raw === 'true';
      else updates[key] = raw;
    }
    startTransition(async () => {
      const res = await updateProgrammeConfig(updates, reason);
      if (res.success) {
        setMessage({ kind: 'ok', text: `${res.changed} setting${res.changed === 1 ? '' : 's'} changed and recorded.` });
        setReason('');
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: res.error ?? 'Could not save.' });
      }
    });
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-xl border-2 border-gray-200 bg-white p-5">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            {section.title}
          </h2>
          <div className="mt-3 space-y-4">
            {section.fields.map((f) => (
              <div key={f.key} className="grid gap-2 sm:grid-cols-[240px_1fr]">
                <div>
                  <label htmlFor={f.key} className="text-sm font-bold text-gray-900">
                    {f.label}
                  </label>
                  {f.input.kind === 'int' ? (
                    <input
                      id={f.key}
                      type="number"
                      min={f.input.min}
                      max={f.input.max}
                      value={values[f.key] ?? ''}
                      placeholder={f.input.nullable ? (f.input.nullMeans ?? 'Empty') : undefined}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 block w-32 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                    />
                  ) : f.input.kind === 'bool' ? (
                    <select
                      id={f.key}
                      value={values[f.key] ?? 'true'}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 block w-32 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  ) : (
                    <select
                      id={f.key}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 block w-full max-w-xs rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                    >
                      {f.input.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="text-sm" style={{ color: INK_MUTED }}>
                  <p>{f.help}</p>
                  {f.conflict && (
                    <p className="mt-1 rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: '#FDF8EC', color: GOLD_DARK }}>
                      {f.conflict}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border-2 bg-white p-5" style={{ borderColor: dirty.length > 0 ? NAVY : '#E5E7EB' }}>
        <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
          {dirty.length === 0
            ? 'No unsaved changes.'
            : `${dirty.length} setting${dirty.length === 1 ? '' : 's'} changed: ${dirty.join(', ')}`}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why this change is being made. Required, and kept on the record with your name."
          className="mt-2 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || dirty.length === 0}
          className="mt-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: NAVY }}
        >
          {pending ? 'Saving...' : 'Save and record the change'}
        </button>
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className="mt-2 text-sm font-semibold" style={{ color: message.kind === 'ok' ? GREEN : RED }}>
            {message.text}
          </p>
        )}
      </section>

      <section className="rounded-xl border-2 border-gray-200 bg-white p-5">
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Change history
        </h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            No configuration change has ever been recorded.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
                  <th className="py-2 pr-3 font-bold">When</th>
                  <th className="py-2 pr-3 font-bold">Setting</th>
                  <th className="py-2 pr-3 font-bold">From</th>
                  <th className="py-2 pr-3 font-bold">To</th>
                  <th className="py-2 pr-3 font-bold">By</th>
                  <th className="py-2 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 pr-3 whitespace-nowrap text-xs" style={{ color: INK_MUTED }}>
                      {new Date(c.at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs font-bold" style={{ color: NAVY_DEEP }}>
                      {c.field}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{c.oldValue ?? 'unset'}</td>
                    <td className="py-2 pr-3 font-mono text-xs font-bold">{c.newValue}</td>
                    <td className="py-2 pr-3">{c.actorName}</td>
                    <td className="py-2 text-gray-700">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
