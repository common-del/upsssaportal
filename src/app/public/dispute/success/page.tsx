import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function DisputeSuccessPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('dispute');
  const ticketId = (searchParams.ticketId as string) || '';

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>

      <h1 className="text-2xl font-bold text-navy-900">{t('successTitle')}</h1>
      <p className="mt-3 text-text-secondary">{t('successDesc')}</p>

      {ticketId && (
        <div className="mt-6 rounded-lg border border-border bg-surface px-6 py-4">
          <p className="text-sm text-text-secondary">{t('ticketIdLabel')}</p>
          <p className="mt-1 select-all font-mono text-lg font-bold text-navy-900">
            {ticketId}
          </p>
          <p className="mt-2 text-xs text-text-secondary">{t('saveTicketId')}</p>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/public/dispute/track"
          className="rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
        >
          {t('trackBtn')}
        </Link>
        <Link
          href="/public/feedback"
          className="text-sm text-navy-700 hover:text-navy-900 hover:underline"
        >
          {t('backToFeedback')}
        </Link>
      </div>
    </div>
  );
}
