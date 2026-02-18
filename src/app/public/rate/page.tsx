import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { getActiveCycle, getActiveDimensions } from '@/lib/actions/rating';
import { RateSchoolForm } from '@/components/public/RateSchoolForm';

export default async function RateSchoolPage() {
  const t = await getTranslations('rate');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [cycle, dimensions] = await Promise.all([
    getActiveCycle(),
    getActiveDimensions(),
  ]);

  if (!cycle) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/public/feedback" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
          <ArrowLeft size={16} /> {tc('back')}
        </Link>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
        <p className="mt-4 text-text-secondary">{t('noCycle')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/public/feedback" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-text-secondary">{t('subtitle')}</p>
      <p className="mt-1 text-xs text-text-secondary">{t('cycleLabel')}: {cycle.name}</p>

      <RateSchoolForm
        dimensions={dimensions.map((d) => ({
          code: d.code,
          labelEn: d.labelEn,
          labelHi: d.labelHi,
        }))}
        locale={locale}
      />
    </div>
  );
}
