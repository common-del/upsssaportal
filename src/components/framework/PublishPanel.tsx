'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { publishFramework } from '@/lib/actions/framework';
import type { ValidationError } from '@/lib/validators/framework';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function PublishPanel({
  frameworkId,
  userId,
  readonly,
}: {
  frameworkId: string;
  userId: string;
  readonly: boolean;
}) {
  const t = useTranslations('framework');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [success, setSuccess] = useState(false);

  async function handlePublish() {
    if (!confirm(t('publishConfirm'))) return;
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const result = await publishFramework(frameworkId, userId);
    if (result.success) {
      setSuccess(true);
      window.location.reload();
    } else {
      setErrors(result.errors);
    }
    setLoading(false);
  }

  if (readonly) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2 text-green-700">
          <ShieldCheck size={20} />
          <span className="font-semibold">{t('statusPublished')}</span>
        </div>
        <p className="mt-1 text-sm text-green-600">{t('publishedReadonly')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-base font-semibold text-navy-900">{t('publish')}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t('publishConfirm')}</p>

      <button
        onClick={handlePublish}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        <ShieldCheck size={16} />
        {loading ? t('publishing') : t('publish')}
      </button>

      {success && (
        <p className="mt-3 text-sm text-green-600">{t('publishSuccess')}</p>
      )}

      {errors.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={16} />
            <span className="text-sm font-semibold">{t('publishErrors')}</span>
          </div>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
            {errors.map((err, idx) => (
              <li key={idx} className="rounded border border-red-100 bg-red-50 px-3 py-1.5 text-red-700">
                <span className="font-mono font-semibold">[{err.code}]</span>{' '}
                {err.message}
                {err.target && (
                  <span className="ml-1 text-red-500">→ {err.target}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
