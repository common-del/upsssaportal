import Link from 'next/link';
import { prisma } from '@/lib/db';
import { RegisterFilters } from '@/components/sssa/RegisterFilters';
import { CycleFunnel } from '@/components/sssa/CycleFunnel';
import { buildCycleCounts, type CycleCounts } from '@/lib/sssa/cycleCounts';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import { MANAGEMENT_CODES, MANAGEMENT_LABELS_SHORT, isManagementCode } from '@/lib/schoolManagement';
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
/** The framework's three bands, lowest first, with the colour each carries across the portal. */
const BAND_STYLE: Record<string, string> = {
  Uday: 'bg-[#FBF1DE] text-[#7A5209]',
  Unnat: 'bg-[#EDF1F8] text-[#1B2A6B]',
  Utkarsh: 'bg-[#E7F5EE] text-[#14603A]',
};

/**
 * Where a school stands: the band as a pill, the score small beneath it.
 *
 * The band is what an officer reads down a page; the score is what they check once a row has
 * caught their eye. A school that has not submitted takes the same column as a fourth value,
 * because it answers the same question, in grey because it is an absence rather than a grade.
 */
function BandCell({ score, band }: { score: number | null; band: string | null }) {
  if (score == null) {
    return (
      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
        Not submitted
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start leading-tight">
      <span
        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          band ? (BAND_STYLE[band] ?? 'bg-gray-100 text-gray-700') : 'bg-gray-100 text-gray-700'
        }`}
      >
        {band ?? 'Scored'}
      </span>
      <span className="mt-0.5 pl-1 text-[11px] tabular-nums text-gray-400">{score.toFixed(1)}</span>
    </span>
  );
}

/**
 * Who gave the grade beside it.
 *
 * This is the column that makes one grade column safe. Utkarsh claimed by a school and Utkarsh
 * found by a verifier are not the same fact, so Verified is solid and Self-assessed is
 * outlined: a glance down the column separates findings from claims.
 */
function StatusCell({ status }: { status: 'VERIFIED' | 'SELF' | null }) {
  if (status === null) return <span className="text-gray-300">—</span>;
  return status === 'VERIFIED' ? (
    <span className="whitespace-nowrap rounded-full bg-[#14603A] px-2.5 py-0.5 text-[11px] font-bold text-white">
      Verified
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full border-2 border-[#B9C4D8] px-2.5 py-0.5 text-[11px] font-bold text-[#5F7190]">
      Self-assessed
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
  /** Who runs the school, from School.management. Null where the UDISE extract has
   *  not been imported — shown as unknown rather than filed under a guess. */
  management: string | null;
  /** Where the school stands, and who says so.
   *
   *  One grade rather than two columns of scores: a verifier's figure replaces the school's
   *  own rather than sitting beside it, so once a verification exists the school's claim is no
   *  longer the answer to "where does this school stand". `status` is what keeps that honest —
   *  Utkarsh claimed and Utkarsh found are not the same fact, and the column says which.
   *
   *  Bands come from the framework's GradeBand rows, so this page cannot disagree with
   *  Verification about where 55 and 80 sit. Null band and null status mean nothing submitted.
   *
   *  The school's own score is still read, to fall back on before a verifier has been, but it
   *  is no longer shown beside the verified one. The gap between the two is Monitoring's
   *  question, and it has an exception group for it. */
  score: number | null;
  band: string | null;
  status: 'VERIFIED' | 'SELF' | null;
};

export default async function SssaSchoolDirectoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;

  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const category = (searchParams.category as string) || '';
  const type = (searchParams.type as string) || '';
  const performance = (searchParams.performance as string) || '';
  // The six filters SSSA asked for. category, type and performance stay readable from the URL
  // because other pages link in with them, but they have no control on this bar.
  const management = (searchParams.management as string) || '';
  const sqaaf = (searchParams.sqaaf as string) || '';
  const status = (searchParams.status as string) || '';
  const sort = (searchParams.sort as string) || '';
  const q = (searchParams.q as string) || '';
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  let districts: { code: string; nameEn: string; nameHi: string }[] = [];
  let blocks: { code: string; nameEn: string; nameHi: string }[] = [];
  let rows: DirectoryRow[] = [];
  let usingFallback = false;
  let funnel: CycleCounts | null = null;
  /** The framework's band labels, lifted out of the try so the filter menu can offer exactly
   *  the grades the table prints. Empty when there is no active cycle, which leaves the menu
   *  with "Not submitted" alone rather than inventing bands. */
  let bandLabels: string[] = [];

  try {
    funnel = await buildCycleCounts();

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
    if (management) where.management = management;
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

    bandLabels = gradeBands.map((b) => b.labelEn);

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
      const verified = result?.verifierScorePercent ?? null;
      const self = result?.selfScorePercent ?? null;
      // The verifier's figure wins where there is one. That is what makes a single grade
      // column possible, and what the status column then has to declare.
      const score = verified ?? self;
      return {
        id: s.id,
        udise: s.udise,
        nameEn: s.nameEn,
        districtName: s.district.nameEn,
        blockName: s.block.nameEn,
        management: s.management,
        score,
        band: bandFor(score),
        status: verified !== null ? ('VERIFIED' as const) : self !== null ? ('SELF' as const) : null,
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
        // The dummy set predates management and the score columns, so these read
        // as unknown rather than borrowing a value from the demo data.
        management: null,
        score: null,
        band: null,
        status: null,
      }));
  }

  // Grade and status are derived from the scores, so they filter after the rows are built
  // rather than in the query. The page already fetches the whole match set before slicing a
  // page out of it, so the count below stays right.
  const filtered = rows.filter((r) => {
    if (type && r.type !== (type as SchoolType)) return false;
    if (performance && r.performanceLevel !== (performance as PerformanceLevel)) return false;
    if (sqaaf === 'NOT_SUBMITTED' ? r.band !== null : sqaaf && r.band !== sqaaf) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  // Order runs after the filter and before the slice, so page 1 really is the top of the whole
  // match set rather than the top of whatever twenty rows came back first.
  //
  // A school with no score sits at the end of both orders. It is not the lowest scoring school
  // in the state, it is one nobody has scored, and sorting it to the bottom of "lowest first"
  // would put unscored schools in front of the ones the Authority is looking for.
  const ordered =
    sort === 'score_desc' || sort === 'score_asc'
      ? [...filtered].sort((a, b) => {
          if (a.score === null && b.score === null) return a.nameEn.localeCompare(b.nameEn);
          if (a.score === null) return 1;
          if (b.score === null) return -1;
          return sort === 'score_desc' ? b.score - a.score : a.score - b.score;
        })
      : filtered;

  const total = ordered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (block) params.set('block', block);
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (performance) params.set('performance', performance);
    if (management) params.set('management', management);
    if (sqaaf) params.set('sqaaf', sqaaf);
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
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

      {/* The tab strip is gone. Furthest behind moved to Monitoring, where a table of blocks
          with a chase button belongs, and Compliance folded into the register, so there is one
          view left and a strip with one tab is furniture. */}
      {funnel && <CycleFunnel counts={funnel} />}

      {usingFallback && (
        <p className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          Live school records are temporarily unavailable. Showing a sample of schools instead.
        </p>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {/* One control per column the register can be asked about, in column order. Fee has a
            column and no menu: it is worth seeing on a row and is not a question anyone asks of
            all 32,579. */}
        <RegisterFilters
          selected={{ q, district, block, management, sqaaf, status, sort }}
          districts={districts.map((d) => ({ value: d.code, label: d.nameEn }))}
          blocks={blocks.map((b) => ({ value: b.code, label: b.nameEn }))}
          managements={MANAGEMENT_CODES.map((c) => ({ value: c, label: MANAGEMENT_LABELS_SHORT[c] }))}
          // The framework's own labels, so the menu cannot offer a band the table never prints.
          bands={[
            ...bandLabels.map((b) => ({ value: b, label: b })),
            { value: 'NOT_SUBMITTED', label: 'Not submitted' },
          ]}
          total={rows.length}
          matched={total}
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
                <th className="px-4 py-3">SQAAF</th>
                <th className="px-4 py-3">Status</th>
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
                  <td className="px-4 py-3">
                    <BandCell score={r.score} band={r.band} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell status={r.status} />
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
