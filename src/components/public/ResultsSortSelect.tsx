'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  current: string;
  sortHrefs: Record<string, string>;
}

export function ResultsSortSelect({ current, sortHrefs }: Props) {
  const t = useTranslations('findResults');
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-text-secondary">
        {t('sortBy')}
      </label>
      <select
        value={current}
        onChange={(e) => {
          const href = sortHrefs[e.target.value];
          if (href) router.push(href);
        }}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
      >
        <option value="name_asc">{t('sortNameAsc')}</option>
        <option value="fees_asc">{t('sortFeesAsc')}</option>
        <option value="fees_desc">{t('sortFeesDesc')}</option>
      </select>
    </div>
  );
}
