'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, MapPin, Lightbulb, ChevronRight, Star, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TierStars } from '@/components/public/TierStars';
import { RADIUS_TIERS_KM, type NearbySchool } from '@/lib/public/nearbyDummyData';

interface FilterOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface BlockOption extends FilterOption {
  districtCode: string;
}

interface Selected {
  district: string;
  block: string;
  category: string;
  type: string;
  performance: string;
  q: string;
}

interface Props {
  districts: FilterOption[];
  blocks: BlockOption[];
  selected: Selected;
  nearMe: boolean;
  nearbySchools: NearbySchool[];
  locale: string;
}

export function DirectoryFilters({
  districts,
  blocks,
  selected,
  nearMe,
  nearbySchools,
  locale,
}: Props) {
  const t = useTranslations('directory');
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [radiusTier, setRadiusTier] = useState<number>(RADIUS_TIERS_KM[0]);

  const getName = (item: FilterOption) => (locale === 'hi' ? item.nameHi : item.nameEn);

  function navigate(updates: Partial<Selected> & { nearMe?: boolean }) {
    const { nearMe: nextNearMe, ...rest } = updates;
    const merged = { ...selected, ...rest };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const nearMeValue = nextNearMe ?? nearMe;
    if (nextNearMe !== undefined) {
      if (nearMeValue) params.set('nearMe', '1');
    } else if (nearMe) {
      params.set('nearMe', '1');
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

  const districtName = districts.find((d) => d.code === selected.district);
  const blocksForDistrict = blocks.filter((b) => b.districtCode === selected.district);
  const blockName = blocks.find((b) => b.code === selected.block);

  const visibleNearby = nearbySchools.filter((s) => s.distanceKm <= radiusTier);
  const nextRadiusTier = RADIUS_TIERS_KM.find((k) => k > radiusTier);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Left: search + near me */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <div className="relative flex-[2]">
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
          <button
            type="button"
            onClick={() => {
              setRadiusTier(RADIUS_TIERS_KM[0]);
              navigate({ nearMe: !nearMe });
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
              nearMe
                ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white'
                : 'border-border text-[#1B2A6B] hover:bg-gray-50'
            }`}
          >
            <MapPin size={15} />
            {t('nearMe')}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-secondary">{t('searchHelp')}</p>

        {nearMe ? (
          <div className="mt-3">
            <p className="text-sm font-semibold text-gray-900">
              {t('nearbyHeading', { radius: radiusTier })}
            </p>
            {/* Distances here are generated, not measured. A parent reading "3.2 km
                away" will act on it, so the caveat is a full notice rather than
                small print - see nearbyDummyData.ts. */}
            <div
              role="note"
              className="mt-2 flex gap-2 rounded-lg border border-amber-400 bg-amber-50 p-2.5"
            >
              <AlertTriangle size={16} className="mt-px shrink-0 text-amber-700" />
              <span>
                <span className="block text-xs font-bold text-amber-900">
                  {t('nearbyCaveatTitle')}
                </span>
                <span className="mt-0.5 block text-xs text-amber-900">
                  {t('nearbyCaveatBody')}
                </span>
              </span>
            </div>
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
              {visibleNearby.map((s) => (
                <li key={s.udise}>
                  <Link
                    href={`/public/schools/${s.udise}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-[#1B2A6B]/40 hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {s.districtName} · {s.blockName} ·{' '}
                        {t('nearbyAway', { distance: s.distanceKm })}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <TierStars level={s.performanceLevel} size={12} />
                        <span className="text-xs font-semibold text-[#1B2A6B]">
                          {s.overallScore}%
                        </span>
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
              {visibleNearby.length === 0 && (
                <li className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
                  {t('nearbyEmpty', { radius: radiusTier })}
                </li>
              )}
            </ul>
            {nextRadiusTier !== undefined && (
              <button
                type="button"
                onClick={() => setRadiusTier(nextRadiusTier)}
                className="mt-2 w-full rounded-lg border border-dashed border-[#C9911A] py-2 text-xs font-bold text-[#C9911A] hover:bg-amber-50"
              >
                ⊕ {t('expandRadius', { radius: nextRadiusTier })}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F3F4F6] p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1B2A6B]">
              <Lightbulb size={16} className="text-white" />
            </span>
            <span>
              <span className="block text-sm font-bold text-gray-900">{t('tipTitle')}</span>
              <span className="mt-0.5 block text-xs text-gray-600">{t('tipBody')}</span>
            </span>
          </div>
        )}
      </div>

      {/* Right: district -> block drill-down */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        {!selected.district && (
          <>
            <p className="text-sm font-semibold text-gray-900">{t('stepDistrict')}</p>
            <div className="mt-2 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {districts.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => navigate({ district: d.code, block: '' })}
                  className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 text-left text-sm font-semibold text-[#1B2A6B] transition hover:bg-gray-100"
                >
                  <span className="truncate">{getName(d)}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {selected.district && !selected.block && (
          <>
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-bold text-gray-900">
                {districtName ? getName(districtName) : selected.district}
              </span>
              <button
                type="button"
                onClick={() => navigate({ district: '', block: '' })}
                className="font-semibold text-[#1B2A6B] underline underline-offset-2"
              >
                {t('change')}
              </button>
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{t('stepBlock')}</p>
            <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {blocksForDistrict.length === 0 ? (
                <p className="col-span-2 text-sm text-gray-500">{t('noBlocks')}</p>
              ) : (
                blocksForDistrict.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => navigate({ block: b.code })}
                    className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 text-left text-sm font-semibold text-[#1B2A6B] transition hover:bg-gray-100"
                  >
                    <span className="truncate">{getName(b)}</span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </button>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {t('browseWholeDistrict', {
                district: districtName ? getName(districtName) : selected.district,
              })}
            </p>
          </>
        )}

        {selected.district && selected.block && (
          <>
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-bold text-gray-900">
                {districtName ? getName(districtName) : selected.district}
                {' · '}
                {blockName ? getName(blockName) : selected.block}
              </span>
              <button
                type="button"
                onClick={() => navigate({ block: '' })}
                className="font-semibold text-[#1B2A6B] underline underline-offset-2"
              >
                {t('change')}
              </button>
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
              <Star size={14} className="text-[#C9911A]" />
              {t('seeMatching')}
            </p>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
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
