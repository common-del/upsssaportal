import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { TrackDisputeForm } from '@/components/public/TrackDisputeForm';

export default async function TrackDisputePage() {
  const t = await getTranslations('track');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/public/feedback"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">{t('subtitle')}</p>

      <TrackDisputeForm locale={locale} />
    </div>
  );
}
