import { BackButton } from '@/components/common/BackButton';
import { prisma } from '@/lib/db';
import { computeAge, ageToGrade, gradeLabel } from '@/lib/age-to-grade';
import { ResultsSortSelect } from '@/components/public/ResultsSortSelect';
import { ResultsFilterSelects } from '@/components/public/ResultsFilterSelects';
import { FindResultsTable, type FindResultRow } from '@/components/public/FindResultsTable';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import { SCHOOLS } from '@/lib/public/dummyData';
import { illustrativeDistanceKm } from '@/lib/public/nearbyDummyData';
import { verifiedUdises } from '@/lib/public/verifiedStatus';
import { searchSchools } from '@/lib/actions/findSchools';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 50;

type SortKey = 'name_asc' | 'name_desc' | 'fees_asc' | 'fees_desc' | 'distance_asc';

function buildOrderBy(sort: SortKey): Prisma.SchoolOrderByWithRelationInput[] {
  switch (sort) {
    case 'fees_asc':
      return [{ feesRangeMin: { sort: 'asc', nulls: 'last' } }, { nameEn: 'asc' }];
    case 'fees_desc':
      return [{ feesRangeMax: { sort: 'desc', nulls: 'last' } }, { nameEn: 'asc' }];
    case 'name_desc':
      return [{ nameEn: 'desc' }];
    default:
      return [{ nameEn: 'asc' }];
  }
}

async function loadResults(
  district: string,
  block: string,
  districtName: string,
  blockName: string,
  feesMin?: number,
  feesMax?: number,
  sort: SortKey = 'name_asc',
): Promise<FindResultRow[]> {
  try {
    const where: Prisma.SchoolWhereInput = {};
    if (district) where.districtCode = district;
    if (block) where.blockCode = block;

    if (feesMin !== undefined || feesMax !== undefined) {
      const overlap: Prisma.SchoolWhereInput = {};
      if (feesMax !== undefined) overlap.feesRangeMin = { lte: feesMax };
      if (feesMin !== undefined) overlap.feesRangeMax = { gte: feesMin };
      where.OR = [
        {
          AND: [
            { feesRangeMin: { not: null } },
            { feesRangeMax: { not: null } },
            overlap,
          ],
        },
        { feesRangeMin: null },
        { feesRangeMax: null },
      ];
    }

    const schools = await prisma.school.findMany({
      where,
      select: {
        udise: true,
        nameEn: true,
        feesRangeMin: true,
        feesRangeMax: true,
        // Real management, so the Type column and its filter read GOVERNMENT /
        // AIDED / PRIVATE off the register instead of a hash of the UDISE. The
        // column has been showing the hash: deriveResultFields falls back to it
        // when management is not passed, and this page never passed it.
        management: true,
        district: { select: { nameEn: true } },
        block: { select: { nameEn: true } },
      },
      orderBy: buildOrderBy(sort),
      take: PAGE_SIZE,
    });

    if (schools.length > 0) {
      const verified = await verifiedUdises(schools.map((s) => s.udise));
      return schools.map((s) => {
        const derived = deriveResultFields(s.udise, s.management);
        return {
          udise: s.udise,
          name: s.nameEn,
          districtName: s.district.nameEn,
          blockName: s.block.nameEn,
          distanceKm: illustrativeDistanceKm(s.udise),
          feesMin: s.feesRangeMin,
          feesMax: s.feesRangeMax,
          verified: verified.has(s.udise),
          type: derived.type,
          performanceLevel: derived.performanceLevel,
        };
      });
    }
  } catch {
    // use server action fallback below
  }

  const { schools } = await searchSchools({
    districtCode: district,
    districtName: districtName || district,
    blockCode: block,
    blockName: blockName || block,
    feesMin,
    feesMax,
  });

  // Reached only when the query above failed, so there is no verification record to
  // read. Unverified is the honest default: an unavailable database is not evidence
  // that an inspection happened. No management either, so the type falls back to the
  // hash here — this path only runs when the register is unreachable.
  return schools.map((s) => {
    const derived = deriveResultFields(s.udise);
    return {
      udise: s.udise,
      name: s.name,
      districtName: s.districtName,
      blockName: s.blockName,
      distanceKm: illustrativeDistanceKm(s.udise),
      feesMin: s.feesMin,
      feesMax: s.feesMax,
      verified: false,
      type: derived.type,
      performanceLevel: derived.performanceLevel,
    };
  });
}

