import { getTranslations } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
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

  // Selection travels in the URL, so a comparison can be shared or reloaded and
  // the ~3,000-school search pool never reaches the browser.
  const selectedUdises = ((searchParams.sel as string) || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  const selected = compareSchoolsByUdise(selectedUdises);
  const suggestions = searchCompareSchools(query, { district, block });
  const blocks = district ? compareBlocksForDistrict(district) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton
        fallbackHref="/public"
        label={tc('back')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
      />

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
