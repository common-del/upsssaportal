import { getTranslations, getLocale } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import { prisma } from '@/lib/db';
import { SchoolRatingFlow, type RatingSchoolRow } from '@/components/public/SchoolRatingFlow';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import { getDummyNearbySchools } from '@/lib/public/nearbyDummyData';
import { SCHOOLS, ALL_DISTRICTS } from '@/lib/public/dummyData';
import type { Prisma } from '@prisma/client';

/** A block can hold more than a panel's worth of schools; the list is scrollable
 * but still bounded, and the page says so rather than silently truncating. */
const SCHOOL_LIMIT = 100;
/** Size of the pool the illustrative "near me" distances are drawn from. */
const NEARBY_POOL = 15;

type GeoRow = { code: string; nameEn: string; nameHi: string };
type BlockRow = GeoRow & { districtCode: string };

export default async function SchoolRatingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('rating');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const hi = locale === 'hi';

  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const q = ((searchParams.q as string) || '').trim();
  const nearMe = searchParams.nearMe === '1';
  const wholeDistrict = searchParams.all === '1';

  // Mirrors the client's own condition for showing the school list, so the server
  // only pays for a school query when that list is actually rendered.
  const needSchools = Boolean(q) || Boolean(block) || wholeDistrict;

  let districts: GeoRow[] = [];
  let blocks: BlockRow[] = [];
  let schools: RatingSchoolRow[] = [];
  let totalMatches = 0;
  let nearbyPool: RatingSchoolRow[] = [];
  let usingFallback = false;

  try {
    const [districtRecords, blockRecords] = await Promise.all([
      prisma.district.findMany({ orderBy: { nameEn: 'asc' } }),
      district
        ? prisma.block.findMany({ where: { districtCode: district }, orderBy: { nameEn: 'asc' } })
        : Promise.resolve([]),
    ]);

    districts = districtRecords.map((d) => ({
      code: d.code,
      nameEn: d.nameEn,
      nameHi: d.nameHi,
    }));
    blocks = blockRecords.map((b) => ({
      code: b.code,
      districtCode: b.districtCode,
      nameEn: b.nameEn,
      nameHi: b.nameHi,
    }));

    const where: Prisma.SchoolWhereInput = {};
    if (district && !q) where.districtCode = district;
    if (block && !q) where.blockCode = block;
    if (q) {
      where.OR = [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameHi: { contains: q } },
        { udise: { contains: q } },
        { block: { nameEn: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const toRow = (s: {
      udise: string;
      nameEn: string;
      nameHi: string;
      district: { nameEn: string; nameHi: string };
      block: { nameEn: string; nameHi: string };
    }): RatingSchoolRow => {
      const extra = deriveResultFields(s.udise);
      return {
        udise: s.udise,
        name: hi ? s.nameHi : s.nameEn,
        districtName: hi ? s.district.nameHi : s.district.nameEn,
        blockName: hi ? s.block.nameHi : s.block.nameEn,
        type: extra.type,
        performanceLevel: extra.performanceLevel,
        overallScore: extra.overallScore,
      };
    };

    if (needSchools) {
      const [matches, count] = await Promise.all([
        prisma.school.findMany({
          where,
          include: { district: true, block: true },
          orderBy: { nameEn: 'asc' },
          take: SCHOOL_LIMIT,
        }),
        prisma.school.count({ where }),
      ]);
      schools = matches.map(toRow);
      totalMatches = count;
    }

    if (nearMe) {
      const pool = await prisma.school.findMany({
        where: district ? { districtCode: district } : {},
        include: { district: true, block: true },
        orderBy: { nameEn: 'asc' },
        take: NEARBY_POOL,
      });
      nearbyPool = pool.map(toRow);
    }
  } catch {
    usingFallback = true;
    districts = ALL_DISTRICTS.map((name) => ({ code: name, nameEn: name, nameHi: name }));
    blocks = district
      ? [...new Set(SCHOOLS.filter((s) => s.district === district).map((s) => s.block))]
          .sort()
          .map((name) => ({ code: name, districtCode: district, nameEn: name, nameHi: name }))
      : [];

    const needle = q.toLowerCase();
    const matched = SCHOOLS.filter((s) => {
      if (q) {
        return (
          s.name.toLowerCase().includes(needle) ||
          s.udise.includes(q) ||
          s.block.toLowerCase().includes(needle)
        );
      }
      if (district && s.district !== district) return false;
      if (block && s.block !== block) return false;
      return true;
    }).map(
      (s): RatingSchoolRow => ({
        udise: s.udise,
        name: s.name,
        districtName: s.district,
        blockName: s.block,
        type: s.type,
        performanceLevel: s.performanceLevel,
        overallScore: s.overallScore,
      }),
    );

    totalMatches = needSchools ? matched.length : 0;
    schools = needSchools ? matched.slice(0, SCHOOL_LIMIT) : [];
    nearbyPool = nearMe
      ? matched.slice(0, NEARBY_POOL).length > 0
        ? matched.slice(0, NEARBY_POOL)
        : SCHOOLS.slice(0, NEARBY_POOL).map((s) => ({
            udise: s.udise,
            name: s.name,
            districtName: s.district,
            blockName: s.block,
            type: s.type,
            performanceLevel: s.performanceLevel,
            overallScore: s.overallScore,
          }))
      : [];
  }

  const nearbySchools = nearMe ? getDummyNearbySchools(nearbyPool, NEARBY_POOL) : [];
  const truncated = totalMatches > schools.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton
        fallbackHref="/public"
        label={tc('back')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
      />

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">{t('intro')}</p>

      {usingFallback && (
        <p className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600">
          {t('fallbackNotice')}
        </p>
      )}

      <div className="mt-6">
        <SchoolRatingFlow
          districts={districts}
          blocks={blocks}
          schools={schools}
          selected={{ district, block, q }}
          wholeDistrict={wholeDistrict}
          nearMe={nearMe}
          nearbySchools={nearbySchools}
          locale={locale}
        />
      </div>

      {truncated && (
        <p className="mt-4 text-xs text-text-secondary">
          {t('truncated', {
            shown: schools.length,
            total: totalMatches.toLocaleString('en-IN'),
          })}
        </p>
      )}
    </div>
  );
}
