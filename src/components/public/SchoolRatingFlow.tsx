'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronRight,
  Lightbulb,
  MapPin,
  Search,
} from 'lucide-react';
import { TierStars } from '@/components/public/TierStars';
import { RADIUS_TIERS_KM, type NearbySchool } from '@/lib/public/nearbyDummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';

export type RatingSchoolRow = {
  udise: string;
  name: string;
  districtName: string;
  blockName: string;
  /** Not shown in the flow, but the nearby-distance helper needs it. */
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  overallScore: number;
};

interface GeoOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface BlockOption extends GeoOption {
  districtCode: string;
}

interface Props {
  districts: GeoOption[];
  blocks: BlockOption[];
  /** Already narrowed server-side by district / block / q. */
  schools: RatingSchoolRow[];
  selected: { district: string; block: string; q: string };
  /** True once a district is picked and the parent asked to skip the block step. */
  wholeDistrict: boolean;
  nearMe: boolean;
  nearbySchools: NearbySchool[];
  locale: string;
}

export function SchoolRatingFlow({
  districts,
  blocks,
  schools,
  selected,
  wholeDistrict,
  nearMe,
  nearbySchools,
  locale,
}: Props) {
  const t = useTranslations('rating');
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [radiusTier, setRadiusTier] = useState<number>(RADIUS_TIERS_KM[0]);
  const [districtQuery, setDistrictQuery] = useState('');

  const getName = (item: GeoOption) => (locale === 'hi' ? item.nameHi : item.nameEn);

  type NavUpdates = Partial<typeof selected> & { nearMe?: boolean; all?: boolean };

  function navigate(updates: NavUpdates) {
    const { nearMe: nextNearMe, all: nextAll, ...rest } = updates;
    const merged = { ...selected, ...rest };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    if ((nextNearMe ?? nearMe) && nextNearMe !== false) params.set('nearMe', '1');
    if ((nextAll ?? wholeDistrict) && nextAll !== false) params.set('all', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  // Instant-feeling search so a parent never has to hunt for a submit button.
  function handleSearchInput(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: value }), 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const districtOption = districts.find((d) => d.code === selected.district);
  const blockOption = blocks.find((b) => b.code === selected.block);
  const blocksForDistrict = useMemo(
    () => blocks.filter((b) => b.districtCode === selected.district),
    [blocks, selected.district],
  );

  const visibleDistricts = useMemo(() => {
    const needle = districtQuery.trim().toLowerCase();
    if (!needle) return districts;
    return districts.filter(
      (d) =>
        d.nameEn.toLowerCase().includes(needle) || d.nameHi.toLowerCase().includes(needle),
    );
  }, [districts, districtQuery]);

  const visibleNearby = nearbySchools.filter((s) => s.distanceKm <= radiusTier);
  const nextRadiusTier = RADIUS_TIERS_KM.find((k) => k > radiusTier);

  // A name/UDISE search answers the question on its own, so it jumps straight to
  // the school list rather than making the parent still pick a district first.
  const searching = selected.q.trim().length > 0;
  const showSchools = searching || Boolean(selected.block) || wholeDistrict;

  const chipClass =
    'flex min-h-[44px] items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 text-left text-sm font-semibold text-[#1B2A6B] transition hover:bg-gray-100';

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      {/* Left: search, near-me, and the parent-facing tip */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <div className="relative flex-[2]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
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
            {/* Distances are generated, not measured. A parent reading "3.2 km away"
                will act on it, so the caveat is a full notice, not small print. */}
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
                          {t('overallScore', { score: s.overallScore })}
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

      {/* Right: district -> block -> school drill-down */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        {showSchools ? (
          <>
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-bold text-gray-900">
                {searching
                  ? t('resultsFor', { query: selected.q })
                  : [
                      districtOption ? getName(districtOption) : selected.district,
                      blockOption ? getName(blockOption) : selected.block,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </span>
              <button
                type="button"
                onClick={() =>
                  searching
                    ? navigate({ q: '' })
                    : navigate({ block: '', all: false })
                }
                className="font-semibold text-[#1B2A6B] underline underline-offset-2"
              >
                {t('change')}
              </button>
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{t('stepSchool')}</p>
            <ul className="mt-2 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {schools.map((s) => (
                <li key={s.udise}>
                  <Link
                    href={`/public/schools/${s.udise}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-[#1B2A6B]/40 hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {s.districtName} · {s.blockName}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <TierStars level={s.performanceLevel} size={13} />
                        <span className="text-xs font-semibold text-[#1B2A6B]">
                          {t('overallScore', { score: s.overallScore })}
                        </span>
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
              {schools.length === 0 && (
                <li className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500">
                  {t('noSchools')}
                </li>
              )}
            </ul>
          </>
        ) : !selected.district ? (
          <>
            <p className="text-sm font-semibold text-gray-900">{t('stepDistrict')}</p>
            <div className="relative mt-2">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                value={districtQuery}
                onChange={(e) => setDistrictQuery(e.target.value)}
                placeholder={t('districtSearchPlaceholder')}
                aria-label={t('districtSearchPlaceholder')}
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
              />
            </div>
            <div className="mt-2 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {visibleDistricts.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => navigate({ district: d.code, block: '', all: false })}
                  className={chipClass}
                >
                  <span className="truncate">{getName(d)}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-400" />
                </button>
              ))}
              {visibleDistricts.length === 0 && (
                <p className="col-span-2 text-sm text-gray-500">{t('noDistricts')}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-bold text-gray-900">
                {districtOption ? getName(districtOption) : selected.district}
              </span>
              <button
                type="button"
                onClick={() => navigate({ district: '', block: '', all: false })}
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
                    className={chipClass}
                  >
                    <span className="truncate">{getName(b)}</span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate({ all: true })}
              className="mt-3 w-full rounded-lg border border-dashed border-[#1B2A6B]/40 py-2 text-xs font-bold text-[#1B2A6B] hover:bg-gray-50"
            >
              {t('skipBlock', {
                district: districtOption ? getName(districtOption) : selected.district,
              })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
