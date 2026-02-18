'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateDomainWeight } from '@/lib/actions/framework';

type Domain = {
  id: string;
  code: string;
  titleEn: string;
  order: number;
  weightPercent: number | null;
  isActive: boolean;
};

export default function DomainWeightsEditor({
  domains,
  readonly,
}: {
  domains: Domain[];
  readonly: boolean;
}) {
  const t = useTranslations('framework');
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(domains.map((d) => [d.id, String(d.weightPercent ?? '')]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  const activeDomains = domains.filter((d) => d.isActive);
  const sum = activeDomains.reduce((acc, d) => acc + (parseFloat(weights[d.id] || '0') || 0), 0);

  async function handleSave(domainId: string) {
    const val = parseFloat(weights[domainId] || '0');
    if (isNaN(val)) return;
    setSaving(domainId);
    await updateDomainWeight(domainId, val);
    setSaving(null);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-base font-semibold text-navy-900">{t('domainWeights')}</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-text-secondary">
            <th className="pb-2 font-medium">{t('domains')}</th>
            <th className="pb-2 font-medium w-32">{t('weightPercent')}</th>
            <th className="pb-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {activeDomains.map((d) => (
            <tr key={d.id} className="border-b last:border-b-0">
              <td className="py-2 text-navy-900">
                {d.code} – {d.titleEn}
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={readonly}
                  value={weights[d.id] ?? ''}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="w-24 rounded border border-border px-2 py-1 text-sm disabled:bg-gray-50"
                />
              </td>
              <td className="py-2">
                {!readonly && (
                  <button
                    onClick={() => handleSave(d.id)}
                    disabled={saving === d.id}
                    className="text-xs text-navy-700 hover:text-navy-900 disabled:opacity-50"
                  >
                    {saving === d.id ? '…' : t('save')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td className="pt-2 font-semibold text-navy-900">{t('weightSum')}</td>
            <td className={`pt-2 font-semibold ${Math.abs(sum - 100) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
              {sum.toFixed(1)}%
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      {Math.abs(sum - 100) > 0.01 && (
        <p className="mt-2 text-xs text-red-600">{t('weightSumError')}</p>
      )}
    </div>
  );
}
