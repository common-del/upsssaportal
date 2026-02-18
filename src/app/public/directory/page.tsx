import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { DirectoryFilters } from '@/components/public/DirectoryFilters';
import { getBatchRatingAggregates } from '@/lib/actions/rating';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

export default async function DirectoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('directory');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const category = (searchParams.category as string) || '';
  const q = (searchParams.q as string) || '';
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' } });
  const blocks = district
    ? await prisma.block.findMany({ where: { districtCode: district }, orderBy: { nameEn: 'asc' } })
    : [];

  const where: Prisma.SchoolWhereInput = {};
  if (district) where.districtCode = district;
  if (block) where.blockCode = block;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { nameEn: { contains: q, mode: 'insensitive' } },
      { nameHi: { contains: q } },
      { udise: { contains: q } },
    ];
  }

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      include: { district: true, block: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { nameEn: 'asc' },
    }),
    prisma.school.count({ where }),
  ]);

  const udises = schools.map((s) => s.udise);
  const ratingMap = await getBatchRatingAggregates(udises);

  // Fetch published results for grade display
  const publishedCycle = await prisma.cycle.findFirst({ where: { resultsPublished: true }, orderBy: { resultsPublishedAt: 'desc' } });
  const resultMap = new Map<string, { gradeBandCode: string | null }>();
  if (publishedCycle && udises.length > 0) {
    const results = await prisma.result.findMany({
      where: { cycleId: publishedCycle.id, schoolUdise: { in: udises }, publishedAt: { not: null } },
      select: { schoolUdise: true, gradeBandCode: true },
    });
    for (const r of results) resultMap.set(r.schoolUdise, r);
  }
  const gradeBands = publishedCycle
    ? await prisma.gradeBand.findMany({
        where: { framework: { cycleId: publishedCycle.id } },
        select: { key: true, labelEn: true, labelHi: true },
      })
    : [];
  const bandLabelMap = new Map(gradeBands.map((b) => [b.key, hi ? b.labelHi : b.labelEn]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (block) params.set('block', block);
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/public/directory${qs ? `?${qs}` : ''}`;
  }

  const hi = locale === 'hi';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/public" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>

      <DirectoryFilters
        districts={districts.map((d) => ({ code: d.code, nameEn: d.nameEn, nameHi: d.nameHi }))}
        blocks={blocks.map((b) => ({ code: b.code, nameEn: b.nameEn, nameHi: b.nameHi }))}
        selected={{ district, block, category, q }}
        locale={locale}
      />

      <p className="mt-6 text-sm text-text-secondary">
        {total > 0 ? t('showing', { from, to, total }) : t('noResults')}
      </p>

      {total > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">{t('name')}</th>
                <th className="px-4 py-3 font-medium">{t('udise')}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">{t('category')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('district')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('block')}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('grade')}</th>
                <th className="px-4 py-3 font-medium">{t('rating')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schools.map((s) => {
                const rating = ratingMap[s.udise];
                return (
                  <tr key={s.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <Link href={`/public/schools/${s.udise}`} className="font-medium text-navy-700 hover:text-navy-900 hover:underline">
                        {hi ? s.nameHi : s.nameEn}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{s.udise}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{s.category}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{hi ? s.district.nameHi : s.district.nameEn}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{hi ? s.block.nameHi : s.block.nameEn}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {(() => {
                        const result = resultMap.get(s.udise);
                        const gradeLabel = result?.gradeBandCode ? bandLabelMap.get(result.gradeBandCode) : null;
                        return gradeLabel
                          ? <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">{gradeLabel}</span>
                          : <span className="text-xs text-text-secondary">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {rating ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Star size={14} className="fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{rating.avg}</span>
                          <span className="text-xs text-text-secondary">({rating.count})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface">{t('prev')}</Link> : <span />}
          <span className="text-text-secondary">{t('page', { page, totalPages })}</span>
          {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface">{t('next')}</Link> : <span />}
        </div>
      )}
    </div>
  );
}
