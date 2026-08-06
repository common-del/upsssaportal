'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SearchableSelect } from '@/components/public/SearchableSelect';

interface FilterOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface Selected {
  district: string;
  category: string;
  type: string;
  performance: string;
  q: string;
}

interface Props {
  districts: FilterOption[];
  selected: Selected;
  locale: string;
}

export function DirectoryFilters({ districts, selected, locale }: Props) {
  const t = useTranslations('directory');
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getName = (item: FilterOption) => (locale === 'hi' ? item.nameHi : item.nameEn);

  function navigate(updates: Partial<Selected>) {
    const merged = { ...selected, ...updates };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Instant-feeling search: auto-navigates a beat after typing stops, so
  // parents don't have to press Enter to see results update.
  function handleSearchInput(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: value }), 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    // One plain row on the page background - no cards, no accent bar. The
    // search box takes the spare width; the four selects wrap beneath it on
    // narrow screens.
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1 basis-full sm:basis-auto">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          ref={searchRef}
          type="text"
          key={selected.q}
          defaultValue={selected.q}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          onChange={(e) => handleSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              navigate({ q: (e.target as HTMLInputElement).value });
            }
          }}
          aria-label={t('searchPlaceholder')}
        />
      </div>

      {/* All four are SearchableSelect rather than a mix of that and native
          <select>. A native select can only display its selected option, so it
          cannot read "Management Type" while unset AND offer a separate
          "All Management Types" row - the two requests only reconcile with a
          controlled listbox. Search box off for the short lists. */}
      <SearchableSelect
        value={selected.district}
        onChange={(v) => navigate({ district: v })}
        options={districts.map((d) => ({ value: d.code, label: getName(d) }))}
        allLabel={t('allDistricts')}
        placeholderLabel={t('filterDistrict')}
        searchPlaceholder={t('district')}
        ariaLabel={t('filterDistrict')}
        className="w-[170px]"
        buttonClassName="py-2.5"
      />

      <SearchableSelect
        value={selected.type}
        onChange={(v) => navigate({ type: v })}
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
        buttonClassName="py-2.5"
      />

      <SearchableSelect
        value={selected.category}
        onChange={(v) => navigate({ category: v })}
        options={[
          { value: 'Primary', label: t('catPrimary') },
          { value: 'Upper Primary', label: t('catUpperPrimary') },
          { value: 'Secondary', label: t('catSecondary') },
          { value: 'Higher Secondary', label: t('catHigherSecondary') },
        ]}
        allLabel={t('allClasses')}
        placeholderLabel={t('filterClass')}
        searchable={false}
        ariaLabel={t('filterClass')}
        className="w-[170px]"
        buttonClassName="py-2.5"
      />

      <SearchableSelect
        value={selected.performance}
        onChange={(v) => navigate({ performance: v })}
        options={[
          { value: 'Uday', label: 'Uday' },
          { value: 'Unnat', label: 'Unnat' },
          { value: 'Utkarsh', label: 'Utkarsh' },
        ]}
        allLabel={t('allPerformance')}
        placeholderLabel={t('filterPerformance')}
        searchable={false}
        ariaLabel={t('filterPerformance')}
        className="w-[180px]"
        buttonClassName="py-2.5"
      />
    </div>
  );
}
