import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { DirectoryFilters } from '@/components/public/DirectoryFilters';
import { deriveResultFields, DIRECTORY_LEVEL_BADGE } from '@/lib/public/schoolProfile';
import { SCHOOLS } from '@/lib/public/dummyData';
import { DISTRICTS } from '@/lib/public/constants';
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
    districts = DISTRICTS.map((name) => ({ code: name, nameEn: name, nameHi: name }));
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/public" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline">
        <ArrowLeft size={16} /> {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">{t('title')}</h1>

      {usingFallback && (
        <p className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          Live school records are temporarily unavailable. Showing a sample of schools instead.
        </p>
      )}

      <div className="mt-6 rounded-xl border-l-4 border-[#1B2A6B] bg-white p-4 shadow-sm">
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
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">{t('name')}</th>
                <th className="px-4 py-3 font-medium">{t('udise')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('district')}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('block')}</th>
                <th className="px-4 py-3 font-medium">{t('type')}</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Accreditation</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/public/schools/${r.udise}`}
                      className="font-medium text-[#1B2A6B] hover:underline"
                    >
                      {hi ? r.nameHi : r.nameEn}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.udise}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{r.districtName}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{r.blockName}</td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${DIRECTORY_LEVEL_BADGE[r.performanceLevel]}`}
                    >
                      {r.performanceLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.feeDisclosed ? (
                      <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#92400E]">
                        Disclosed
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Not Disclosed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.accreditation === 'SQAAF Verified' ? (
                      <span className="whitespace-nowrap rounded-full bg-[#F5B731] px-2.5 py-0.5 text-xs font-semibold text-[#1B2A6B]">
                        SQAAF Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
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
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-border px-4 py-2 text-[#1B2A6B] transition-colors hover:bg-surface"
            >
              {t('prev')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text-secondary">{t('page', { page, totalPages })}</span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-border px-4 py-2 text-[#1B2A6B] transition-colors hover:bg-surface"
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
