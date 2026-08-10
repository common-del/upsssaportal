import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { DirectoryFilters } from '@/components/public/DirectoryFilters';
import { CycleFunnel, BehindBlocks } from '@/components/sssa/CycleFunnel';
import { SchoolsTabs, type SchoolsTab } from '@/components/sssa/SchoolsTabs';
import { lastRemindedByBlock } from '@/lib/actions/reminders';
import { buildCycleCounts, buildBehindBlocks, type CycleCounts, type BehindBlock } from '@/lib/sssa/cycleCounts';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import { MANAGEMENT_LABELS_SHORT, isManagementCode } from '@/lib/schoolManagement';
import { SCHOOLS, ALL_DISTRICTS } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

/**
 * A score over the band it falls in, or a dash where there is no score yet.
 *
 * One decimal, matching Verification: a school can sit a tenth of a point either
 * side of a boundary, and rounding to whole numbers hides which side. The dash is
 * not a zero — it means the school has not submitted, or no verifier has been.
 *
 * The band arrives already resolved rather than being computed here from thresholds
 * typed into this file. Two hardcoded copies of the cutoffs is how the portal came
 * to grade the same school Uday on the public site and Satisfactory to an officer.
 */
function ScoreCell({ score, band }: { score: number | null; band: string | null }) {
  if (score == null) return <span className="text-gray-300">—</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-bold tabular-nums text-gray-900">{score.toFixed(1)}</span>
      {band && <span className="text-[11px] text-gray-500">{band}</span>}
    </span>
  );
}

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
  /** Who runs the school, from School.management. Null where the UDISE extract has
   *  not been imported — shown as unknown rather than filed under a guess. */
  management: string | null;
  /** The cycle's scores. Null before a school submits, and the verified one stays
   *  null until a verifier does. Bands come from the framework's GradeBand rows, so
   *  this page cannot disagree with Verification about where 55 and 80 sit. */
  selfScore: number | null;
  selfBand: string | null;
  verifiedScore: number | null;
  verifiedBand: string | null;
};

