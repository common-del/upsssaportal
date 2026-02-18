'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateFrameworkLevel } from '@/lib/actions/framework';

type Level = {
  id: string;
  key: string;
  labelEn: string;
  labelHi: string;
  order: number;
};

export default function LevelLabelsEditor({
  levels,
  readonly,
}: {
  levels: Level[];
  readonly: boolean;
}) {
  const t = useTranslations('framework');
  const [state, setState] = useState(levels.map((l) => ({ ...l })));
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(idx: number) {
    const lv = state[idx];
    setSaving(lv.id);
    await updateFrameworkLevel(lv.id, lv.labelEn, lv.labelHi);
    setSaving(null);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-base font-semibold text-navy-900">{t('levelLabels')}</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-text-secondary">
            <th className="pb-2 font-medium w-28">{t('levelKey')}</th>
            <th className="pb-2 font-medium">{t('labelEn')}</th>
            <th className="pb-2 font-medium">{t('labelHi')}</th>
            <th className="pb-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {state.map((lv, idx) => (
            <tr key={lv.id} className="border-b last:border-b-0">
              <td className="py-2 font-mono text-xs text-text-secondary">{lv.key}</td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  disabled={readonly}
                  value={lv.labelEn}
                  onChange={(e) => {
                    const next = [...state];
                    next[idx] = { ...next[idx], labelEn: e.target.value };
                    setState(next);
                  }}
                  className="w-full rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  disabled={readonly}
                  value={lv.labelHi}
                  onChange={(e) => {
                    const next = [...state];
                    next[idx] = { ...next[idx], labelHi: e.target.value };
                    setState(next);
                  }}
                  className="w-full rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2">
                {!readonly && (
                  <button
                    onClick={() => handleSave(idx)}
                    disabled={saving === lv.id}
                    className="text-xs text-navy-700 hover:text-navy-900 disabled:opacity-50"
                  >
                    {saving === lv.id ? '…' : t('save')}
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
