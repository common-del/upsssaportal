'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useRef } from 'react';

interface FilterOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface Props {
  districts: FilterOption[];
  blocks: FilterOption[];
  selected: { district: string; block: string; category: string; q: string };
  locale: string;
}

export function DirectoryFilters({ districts, blocks, selected, locale }: Props) {
  const t = useTranslations('directory');
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  const getName = (item: FilterOption) =>
    locale === 'hi' ? item.nameHi : item.nameEn;

  function navigate(updates: Partial<typeof selected>) {
    const merged = { ...selected, ...updates };
    if ('district' in updates && updates.district !== selected.district) {
      merged.block = '';
    }

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    'rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
      {/* District */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">
          {t('district')}
        </label>
        <select
          value={selected.district}
          onChange={(e) => navigate({ district: e.target.value })}
          className={selectClass}
          aria-label={t('district')}
        >
          <option value="">{t('allDistricts')}</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {getName(d)}
            </option>
          ))}
        </select>
      </div>

      {/* Block */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">
          {t('block')}
        </label>
        <select
          value={selected.block}
          onChange={(e) => navigate({ block: e.target.value })}
          className={selectClass}
          disabled={!selected.district}
          aria-label={t('block')}
        >
          <option value="">{t('allBlocks')}</option>
          {blocks.map((b) => (
            <option key={b.code} value={b.code}>
              {getName(b)}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">
          {t('category')}
        </label>
        <select
          value={selected.category}
          onChange={(e) => navigate({ category: e.target.value })}
          className={selectClass}
          aria-label={t('category')}
        >
          <option value="">{t('allCategories')}</option>
          <option value="Primary">{t('catPrimary')}</option>
          <option value="Upper Primary">{t('catUpperPrimary')}</option>
          <option value="Secondary">{t('catSecondary')}</option>
        </select>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-secondary">
          {t('search')}
        </label>
        <div className="flex">
          <input
            ref={searchRef}
            type="text"
            key={selected.q}
            defaultValue={selected.q}
            placeholder={t('searchPlaceholder')}
            className="w-48 rounded-l-lg border border-r-0 border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate({ q: (e.target as HTMLInputElement).value });
              }
            }}
            aria-label={t('searchPlaceholder')}
          />
          <button
            type="button"
            onClick={() => navigate({ q: searchRef.current?.value || '' })}
            className="rounded-r-lg border border-border bg-navy-900 px-3 text-white transition-colors hover:bg-navy-800"
            aria-label={t('search')}
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
