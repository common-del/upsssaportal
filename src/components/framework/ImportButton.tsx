'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { importSqaafFromExcel } from '@/lib/actions/framework';
import { useTranslations } from 'next-intl';

export default function ImportButton({
  disabled,
  cycleId,
  label,
}: {
  disabled?: boolean;
  cycleId?: string;
  label?: string;
}) {
  const t = useTranslations('framework');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await importSqaafFromExcel(cycleId);
      setResult(res);
      if (res.success) {
        window.location.reload();
      }
    } catch {
      setResult({ success: false, message: 'Unexpected error.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleImport}
        disabled={loading || disabled}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          label
            ? 'border border-border text-text-secondary hover:bg-surface'
            : 'bg-navy-700 text-white hover:bg-navy-800'
        }`}
      >
        <Upload size={16} />
        {loading ? t('importing') : label || t('importExcel')}
      </button>
      {result && (
        <p className={`mt-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.success ? t('importSuccess') : t('importError')}: {result.message}
        </p>
      )}
    </div>
  );
}