function dummyRowsForDistrict(districtName: string, blockName?: string): FindResultRow[] {
  return SCHOOLS.filter(
    (s) =>
      s.district.toLowerCase() === districtName.toLowerCase() ||
      !districtName,
  )
    .filter((s) => !blockName || s.block.toLowerCase().includes(blockName.toLowerCase().split(' ')[0]))
    .map((s) => ({
      udise: s.udise,
      name: s.name,
      districtName: s.district,
      blockName: s.block,
      distanceKm: illustrativeDistanceKm(s.udise),
      feesMin: null,
      feesMax: null,
      // Demo rows, not register rows. Nothing has been verified.
      verified: false,
      // These rows come from the curated dummy list, so deriveResultFields returns
      // that record's own type and level rather than a hash.
      type: s.type,
      performanceLevel: s.performanceLevel,
    }));
}

export default async function FindResultsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;

  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const dob = (searchParams.dob as string) || '';
  const sex = (searchParams.sex as string) || '';
  const specialNeeds = (searchParams.specialNeeds as string) || 'not_applicable';
  const feesMinParam = parseInt((searchParams.feesMin as string) || '', 10);
  const feesMaxParam = parseInt((searchParams.feesMax as string) || '', 10);
  const sort = ((searchParams.sort as string) || 'name_asc') as SortKey;
  // Same parameter names and values as the School Directory's filters, so the two
  // pages stay interchangeable and share their translations.
  const typeFilter = (searchParams.type as string) || '';
  const performanceFilter = (searchParams.performance as string) || '';

  let computedGrade: number | null = null;
  if (dob) {
    const date = new Date(dob);
    if (!Number.isNaN(date.getTime())) {
      computedGrade = ageToGrade(computeAge(date));
    }
  }

  const [districtData, blockData] = await Promise.all([
    district
      ? prisma.district
          .findUnique({ where: { code: district }, select: { nameEn: true } })
          .catch(() => null)
      : null,
    block
      ? prisma.block.findUnique({ where: { code: block }, select: { nameEn: true } }).catch(() => null)
      : null,
  ]);

  const districtName = districtData?.nameEn ?? (searchParams.districtName as string) ?? '';
  const blockName = blockData?.nameEn ?? (searchParams.blockName as string) ?? '';

  const feesMin = Number.isNaN(feesMinParam) ? undefined : feesMinParam;
  const feesMax = Number.isNaN(feesMaxParam) ? undefined : feesMaxParam;

  let rows = await loadResults(district, block, districtName, blockName, feesMin, feesMax, sort);

  if (rows.length === 0 && districtName) {
    rows = dummyRowsForDistrict(districtName, blockName);
  }

  if (sort === 'name_desc') {
    rows = [...rows].sort((a, b) => b.name.localeCompare(a.name));
  }

  // Distance is derived, not a column, so it can only be ordered after fetching.
  if (sort === 'distance_asc') {
    rows = [...rows].sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
  }

  /* Both filters run over the rows rather than in SQL, and deliberately.
     `performanceLevel` is not a column at all — it is derived — so it could not be
     a WHERE clause. Management could be, but filtering it in SQL would let the two
     disagree: a school whose management has never been imported still shows a Type,
     falling back to the hash, and a SQL filter would drop it while the column beside
     the filter went on claiming it was Government. Filtering what is displayed means
     the filter and the column can never contradict each other.

     The cost is that PAGE_SIZE applies before filtering, so in an area with more
     than 50 schools the totals below count only the fetched page. That was already
     true of this page before the filters; wiring the level to Result.gradeBandCode
     is what would let both move into the query. */
  const unfilteredTotal = rows.length;
  if (typeFilter) rows = rows.filter((r) => r.type === (typeFilter as SchoolType));
  if (performanceFilter) {
    rows = rows.filter((r) => r.performanceLevel === (performanceFilter as PerformanceLevel));
  }
  const filtered = rows.length !== unfilteredTotal;

  const total = rows.length;
  const from = total === 0 ? 0 : 1;
  const to = total;

  const sexLabels: Record<string, string> = {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    M: 'Male',
    F: 'Female',
    T: 'Other',
  };

  function sortHref(s: string) {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (block) params.set('block', block);
    if (districtName) params.set('districtName', districtName);
    if (blockName) params.set('blockName', blockName);
    if (dob) params.set('dob', dob);
    if (sex) params.set('sex', sex);
    if (specialNeeds !== 'not_applicable') params.set('specialNeeds', specialNeeds);
    if (feesMin !== undefined) params.set('feesMin', String(feesMin));
    if (feesMax !== undefined) params.set('feesMax', String(feesMax));
    // Carried through, so changing the sort order does not silently clear the filters.
    if (typeFilter) params.set('type', typeFilter);
    if (performanceFilter) params.set('performance', performanceFilter);
    if (s !== 'name_asc') params.set('sort', s);
    const qs = params.toString();
    return `/public/find/results${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton
        fallbackHref="/public/find"
        label="Back to search"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#1B2A6B] hover:underline"
      />

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Search Results</h1>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {districtName && (
            <span>
              <span className="font-medium text-gray-800">District:</span> {districtName}
            </span>
          )}
          {blockName && (
            <span>
              <span className="font-medium text-gray-800">Block:</span> {blockName}
            </span>
          )}
          {sex && (
            <span>
              <span className="font-medium text-gray-800">Sex:</span>{' '}
              {sexLabels[sex] ?? sex}
            </span>
          )}
          {computedGrade !== null && (
            <span>
              <span className="font-medium text-gray-800">Eligible grade:</span>{' '}
              {gradeLabel(computedGrade, 'en')}
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
        Grade-based filtering is not available in demo data. All schools in the selected area are
        shown.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {total > 0 ? `Showing ${from}–${to} of ${total}` : 'Showing 0 of 0'}
          {filtered && (
            <span className="text-gray-400"> · filtered from {unfilteredTotal}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Rendered whatever the result count, unlike the sort control: with no
              matches the filters are the only way back to a non-empty page, so
              hiding them would strand a parent on a dead end. */}
          <ResultsFilterSelects />
        {total > 0 && (
          <ResultsSortSelect
            current={sort}
            sortHrefs={{
              name_asc: sortHref('name_asc'),
              name_desc: sortHref('name_desc'),
              fees_asc: sortHref('fees_asc'),
              fees_desc: sortHref('fees_desc'),
              distance_asc: sortHref('distance_asc'),
            }}
          />
          )}
        </div>
      </div>

      {total > 0 ? (
        <div className="mt-4">
          {/* Note: distances are derived from a hash of the UDISE code and most
              fees are illustrative too - see nearbyDummyData.ts. The on-screen
              caveat that said so was removed on request. Nothing warns a parent
              now, so put one back before this goes in front of real users. */}
          <FindResultsTable rows={rows} backHref={sortHref(sort)} />
        </div>
      ) : (
        <p className="mt-8 text-center text-gray-600">
          {/* Says which of the two situations this is. "No schools found for the
              selected area" in front of an area that has 39 of them, because a filter
              excluded every one, reads as a broken page. */}
          {typeFilter || performanceFilter
            ? 'No schools in this area match those filters. Try clearing one of them.'
            : 'No schools found for the selected area.'}
        </p>
      )}
    </div>
  );
}
