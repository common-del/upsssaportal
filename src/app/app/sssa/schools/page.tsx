import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { DirectoryFilters } from '@/components/public/DirectoryFilters';
import { deriveResultFields, DIRECTORY_LEVEL_BADGE } from '@/lib/public/schoolProfile';
import { SCHOOLS, ALL_DISTRICTS } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

type DirectoryRow = {
  id: string;
  udise: string;
  nameEn: string;
  districtName: string;
  blockName: string;
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  feeDisclosed: boolean;
  accreditation: 'SQAAF Verified' | 'Pending';
};

export default async function SssaSchoolDirectoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

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
        districtName: s.district.nameEn,
        blockName: s.block.nameEn,
        ...extra,
      };
    });
  } catch {
    usingFallback = true;
    districts = ALL_DISTRICTS.map((name) => ({ code: name, nameEn: name, nameHi: name }));
    rows = SCHOOLS.filter((s) => !district || s.district === district)
      .filter((s) => !category || s.level === category)
      .filter(
        (s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.udise.includes(q),
      )
      .map((s) => ({
        id: s.id,
        udise: s.udise,
        nameEn: s.name,
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
    return `/app/sssa/schools${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">School Directory</h1>
      </header>

      {usingFallback && (
        <p className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          Live school records are temporarily unavailable. Showing a sample of schools instead.
        </p>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <DirectoryFilters
          districts={districts}
          selected={{ district, category, type, performance, q }}
          locale={locale}
        />
      </div>

      <p className="text-sm text-gray-600">
        {total > 0 ? `${total.toLocaleString('en-IN')} schools found` : 'No schools found'}
      </p>

      {total > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3">UDISE</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Accreditation</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.nameEn}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.udise}</td>
                  <td className="px-4 py-3">{r.districtName}</td>
                  <td className="px-4 py-3">{r.blockName}</td>
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
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
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
                      <span className="whitespace-nowrap rounded-full bg-[#1B2A6B] px-2.5 py-0.5 text-xs font-semibold text-white">
                        SQAAF Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/app/sssa/monitoring/schools/${r.udise}`}
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
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[#1B2A6B] hover:bg-gray-50"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[#1B2A6B] hover:bg-gray-50"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
