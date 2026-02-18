import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Star, Award } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { getSchoolRatingAggregates, getActiveDimensions } from '@/lib/actions/rating';

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

  const [ratingAgg, dimensions] = await Promise.all([
    getSchoolRatingAggregates(udise),
    getActiveDimensions(),
  ]);

  const dimMap = Object.fromEntries(dimensions.map((d) => [d.code, d]));

  const catKey =
    school.category === 'Primary'
      ? 'catPrimary'
      : school.category === 'Upper Primary'
        ? 'catUpperPrimary'
        : 'catSecondary';

  const fields = [
    { label: t('udise'), value: school.udise },
    { label: t('category'), value: t(catKey) },
    { label: t('district'), value: hi ? school.district.nameHi : school.district.nameEn },
    { label: t('block'), value: hi ? school.block.nameHi : school.block.nameEn },
    { label: t('address'), value: (hi ? school.addressHi : school.addressEn) || t('notAvailable') },
    { label: t('phone'), value: school.publicPhone || t('notAvailable') },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/public/directory" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {hi ? school.nameHi : school.nameEn}
      </h1>

      {/* Info card */}
      <div className="mt-8 rounded-lg border border-border bg-white">
        <dl className="divide-y divide-border">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-0">
              <dt className="w-40 shrink-0 text-sm font-medium text-text-secondary">{label}</dt>
              <dd className="text-sm text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* SSSA Accreditation Results */}
      <AccreditationSection udise={udise} t={t} hi={hi} />

      {/* Parent Ratings */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-900">{t('ratings')}</h2>
          <Link href="/public/rate" className="text-sm font-medium text-navy-700 hover:text-navy-900 hover:underline">
            {t('rateThisSchool')}
          </Link>
        </div>

        {ratingAgg ? (
          <div className="mt-4 rounded-lg border border-border bg-white p-5">
            {/* Overall */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Star size={24} className="fill-yellow-400 text-yellow-400" />
                <span className="text-2xl font-bold text-navy-900">{ratingAgg.overallAvg}</span>
              </div>
              <span className="text-sm text-text-secondary">
                {t('ratingCount', { count: ratingAgg.totalRatings })}
                {' · '}{ratingAgg.cycleName}
              </span>
            </div>

            {/* Per-dimension */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ratingAgg.dimensions.map((dim) => {
                const meta = dimMap[dim.code];
                return (
                  <div key={dim.code} className="flex items-center justify-between rounded-lg bg-surface px-4 py-2.5">
                    <span className="text-sm text-text-primary">
                      {meta ? (hi ? meta.labelHi : meta.labelEn) : dim.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <Star key={v} size={14} className={dim.avg >= v ? 'fill-yellow-400 text-yellow-400' : dim.avg >= v - 0.5 ? 'fill-yellow-200 text-yellow-300' : 'text-gray-200'} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-navy-900">{dim.avg}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-text-secondary">
            {t('noRatings')}
          </p>
        )}
      </section>
    </div>
  );
}

async function AccreditationSection({ udise, t, hi }: { udise: string; t: (k: string) => string; hi: boolean }) {
  const publishedCycle = await prisma.cycle.findFirst({
    where: { resultsPublished: true },
    orderBy: { resultsPublishedAt: 'desc' },
    select: { id: true, name: true, resultsPublishedAt: true },
  });

  if (!publishedCycle) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">{t('results')}</h2>
        <p className="mt-2 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-text-secondary">
          {t('resultsPlaceholder')}
        </p>
      </section>
    );
  }

  const result = await prisma.result.findUnique({
    where: { cycleId_schoolUdise: { cycleId: publishedCycle.id, schoolUdise: udise } },
  });

  if (!result || !result.publishedAt) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">{t('results')}</h2>
        <p className="mt-2 rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-text-secondary">
          {t('resultsPlaceholder')}
        </p>
      </section>
    );
  }

  let gradeBandLabel: string | null = null;
  if (result.gradeBandCode) {
    const band = await prisma.gradeBand.findFirst({
      where: { framework: { cycleId: publishedCycle.id }, key: result.gradeBandCode },
      select: { labelEn: true, labelHi: true },
    });
    if (band) gradeBandLabel = hi ? band.labelHi : band.labelEn;
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-navy-900">{t('results')}</h2>
      <div className="mt-4 rounded-lg border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <Award size={28} className="text-navy-700" />
          <div>
            <p className="text-sm text-text-secondary">{t('accreditationCycle')}: {publishedCycle.name}</p>
            {gradeBandLabel && (
              <p className="mt-1 text-2xl font-bold text-navy-900">{gradeBandLabel}</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{t('finalScore')}</p>
            <p className="mt-0.5 text-lg font-bold text-navy-900">{result.finalScorePercent != null ? `${result.finalScorePercent}%` : '—'}</p>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{t('selfScore')}</p>
            <p className="mt-0.5 text-lg font-bold text-navy-900">{result.selfScorePercent != null ? `${result.selfScorePercent}%` : '—'}</p>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{t('verifierScore')}</p>
            <p className="mt-0.5 text-lg font-bold text-navy-900">{result.verifierScorePercent != null ? `${result.verifierScorePercent}%` : '—'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          {t('publishedOn')}: {result.publishedAt.toLocaleDateString()}
        </p>
      </div>
    </section>
  );
}
