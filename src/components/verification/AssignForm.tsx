'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { assignVerifiersForCycle } from '@/lib/actions/verification';

type District = { code: string; nameEn: string; nameHi: string };

export default function AssignForm({ cycleId, districts }: { cycleId: string; districts: District[] }) {
  const t = useTranslations('verifierAssign');
  const locale = useLocale();
  const router = useRouter();
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [result, setResult] = useState<{ assigned: number; skipped: number; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);

  const toggleDistrict = (code: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleAssign = () => {
    setResult(null);
    startTransition(async () => {
      const res = await assignVerifiersForCycle({
        cycleId,
        districtCodes: selectedDistricts.length > 0 ? selectedDistricts : undefined,
        deadlineAt: deadline || undefined,
      });
      setResult(res);
      router.refresh();
    });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t('selectDistricts')}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t('selectDistrictsHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {districts.map((d) => (
            <button
              key={d.code}
              onClick={() => toggleDistrict(d.code)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                selectedDistricts.includes(d.code)
                  ? 'border-navy-500 bg-navy-700 text-white'
                  : 'border-border text-navy-700 hover:bg-surface'
              }`}
            >
              {label(d.nameEn, d.nameHi)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <label className="block text-sm font-semibold text-navy-900">{t('deadline')}</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-2 rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
        />
      </div>

      <button
        onClick={handleAssign}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
      >
        <Users size={16} />
        {isPending ? t('assigning') : t('runAssignment')}
      </button>

      {result && (
        <div className={`rounded-lg border p-4 text-sm ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {result.error ? result.error : t('assignResult', { assigned: result.assigned, skipped: result.skipped })}
        </div>
      )}
    </div>
  );
}
