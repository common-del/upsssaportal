import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';

export default async function SchoolProfilePage(props: {
  params: Promise<{ udise: string }>;
}) {
  const { udise } = await props.params;
  const t = await getTranslations('schoolProfile');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const hi = locale === 'hi';

  const school = await prisma.school.findUnique({
    where: { udise },
    include: { district: true, block: true },
  });

  if (!school) notFound();

  const catKey =
    school.category === 'Primary'
      ? 'catPrimary'
      : school.category === 'Upper Primary'
        ? 'catUpperPrimary'
        : 'catSecondary';

  const fields = [
    { label: t('udise'), value: school.udise },
    { label: t('category'), value: t(catKey) },
    {
      label: t('district'),
      value: hi ? school.district.nameHi : school.district.nameEn,
    },
    {
      label: t('block'),
      value: hi ? school.block.nameHi : school.block.nameEn,
    },
    {
      label: t('address'),
      value:
        (hi ? school.addressHi : school.addressEn) || t('notAvailable'),
    },
    {
      label: t('phone'),
      value: school.publicPhone || t('notAvailable'),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/public/directory"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {hi ? school.nameHi : school.nameEn}
      </h1>

      {/* Info card */}
      <div className="mt-8 rounded-lg border border-border bg-white">
        <dl className="divide-y divide-border">
          {fields.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-0"
            >
              <dt className="w-40 shrink-0 text-sm font-medium text-text-secondary">
                {label}
              </dt>
              <dd className="text-sm text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* SSSA Results placeholder */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">{t('results')}</h2>
        <p className="mt-2 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-text-secondary">
          {t('resultsPlaceholder')}
        </p>
      </section>

      {/* Parent Ratings placeholder */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy-900">{t('ratings')}</h2>
        <p className="mt-2 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-text-secondary">
          {t('ratingsPlaceholder')}
        </p>
      </section>
    </div>
  );
}
