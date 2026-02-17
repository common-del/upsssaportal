import Link from 'next/link';
import { ArrowLeft, MessageSquarePlus, AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function FeedbackPage() {
  const t = await getTranslations('feedbackPage');
  const tc = await getTranslations('common');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
        {/* Provide Feedback - coming later */}
        <div className="rounded-xl border border-border bg-white p-6 text-center opacity-60">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <MessageSquarePlus size={24} className="text-navy-700" />
          </div>
          <h2 className="text-lg font-semibold text-navy-900">
            {t('feedbackCard')}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t('feedbackCardDesc')}
          </p>
          <p className="mt-3 text-xs text-text-secondary">{tc('comingSoon')}</p>
        </div>

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
      </div>

      {/* Track link */}
      <div className="mt-8 text-center">
        <Link
          href="/public/dispute/track"
          className="text-sm font-medium text-navy-700 hover:text-navy-900 hover:underline"
        >
          {t('trackLink')}
        </Link>
      </div>
    </div>
  );
}
