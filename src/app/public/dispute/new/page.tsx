import { getTranslations, getLocale } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import { prisma } from '@/lib/db';
import { DisputeForm } from '@/components/public/DisputeForm';
import { getFallbackGeo } from '@/lib/public/findGeoFallback';

async function loadGeo() {
  try {
    const [districts, blocks] = await Promise.all([
      prisma.district.findMany({
        select: { code: true, nameEn: true, nameHi: true },
        orderBy: { nameEn: 'asc' },
      }),
      prisma.block.findMany({
        select: { code: true, districtCode: true, nameEn: true, nameHi: true },
        orderBy: { nameEn: 'asc' },
      }),
    ]);
    return { districts, blocks };
  } catch {
    return getFallbackGeo();
  }
}

export default async function NewDisputePage() {
  const t = await getTranslations('dispute');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [categories, { districts, blocks }] = await Promise.all([
    prisma.disputeCategory.findMany({
      where: { isActive: true },
      select: { code: true, nameEn: true, nameHi: true },
      orderBy: { nameEn: 'asc' },
    }),
    loadGeo(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton
        fallbackHref="/public/feedback"
        label={tc('back')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      />

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('newTitle')}
      </h1>
      <p className="mt-2 text-text-secondary">{t('newSubtitle')}</p>

      <DisputeForm categories={categories} districts={districts} blocks={blocks} locale={locale} />
    </div>
  );
}
