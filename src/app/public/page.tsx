import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';

export default function PublicPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-2xl text-text-secondary">{t('body')}</p>
    </div>
  );
}
