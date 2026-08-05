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

  const selectClass =
    'rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Search by name</p>
        <div className="relative mt-2">
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
        <p className="mt-2 text-xs text-text-secondary">
          Results update automatically as you type — matches name or UDISE code.
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Browse by district</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <SearchableSelect
            value={selected.district}
            onChange={(v) => navigate({ district: v })}
            options={districts.map((d) => ({ value: d.code, label: getName(d) }))}
            allLabel={t('allDistricts')}
            searchPlaceholder={t('district')}
            ariaLabel={t('district')}
            className="w-[180px]"
            buttonClassName="py-2.5"
          />

          <select
            value={selected.type}
            onChange={(e) => navigate({ type: e.target.value })}
            className={selectClass}
            aria-label={t('type')}
          >
            <option value="">{t('allTypes')}</option>
            <option value="Government">{t('typeGovernment')}</option>
            <option value="Aided">{t('typeAided')}</option>
            <option value="Private">{t('typePrivate')}</option>
          </select>

          <select
            value={selected.category}
            onChange={(e) => navigate({ category: e.target.value })}
            className={selectClass}
            aria-label={t('class')}
          >
            <option value="">{t('allClasses')}</option>
            <option value="Primary">{t('catPrimary')}</option>
            <option value="Upper Primary">{t('catUpperPrimary')}</option>
            <option value="Secondary">{t('catSecondary')}</option>
            <option value="Higher Secondary">{t('catHigherSecondary')}</option>
          </select>

          <select
            value={selected.performance}
            onChange={(e) => navigate({ performance: e.target.value })}
            className={selectClass}
            aria-label={t('performance')}
          >
            <option value="">{t('allPerformance')}</option>
            <option value="Uday">Uday</option>
            <option value="Unnat">Unnat</option>
            <option value="Utkarsh">Utkarsh</option>
          </select>
        </div>
      </div>
    </div>
  );
}
