'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useRef } from 'react';
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

  const getName = (item: FilterOption) => (locale === 'hi' ? item.nameHi : item.nameEn);

  function navigate(updates: Partial<Selected>) {
    const merged = { ...selected, ...updates };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    'rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate({ q: (e.target as HTMLInputElement).value });
          }}
          aria-label={t('searchPlaceholder')}
        />
      </div>

      <SearchableSelect
        value={selected.district}
        onChange={(v) => navigate({ district: v })}
        options={districts.map((d) => ({ value: d.code, label: getName(d) }))}
        allLabel={t('allDistricts')}
        searchPlaceholder={t('district')}
        ariaLabel={t('district')}
        className="w-[200px]"
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
  );
}
