'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchableSelect } from '@/components/public/SearchableSelect';
import { PERFORMANCE_LEVELS } from '@/lib/public/constants';

/**
 * Management-type and SQAAF-rating filters for the Find-a-School results.
 *
 * The parameter names, values, labels and translations are the School Directory's —
 * `type` over the three management types, `performance` over the three rating bands.
 * A parent who has used one page finds the other already familiar, and neither page
 * needs its own copy of the strings.
 *
 * Patches the query string in place rather than rebuilding it from a fixed list of
 * keys, which is what DirectoryFilters does. This page also carries the child's date
 * of birth, sex, special-needs answer, fee range and sort order, and rebuilding would
 * silently discard the wizard's answers on the first click of a filter.
 */
export function ResultsFilterSelects() {
  const t = useTranslations('directory');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <SearchableSelect
        value={searchParams.get('type') ?? ''}
        onChange={(v) => set('type', v)}
        options={[
          { value: 'Government', label: t('typeGovernment') },
          { value: 'Aided', label: t('typeAided') },
          { value: 'Private', label: t('typePrivate') },
        ]}
        allLabel={t('allTypes')}
        placeholderLabel={t('filterType')}
        searchable={false}
        ariaLabel={t('filterType')}
        className="w-[190px]"
        buttonClassName="px-3 py-1.5 text-sm"
      />

      {/* Uday, Unnat and Utkarsh are shown untranslated because they are the band
          names themselves, not English words with Hindi equivalents. */}
      <SearchableSelect
        value={searchParams.get('performance') ?? ''}
        onChange={(v) => set('performance', v)}
        options={PERFORMANCE_LEVELS.map((level) => ({ value: level, label: level }))}
        allLabel={t('allPerformance')}
        placeholderLabel={t('filterPerformance')}
        searchable={false}
        ariaLabel={t('filterPerformance')}
        className="w-[180px]"
        buttonClassName="px-3 py-1.5 text-sm"
      />
    </>
  );
}
