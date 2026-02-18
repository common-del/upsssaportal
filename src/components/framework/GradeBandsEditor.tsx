'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateGradeBand } from '@/lib/actions/framework';

type Band = {
  id: string;
  key: string;
  labelEn: string;
  labelHi: string;
  minPercent: number;
  maxPercent: number;
  order: number;
};

export default function GradeBandsEditor({
  bands,
  readonly,
}: {
  bands: Band[];
  readonly: boolean;
}) {
  const t = useTranslations('framework');
  const [state, setState] = useState(bands.map((b) => ({ ...b })));
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(idx: number) {
    const b = state[idx];
    setSaving(b.id);
    await updateGradeBand(b.id, {
      labelEn: b.labelEn,
      labelHi: b.labelHi,
      minPercent: b.minPercent,
      maxPercent: b.maxPercent,
    });
    setSaving(null);
  }

  function updateField(idx: number, field: keyof Band, value: string | number) {
    const next = [...state];
    next[idx] = { ...next[idx], [field]: value };
    setState(next);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-base font-semibold text-navy-900">{t('gradeBands')}</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-text-secondary">
            <th className="pb-2 font-medium w-24">{t('bandKey')}</th>
            <th className="pb-2 font-medium">{t('bandLabelEn')}</th>
            <th className="pb-2 font-medium">{t('bandLabelHi')}</th>
            <th className="pb-2 font-medium w-20">{t('bandMin')}</th>
            <th className="pb-2 font-medium w-20">{t('bandMax')}</th>
            <th className="pb-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {state.map((b, idx) => (
            <tr key={b.id} className="border-b last:border-b-0">
              <td className="py-2 font-mono text-xs text-text-secondary">{b.key}</td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  disabled={readonly}
                  value={b.labelEn}
                  onChange={(e) => updateField(idx, 'labelEn', e.target.value)}
                  className="w-full rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  disabled={readonly}
                  value={b.labelHi}
                  onChange={(e) => updateField(idx, 'labelHi', e.target.value)}
                  className="w-full rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={readonly}
                  value={b.minPercent}
                  onChange={(e) => updateField(idx, 'minPercent', parseFloat(e.target.value) || 0)}
                  className="w-16 rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={readonly}
                  value={b.maxPercent}
                  onChange={(e) => updateField(idx, 'maxPercent', parseFloat(e.target.value) || 0)}
                  className="w-16 rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2">
                {!readonly && (
                  <button
                    onClick={() => handleSave(idx)}
                    disabled={saving === b.id}
                    className="text-xs text-navy-700 hover:text-navy-900 disabled:opacity-50"
                  >
                    {saving === b.id ? '…' : t('save')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