export default async function SssaSchoolDirectoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  const tab: SchoolsTab = (searchParams.tab as string) === 'behind' ? 'behind' : 'register';
  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const category = (searchParams.category as string) || '';
  const type = (searchParams.type as string) || '';
  const performance = (searchParams.performance as string) || '';
  const q = (searchParams.q as string) || '';
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  let districts: { code: string; nameEn: string; nameHi: string }[] = [];
  let blocks: { code: string; nameEn: string; nameHi: string }[] = [];
  let rows: DirectoryRow[] = [];
  let usingFallback = false;
  let funnel: CycleCounts | null = null;
  let behind: BehindBlock[] = [];
  let lastReminded: Record<string, string> = {};

  try {
    [funnel, behind, lastReminded] = await Promise.all([
      buildCycleCounts(),
      buildBehindBlocks(district),
      // Only needed by the Furthest behind tab, so it is not paid for on the
      // register, which is the tab most visits land on.
      tab === 'behind' ? lastRemindedByBlock() : Promise.resolve({}),
    ]);

    const districtRecords = await prisma.district.findMany({ orderBy: { nameEn: 'asc' } });
    districts = districtRecords.map((d) => ({ code: d.code, nameEn: d.nameEn, nameHi: d.nameHi }));

    // Only the chosen district's blocks, so the two filters cannot contradict each
    // other. With no district picked the list would be 826 entries, which is not a
    // filter anybody can use — so it stays empty until a district narrows it.
    if (district) {
      const blockRecords = await prisma.block.findMany({
        where: { districtCode: district },
        orderBy: { nameEn: 'asc' },
      });
      blocks = blockRecords.map((b) => ({ code: b.code, nameEn: b.nameEn, nameHi: b.nameHi }));
    }

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

    const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
    const gradeBands = cycle
      ? await prisma.gradeBand.findMany({
          where: { framework: { cycleId: cycle.id } },
          select: { labelEn: true, minPercent: true, maxPercent: true },
          orderBy: { order: 'asc' },
        })
      : [];

    /** Upper bound exclusive except on the top band, matching computeAndStoreResult. */
    const bandFor = (score: number | null): string | null => {
      if (score == null) return null;
      for (let i = 0; i < gradeBands.length; i++) {
        const b = gradeBands[i]!;
        const last = i === gradeBands.length - 1;
        if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) {
          return b.labelEn;
        }
      }
      return null;
    };

    const matches = await prisma.school.findMany({
      where,
      include: {
        district: true,
        block: true,
        // At most one row: Result is unique on (cycleId, schoolUdise). Joined here
        // rather than queried per page, because the filter and sort below run over
        // the whole match set before anything is sliced.
        results: cycle
          ? {
              where: { cycleId: cycle.id },
              select: { selfScorePercent: true, verifierScorePercent: true },
              take: 1,
            }
          : false,
      },
      orderBy: { nameEn: 'asc' },
    });

    rows = matches.map((s) => {
      // Real management value where we have it, so the Type column stops being a
      // hash of the UDISE.
      const extra = deriveResultFields(s.udise, s.management);
      const result = 'results' in s ? s.results?.[0] : undefined;
      return {
        id: s.id,
        udise: s.udise,
        nameEn: s.nameEn,
        districtName: s.district.nameEn,
        blockName: s.block.nameEn,
        management: s.management,
        selfScore: result?.selfScorePercent ?? null,
        selfBand: bandFor(result?.selfScorePercent ?? null),
        verifiedScore: result?.verifierScorePercent ?? null,
        verifiedBand: bandFor(result?.verifierScorePercent ?? null),
        ...extra,
      };
    });
  } catch {
    usingFallback = true;
    districts = ALL_DISTRICTS.map((name) => ({ code: name, nameEn: name, nameHi: name }));
    rows = SCHOOLS.filter((s) => !district || s.district === district)
      .filter((s) => !block || s.block === block)
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
        // The dummy set predates management and the score columns, so these read
        // as unknown rather than borrowing a value from the demo data.
        management: null,
        selfScore: null,
        selfBand: null,
        verifiedScore: null,
        verifiedBand: null,
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
    if (block) params.set('block', block);
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
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
        <p className="mt-1 text-sm text-gray-500">The register and cycle progress</p>
      </header>

      {/* The counts sit above the tabs because both tabs are views of the register
          — inside one of them they would read as describing only that view. */}
      {funnel && <CycleFunnel counts={funnel} />}

      <SchoolsTabs
        active={tab}
        registerCount={funnel?.totalSchools ?? 0}
        behindCount={behind.length}
        query={{ district, block, q }}
      />

      {tab === 'behind' && (
        <BehindBlocks
          blocks={behind}
          district={district}
          districts={districts}
          lastReminded={lastReminded}
        />
      )}

      {tab === 'register' && (
        <>
      {usingFallback && (
        <p className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          Live school records are temporarily unavailable. Showing a sample of schools instead.
        </p>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {/* School, district and block. An officer arrives knowing one of the three;
            class, management and rating were furniture they had to read past. */}
        <DirectoryFilters
          districts={districts}
          blocks={blocks}
          selected={{ district, block, category, type, performance, q }}
          locale={locale}
          show={{ district: true, block: true, type: false, category: false, performance: false }}
        />
      </div>

      <p className="text-sm text-gray-600">
        {total > 0 ? `${total.toLocaleString('en-IN')} schools found` : 'No schools found'}
      </p>

      {total > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Management</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3 text-right">Self assessed</th>
                <th className="px-4 py-3 text-right">Verified</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.nameEn}
                    {/* UDISE moves under the name rather than taking a column of its
                        own. It is an identifier you copy or search by, not something
                        anyone reads across a row. */}
                    <span className="mt-0.5 block font-mono text-[11px] font-normal text-gray-400">
                      {r.udise}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.districtName}</td>
                  <td className="px-4 py-3">{r.blockName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isManagementCode(r.management) ? (
                      MANAGEMENT_LABELS_SHORT[r.management]
                    ) : (
                      // Not filed under a guess. A school whose UDISE extract has not
                      // been imported has no management value, and inventing one here
                      // is how the old Type column came to be a hash of the UDISE.
                      <span className="text-gray-400">Not recorded</span>
                    )}
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
                  {/* Accreditation is gone: it read SQAAF Verified or Pending, which
                      is the same fact the Verified score now carries — a score means a
                      verifier has been, a dash means they have not. */}
                  <td className="px-4 py-3 text-right">
                    <ScoreCell score={r.selfScore} band={r.selfBand} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreCell score={r.verifiedScore} band={r.verifiedBand} />
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
        </>
      )}
    </div>
  );
}
