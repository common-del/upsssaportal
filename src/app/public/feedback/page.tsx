import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function FeedbackPage() {
  const t = await getTranslations('feedbackPage');
  const tc = await getTranslations('common');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/public"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">{t('subtitle')}</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {/* Raise a Dispute */}
        <Link
          href="/public/dispute/new"
          className="rounded-xl border border-border bg-white p-6 text-center transition-shadow hover:shadow-md"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-navy-900">
            {t('disputeCard')}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t('disputeCardDesc')}
          </p>
        </Link>

        {/* Track Dispute */}
        <Link
          href="/public/dispute/track"
          className="rounded-xl border border-border bg-white p-6 text-center transition-shadow hover:shadow-md"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <Search size={24} className="text-navy-700" />
          </div>
          <h2 className="text-lg font-semibold text-navy-900">
            {t('trackCard')}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t('trackCardDesc')}
          </p>
        </Link>
      </div>
    </div>
  );
}
