import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function RateSuccessPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('rate');
  const udise = (searchParams.udise as string) || '';

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-navy-900">{t('successTitle')}</h1>
      <p className="mt-3 text-text-secondary">{t('successDesc')}</p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {udise && (
          <Link
            href={`/public/schools/${udise}`}
            className="rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            {t('viewSchool')}
          </Link>
        )}
        <Link
          href="/public/feedback"
          className="text-sm font-medium text-navy-700 hover:text-navy-900 hover:underline"
        >
          {t('backToFeedback')}
        </Link>
      </div>
    </div>
  );
}
