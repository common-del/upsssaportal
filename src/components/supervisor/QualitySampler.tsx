'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordQualityCheck, type QualitySampleCase } from '@/lib/actions/supervisor';
import type { QualityVerdict } from '@prisma/client';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const GOLD = '#BF9000';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';

const VERDICTS: { value: QualityVerdict; label: string; colour: string }[] = [
  { value: 'SATISFACTORY', label: 'Satisfactory', colour: GREEN },
  { value: 'COACHING_NEEDED', label: 'Coaching needed', colour: GOLD },
  { value: 'FLAGGED', label: 'Flagged', colour: RED },
];

function SampleCard({ item }: { item: QualitySampleCase }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<QualityVerdict | null>(item.existingVerdict);
  const [note, setNote] = useState(item.existingNote ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function save(v: QualityVerdict) {
    setVerdict(v);
    setError('');
    startTransition(async () => {
      const res = await recordQualityCheck(item.runId, item.subjectProfileId, v, note);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Could not record the verdict.');
    });
  }

  return (
    <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: item.cell === 'FIELD' ? '#D0AD42' : '#E5E7EB' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-gray-900">{item.subjectName}</p>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {item.cell === 'ONLINE' ? 'Desk screening' : 'Field visit'} · {item.schoolName} ·{' '}
            {item.districtName}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: item.cell === 'ONLINE' ? NAVY : GOLD }}
        >
          {item.cell === 'ONLINE' ? 'Online cell' : 'Field cell'}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold" style={{ color: NAVY_DEEP }}>
        {item.summary}
      </p>

      {item.rationales.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold" style={{ color: NAVY }}>
            Read the written reasoning ({item.rationales.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {item.rationales.map((r, i) => (
              <li key={i} className="rounded-lg bg-gray-50 p-2.5 text-sm text-gray-800">
                {r}
              </li>
            ))}
          </ul>
        </details>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Required for coaching or a flag: what specifically was weak or wrong."
        className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            disabled={pending}
            onClick={() => save(v.value)}
            className="rounded-lg border-2 px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{
              borderColor: v.colour,
              backgroundColor: verdict === v.value ? v.colour : 'white',
              color: verdict === v.value ? 'white' : v.colour,
            }}
          >
            {v.label}
          </button>
        ))}
        {error && (
          <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function QualitySampler({ items }: { items: QualitySampleCase[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
        No completed work to sample yet. The sample fills as desk cases are routed and visits are
        signed off.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((i) => (
        <SampleCard key={`${i.runId}:${i.subjectProfileId}`} item={i} />
      ))}
    </div>
  );
}
