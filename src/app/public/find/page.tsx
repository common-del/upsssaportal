import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { FindSchoolsForm } from '@/components/public/FindSchoolsForm';

export default async function FindSchoolsPage() {
  const t = await getTranslations('findSchools');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [districts, blocks] = await Promise.all([
    prisma.district.findMany({
      select: { code: true, nameEn: true, nameHi: true },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.block.findMany({
      select: { code: true, nameEn: true, nameHi: true, districtCode: true },
      orderBy: { nameEn: 'asc' },
    }),
  ]);

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

      <FindSchoolsForm
        districts={districts}
        allBlocks={blocks}
        locale={locale}
      />
    </div>
  );
}
