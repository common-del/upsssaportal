import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import { prisma } from '@/lib/db';
import {
  buildSchoolProfileData,
  getDummySchoolRecord,
} from '@/lib/public/schoolProfile';
import { toDomainScoreRecord } from '@/components/public/CompareReportCard';
import { CompareSearchFlow } from '@/components/public/CompareSearchFlow';
import {
  MAX_COMPARE,
  OVERVIEW_DISTRICTS,
  compareBlocksForDistrict,
  compareSchoolsByUdise,
  searchCompareSchools,
} from '@/lib/public/stateOverviewData';

export default async function ComparePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const tc = await getTranslations('common');

  const query = ((searchParams.q as string) || '').trim();
  const district = (searchParams.district as string) || '';
  const block = (searchParams.block as string) || '';
  const rawBack = (searchParams.back as string) || '';
  // Only same-origin paths, so the parameter can't be used to bounce elsewhere.
  const backHref = rawBack.startsWith('/') && !rawBack.startsWith('//') ? rawBack : '';

  // Selection travels in the URL, so a comparison can be shared or reloaded and
  // the ~3,000-school search pool never reaches the browser.
  const selectedUdises = ((searchParams.sel as string) || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  // The generated pool only holds this page's own 9CMP placeholder schools, so a
  // real UDISE arriving from Find-a-School results or a school profile would
  // silently resolve to nothing. Anything the pool misses is derived from the
  // school record instead, the same way the profile panel does it.
  const fromPool = compareSchoolsByUdise(selectedUdises);
  const resolved = new Map(fromPool.map((s) => [s.udise, s]));
  const missing = selectedUdises.filter((u) => !resolved.has(u));

  if (missing.length > 0) {
    // One query for all of them, not one each.
    let records: { udise: string; nameEn: string; district: { nameEn: string }; block: { nameEn: string } }[] = [];
    try {
      records = await prisma.school.findMany({
        where: { udise: { in: missing } },
        include: { district: true, block: true },
      });
    } catch {
      // fall through to the dummy lookup
    }
    const byUdise = new Map(records.map((r) => [r.udise, r]));

    for (const udise of missing) {
      const record = byUdise.get(udise);
      const dummy = record ? null : getDummySchoolRecord(udise);
      if (!record && !dummy) continue;

      const name = record ? record.nameEn : dummy!.name;
      const districtName = record ? record.district.nameEn : dummy!.district;
      const blockName = record ? record.block.nameEn : dummy!.block;

      const profile = buildSchoolProfileData({
        udise,
        name,
        district: districtName,
        block: blockName,
      });
      resolved.set(udise, {
        udise,
        name: profile.name,
        district: profile.district,
        block: blockName,
        type: profile.type,
        level: profile.classes,
        overallScore: profile.overallScore,
        performanceLevel: profile.performanceLevel,
        domainScores: toDomainScoreRecord(profile.reportCard.domainScores),
      });
    }
  }

  // Preserve the order they were picked in.
  const selected = selectedUdises.flatMap((u) => {
    const hit = resolved.get(u);
    return hit ? [hit] : [];
  });
  const suggestions = searchCompareSchools(query, { district, block });
  const blocks = district ? compareBlocksForDistrict(district) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* One back control, never two. Where the visitor arrived from their Find-a-School
          matches the URL carries that page, and naming the destination beats a bare
          "Back"; with no such parameter there is nothing to name, so browser history
          does the work instead. Both render with the same classes so the page does not
          shift depending on how it was reached. */}
      {backHref ? (
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
        >
          <ArrowLeft size={16} aria-hidden />
          {tc('backToMatches')}
        </Link>
      ) : (
        <BackButton
          fallbackHref="/public"
          label={tc('back')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
        />
      )}

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Compare Schools</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        Search for the schools you want to look at, up to {MAX_COMPARE} at a time, and see their
        SQAAF scores domain by domain. All figures on this page are placeholder data.
      </p>

      <CompareSearchFlow
        query={query}
        district={district}
        block={block}
        districts={OVERVIEW_DISTRICTS}
        blocks={blocks}
        suggestions={suggestions}
        selected={selected}
      />
    </div>
  );
}
