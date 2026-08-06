import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import { prisma } from '@/lib/db';
import { DirectoryFilters } from '@/components/public/DirectoryFilters';
import { TierStars } from '@/components/public/TierStars';
import { deriveResultFields, DIRECTORY_LEVEL_BADGE } from '@/lib/public/schoolProfile';
import { SCHOOLS, ALL_DISTRICTS } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

type DirectoryRow = {
  id: string;
  udise: string;
  nameEn: string;
  nameHi: string;
  districtName: string;
  blockName: string;
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  feeDisclosed: boolean;
  accreditation: 'SQAAF Verified' | 'Pending';
};

export default async function DirectoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('directory');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const hi = locale === 'hi';

  const district = (searchParams.district as string) || '';
  const category = (searchParams.category as string) || '';
  const type = (searchParams.type as string) || '';
  const performance = (searchParams.performance as string) || '';
  const q = (searchParams.q as string) || '';
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  let districts: { code: string; nameEn: string; nameHi: string }[] = [];
  let rows: DirectoryRow[] = [];
  let usingFallback = false;

  try {
    const districtRecords = await prisma.district.findMany({ orderBy: { nameEn: 'asc' } });
    districts = districtRecords.map((d) => ({ code: d.code, nameEn: d.nameEn, nameHi: d.nameHi }));

    const where: Prisma.SchoolWhereInput = {};
    if (district) where.districtCode = district;
    if (category) where.category = category;
    if (q) {
      where.OR = [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameHi: { contains: q } },
        { udise: { contains: q } },
      ];
    }

    const matches = await prisma.school.findMany({
      where,
      include: { district: true, block: true },
      orderBy: { nameEn: 'asc' },
    });

    rows = matches.map((s) => {
      const extra = deriveResultFields(s.udise);
      return {
        id: s.id,
        udise: s.udise,
        nameEn: s.nameEn,
        nameHi: s.nameHi,
        districtName: hi ? s.district.nameHi : s.district.nameEn,
        blockName: hi ? s.block.nameHi : s.block.nameEn,
        ...extra,
      };
    });
  } catch {
    usingFallback = true;
    districts = ALL_DISTRICTS.map((name) => ({ code: name, nameEn: name, nameHi: name }));
    rows = SCHOOLS.filter((s) => !district || s.district === district)
      .filter((s) => !category || s.level === category)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.udise.includes(q),
      )
      .map((s) => ({
        id: s.id,
        udise: s.udise,
        nameEn: s.name,
        nameHi: s.name,
        districtName: s.district,
        blockName: s.block,
        type: s.type,
        performanceLevel: s.performanceLevel,
        feeDisclosed: s.feeDisclosed,
        accreditation: s.accreditation,
      }));
  }

  const filtered = rows.filter((r) => {
    if (type && r.type !== (type as SchoolType)) return false;
    if (performance && r.performanceLevel !== (performance as PerformanceLevel)) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (performance) params.set('performance', performance);
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/public/directory${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <BackButton
        fallbackHref="/public"
        label={tc('back')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
      />

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">{t('title')}</h1>

      {usingFallback && (
        <p className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          Live school records are temporarily unavailable. Showing a sample of schools instead.
        </p>
      )}

      <div className="mt-6">
        <DirectoryFilters
          districts={districts}
          selected={{ district, category, type, performance, q }}
          locale={locale}
        />
      </div>

      <p className="mt-6 text-sm text-text-secondary">
        {total > 0 ? t('foundCount', { count: total.toLocaleString('en-IN') }) : t('noResults')}
      </p>

      {total > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-3 font-semibold">{t('name')}</th>
                <th className="px-3 py-3 font-semibold">{t('udise')}</th>
                <th className="px-3 py-3 font-semibold">{t('district')}</th>
                <th className="px-3 py-3 font-semibold">{t('block')}</th>
                <th className="px-3 py-3 font-semibold">{t('type')}</th>
                <th className="px-3 py-3 font-semibold">Level</th>
                <th className="px-3 py-3 font-semibold">Fee</th>
                <th className="px-3 py-3 font-semibold">SQAAF Status</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface/60">
                  <td className="min-w-[210px] px-3 py-5">
                    <Link
                      href={`/public/schools/${r.udise}`}
                      className="font-semibold text-[#1B2A6B] hover:underline"
                    >
                      {hi ? r.nameHi : r.nameEn}
                    </Link>
                  </td>
                  <td className="px-3 py-5 font-mono text-xs text-text-secondary">{r.udise}</td>
                  <td className="whitespace-nowrap px-3 py-5">{r.districtName}</td>
                  <td className="whitespace-nowrap px-3 py-5">{r.blockName}</td>
                  <td className="whitespace-nowrap px-3 py-5">{r.type}</td>
                  <td className="px-3 py-5">
                    {/* Stars sit under the tier name, not beside it: side by side
                        they read as a second, competing rating. */}
                    <div className="flex flex-col items-start gap-1.5">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIRECTORY_LEVEL_BADGE[r.performanceLevel]}`}
                      >
                        {r.performanceLevel}
                      </span>
                      <TierStars level={r.performanceLevel} size={12} />
                    </div>
                  </td>
                  <td className="px-3 py-5">
                    {r.feeDisclosed ? (
                      <span className="whitespace-nowrap rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#92400E]">
                        Disclosed
                      </span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Not Disclosed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-5">
                    {r.accreditation === 'SQAAF Verified' ? (
                      <span className="whitespace-nowrap rounded-full bg-[#F5B731] px-2.5 py-0.5 text-xs font-semibold text-[#1B2A6B]">
                        SQAAF Verified
                      </span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-5 text-right">
                    <Link
                      href={`/public/schools/${r.udise}`}
                      className="text-sm font-medium text-[#1B2A6B] hover:underline"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              aria-label={t('prev')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1B2A6B] transition-colors hover:bg-surface"
            >
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center text-gray-300">
              <ChevronLeft size={18} />
            </span>
          )}
          <span className="text-text-secondary">{t('page', { page, totalPages })}</span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              aria-label={t('next')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1B2A6B] transition-colors hover:bg-surface"
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center text-gray-300">
              <ChevronRight size={18} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
