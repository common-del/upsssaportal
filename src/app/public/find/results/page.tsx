import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { computeAge, ageToGrade, gradeLabel } from '@/lib/age-to-grade';
import { ResultsSortSelect } from '@/components/public/ResultsSortSelect';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

type SortKey = 'name_asc' | 'fees_asc' | 'fees_desc';

function buildOrderBy(sort: SortKey): Prisma.SchoolOrderByWithRelationInput[] {
  switch (sort) {
    case 'fees_asc':
      return [{ feesRangeMin: { sort: 'asc', nulls: 'last' } }, { nameEn: 'asc' }];
    case 'fees_desc':
      return [{ feesRangeMax: { sort: 'desc', nulls: 'last' } }, { nameEn: 'asc' }];
    default:
      return [{ nameEn: 'asc' }];
  }
}

export default async function FindResultsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('findResults');
  const tsp = await getTranslations('schoolProfile');
  const locale = await getLocale();
  const hi = locale === 'hi';

  // Parse params
  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const dob = (searchParams.dob as string) || '';
  const sex = (searchParams.sex as string) || '';
  const specialNeeds = (searchParams.specialNeeds as string) || 'no';
  const feesMinParam = parseInt((searchParams.feesMin as string) || '', 10);
  const feesMaxParam = parseInt((searchParams.feesMax as string) || '', 10);
  const sort = ((searchParams.sort as string) || 'name_asc') as SortKey;
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  // Compute grade from DOB
  let computedGrade: number | null = null;
  if (dob) {
    const date = new Date(dob);
    if (!isNaN(date.getTime())) {
      computedGrade = ageToGrade(computeAge(date));
    }
  }

  // Build where clause — only filter by fields that exist in the schema
  const where: Prisma.SchoolWhereInput = {};
  if (district) where.districtCode = district;
  if (block) where.blockCode = block;

  // Fees filter: include schools where known fees overlap the requested range
  // If feesRangeMin/Max is null in DB, include them (labeled "Fees not available")
  if (!isNaN(feesMinParam) || !isNaN(feesMaxParam)) {
    const feesConditions: Prisma.SchoolWhereInput[] = [];

    // Schools with known fees that overlap the range
    const overlapCondition: Prisma.SchoolWhereInput = {};
    if (!isNaN(feesMaxParam)) {
      overlapCondition.feesRangeMin = { lte: feesMaxParam };
    }
    if (!isNaN(feesMinParam)) {
      overlapCondition.feesRangeMax = { gte: feesMinParam };
    }
    feesConditions.push({
      AND: [
        { feesRangeMin: { not: null } },
        { feesRangeMax: { not: null } },
        overlapCondition,
      ],
    });

    // Schools with unknown fees (null) — include them
    feesConditions.push({ feesRangeMin: null });
    feesConditions.push({ feesRangeMax: null });

    where.OR = feesConditions;
  }

  // Fetch schools + count
  const [schools, total, districtData, blockData] = await Promise.all([
    prisma.school.findMany({
      where,
      select: {
        id: true,
        udise: true,
        nameEn: true,
        nameHi: true,
        category: true,
        publicPhone: true,
        feesRangeMin: true,
        feesRangeMax: true,
        district: { select: { nameEn: true, nameHi: true } },
        block: { select: { nameEn: true, nameHi: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: buildOrderBy(sort),
    }),
    prisma.school.count({ where }),
    district
      ? prisma.district.findUnique({
          where: { code: district },
          select: { nameEn: true, nameHi: true },
        })
      : null,
    block
      ? prisma.block.findUnique({
          where: { code: block },
          select: { nameEn: true, nameHi: true },
        })
      : null,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Build pagination hrefs preserving all query params
  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (block) params.set('block', block);
    if (dob) params.set('dob', dob);
    if (sex) params.set('sex', sex);
    if (specialNeeds !== 'no') params.set('specialNeeds', specialNeeds);
    if (!isNaN(feesMinParam)) params.set('feesMin', String(feesMinParam));
    if (!isNaN(feesMaxParam)) params.set('feesMax', String(feesMaxParam));
    if (sort !== 'name_asc') params.set('sort', sort);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/public/find/results${qs ? `?${qs}` : ''}`;
  }

  function sortHref(s: string) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (block) params.set('block', block);
    if (dob) params.set('dob', dob);
    if (sex) params.set('sex', sex);
    if (specialNeeds !== 'no') params.set('specialNeeds', specialNeeds);
    if (!isNaN(feesMinParam)) params.set('feesMin', String(feesMinParam));
    if (!isNaN(feesMaxParam)) params.set('feesMax', String(feesMaxParam));
    if (s !== 'name_asc') params.set('sort', s);
    const qs = params.toString();
    return `/public/find/results${qs ? `?${qs}` : ''}`;
  }

  // Sex labels
  const sexLabels: Record<string, string> = hi
    ? { M: 'पुरुष', F: 'महिला', T: 'अन्य' }
    : { M: 'Male', F: 'Female', T: 'Other' };

  // Format fees
  function formatFees(min: number | null, max: number | null): string {
    if (min == null && max == null) return tsp('notAvailable');
    if (min != null && max != null) return `₹${min.toLocaleString()} – ₹${max.toLocaleString()}`;
    if (min != null) return `₹${min.toLocaleString()}+`;
    return `Up to ₹${max!.toLocaleString()}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/public/find"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {t('backToSearch')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>

      {/* Criteria summary */}
      <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold text-navy-900">
          {t('criteriaUsed')}
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
          {districtData && (
            <span>
              {t('labelDistrict')}: <strong>{hi ? districtData.nameHi : districtData.nameEn}</strong>
            </span>
          )}
          {blockData && (
            <span>
              {t('labelBlock')}: <strong>{hi ? blockData.nameHi : blockData.nameEn}</strong>
            </span>
          )}
          {sex && (
            <span>
              {t('labelSex')}: <strong>{sexLabels[sex] || sex}</strong>
            </span>
          )}
          {computedGrade !== null && (
            <span>
              {t('labelGrade')}: <strong>{gradeLabel(computedGrade, locale)}</strong>
            </span>
          )}
          {(!isNaN(feesMinParam) || !isNaN(feesMaxParam)) && (
            <span>
              {t('labelFees')}:{' '}
              <strong>
                {!isNaN(feesMinParam) ? `₹${feesMinParam.toLocaleString()}` : '₹0'}
                {' – '}
                {!isNaN(feesMaxParam) ? `₹${feesMaxParam.toLocaleString()}` : t('noLimit')}
              </strong>
            </span>
          )}
          {specialNeeds === 'yes' && (
            <span>
              {t('labelSpecialNeeds')}: <strong>{t('yes')}</strong>
            </span>
          )}
        </div>
        {computedGrade !== null && (
          <p className="mt-2 text-xs text-amber-700">{t('gradeNote')}</p>
        )}
        {specialNeeds === 'yes' && (
          <p className="mt-1 text-xs text-amber-700">{t('specialNeedsNote')}</p>
        )}
      </div>

      {/* Sort + count */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {total > 0
            ? t('showing', { from, to, total })
            : t('noResults')}
        </p>

        {total > 0 && (
          <ResultsSortSelect current={sort} sortHrefs={{
            name_asc: sortHref('name_asc'),
            fees_asc: sortHref('fees_asc'),
            fees_desc: sortHref('fees_desc'),
          }} />
        )}
      </div>

      {/* Results table */}
      {total > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">{t('colName')}</th>
                <th className="px-4 py-3 font-medium">{t('colUdise')}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">{t('colCategory')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('colDistrict')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('colBlock')}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('colPhone')}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('colFees')}</th>
                <th className="hidden px-4 py-3 font-medium xl:table-cell">{t('colGrade')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schools.map((s) => (
                <tr key={s.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/public/schools/${s.udise}`}
                      className="font-medium text-navy-700 hover:text-navy-900 hover:underline"
                    >
                      {hi ? s.nameHi : s.nameEn}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.udise}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">{s.category}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {hi ? s.district.nameHi : s.district.nameEn}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {hi ? s.block.nameHi : s.block.nameEn}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {s.publicPhone || (
                      <span className="text-text-secondary">{tsp('notAvailable')}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {formatFees(s.feesRangeMin, s.feesRangeMax)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary xl:table-cell">
                    {t('gradePlaceholder')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface"
            >
              {t('prev')}
            </Link>
          ) : (
            <span />
          )}

          <span className="text-text-secondary">
            {t('page', { page, totalPages })}
          </span>

          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface"
            >
              {t('next')}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
