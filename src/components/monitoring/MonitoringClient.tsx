'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building2, List, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

type SchoolRow = {
  udise: string; nameEn: string; nameHi: string; districtCode: string; blockCode: string;
  category: string; saStatus: string; saScore: number | null; verifierScore: number | null; ratingAvg: number | null; ratingCount: number;
};

type DistrictRow = {
  code: string; nameEn: string; nameHi: string; total: number; started: number;
  submitted: number; avgScore: number | null; avgVerifierScore: number | null; avgRating: number | null;
};

type FilterItem = { code: string; nameEn: string; nameHi: string };

export default function MonitoringClient({
  view, schoolsData, districtData, districts, blocks,
  filterDistrict, filterBlock, filterStatus, searchQ,
  page, pageSize, totalSchools,
}: {
  view: string;
  schoolsData: { rows: SchoolRow[]; total: number };
  districtData: DistrictRow[];
  districts: FilterItem[];
  blocks: FilterItem[];
  filterDistrict: string; filterBlock: string; filterStatus: string; searchQ: string;
  page: number; pageSize: number; totalSchools: number;
}) {
  const t = useTranslations('monitoring');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const label = useCallback((en: string, hi: string) => (locale === 'hi' ? hi || en : en), [locale]);

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [sp, pathname, router]);

  const switchView = (v: string) => {
    const params = new URLSearchParams();
    params.set('view', v);
    if (v === 'schools' && filterDistrict) params.set('district', filterDistrict);
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(totalSchools / pageSize));

  const statusLabel = (s: string) => {
    if (s === 'submitted') return t('statusSubmitted');
    if (s === 'draft') return t('statusDraft');
    return t('statusNotStarted');
  };
  const statusBadge = (s: string) => {
    if (s === 'submitted') return 'bg-green-100 text-green-700';
    if (s === 'draft') return 'bg-amber-100 text-amber-700';
    return 'bg-surface text-text-secondary';
  };

  const selectClass = 'rounded-md border border-border bg-white px-2.5 py-1.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500';

  return (
    <div className="mt-8">
      {/* View toggle */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => switchView('schools')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            view === 'schools' ? 'bg-navy-700 text-white' : 'bg-surface text-text-secondary hover:bg-navy-100'
          }`}
        >
          <List size={16} /> {t('schoolsView')}
        </button>
        <button
          onClick={() => switchView('district')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            view === 'district' ? 'bg-navy-700 text-white' : 'bg-surface text-text-secondary hover:bg-navy-100'
          }`}
        >
          <Building2 size={16} /> {t('districtView')}
        </button>
      </div>

      {view === 'schools' ? (
        <div className="mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select value={filterDistrict} onChange={(e) => setParam('district', e.target.value)} className={selectClass}>
              <option value="">{t('allDistricts')}</option>
              {districts.map((d) => <option key={d.code} value={d.code}>{label(d.nameEn, d.nameHi)}</option>)}
            </select>
            {filterDistrict && (
              <select value={filterBlock} onChange={(e) => setParam('block', e.target.value)} className={selectClass}>
                <option value="">{t('allBlocks')}</option>
                {blocks.map((b) => <option key={b.code} value={b.code}>{label(b.nameEn, b.nameHi)}</option>)}
              </select>
            )}
            <select value={filterStatus} onChange={(e) => setParam('status', e.target.value)} className={selectClass}>
              <option value="">{t('allStatuses')}</option>
              <option value="not_started">{t('statusNotStarted')}</option>
              <option value="draft">{t('statusDraft')}</option>
              <option value="submitted">{t('statusSubmitted')}</option>
            </select>
            <input
              type="text"
              defaultValue={searchQ}
              placeholder={t('searchPlaceholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value); }}
              className={`${selectClass} w-52`}
            />
          </div>

          {/* Schools table */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-text-secondary">
                  <th className="px-3 py-2.5">{t('colName')}</th>
                  <th className="px-3 py-2.5">{t('colUdise')}</th>
                  <th className="px-3 py-2.5">{t('colDistrict')}</th>
                  <th className="px-3 py-2.5">{t('colBlock')}</th>
                  <th className="px-3 py-2.5">{t('colStatus')}</th>
                  <th className="px-3 py-2.5 text-right">{t('colSaScore')}</th>
                  <th className="px-3 py-2.5 text-right">{t('colRating')}</th>
                  <th className="px-3 py-2.5 text-right">{t('colVerifier')}</th>
                  <th className="px-3 py-2.5 text-right">{t('colFinal')}</th>
                </tr>
              </thead>
              <tbody>
                {schoolsData.rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-text-secondary">{t('noResults')}</td></tr>
                ) : (
                  schoolsData.rows.map((s) => (
                    <tr key={s.udise} className="border-b border-border last:border-0 hover:bg-surface/50">
                      <td className="px-3 py-2.5">
                        <Link href={`/app/sssa/monitoring/schools/${s.udise}`} className="font-medium text-navy-700 hover:underline">
                          {label(s.nameEn, s.nameHi)}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{s.udise}</td>
                      <td className="px-3 py-2.5 text-xs">{s.districtCode}</td>
                      <td className="px-3 py-2.5 text-xs">{s.blockCode}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(s.saStatus)}`}>
                          {statusLabel(s.saStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {s.saScore !== null ? `${s.saScore}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {s.ratingAvg !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {s.ratingAvg} <span className="text-xs text-text-secondary">({s.ratingCount})</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {s.verifierScore !== null ? `${s.verifierScore}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-text-secondary">—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {t('showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalSchools), total: totalSchools })}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setParam('page', String(page - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> {t('prev')}
                </button>
                <button
                  onClick={() => setParam('page', String(page + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  {t('next')} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* District view */
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-text-secondary">
                <th className="px-3 py-2.5">{t('colDistrict')}</th>
                <th className="px-3 py-2.5 text-right">{t('totalSchools')}</th>
                <th className="px-3 py-2.5 text-right">{t('started')}</th>
                <th className="px-3 py-2.5 text-right">{t('submitted')}</th>
                <th className="px-3 py-2.5 text-right">{t('colAvgScore')}</th>
                <th className="px-3 py-2.5 text-right">{t('colAvgRating')}</th>
                <th className="px-3 py-2.5 text-right">{t('colVerifier')}</th>
                <th className="px-3 py-2.5 text-right">{t('colFinal')}</th>
              </tr>
            </thead>
            <tbody>
              {districtData.map((d) => {
                const startedPct = d.total > 0 ? Math.round((d.started / d.total) * 100) : 0;
                const submittedPct = d.total > 0 ? Math.round((d.submitted / d.total) * 100) : 0;
                return (
                  <tr key={d.code} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-3 py-2.5">
                      <button onClick={() => { switchView('schools'); setTimeout(() => setParam('district', d.code), 50); }} className="font-medium text-navy-700 hover:underline">
                        {label(d.nameEn, d.nameHi)}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">{d.total}</td>
                    <td className="px-3 py-2.5 text-right">{d.started} <span className="text-xs text-text-secondary">({startedPct}%)</span></td>
                    <td className="px-3 py-2.5 text-right">{d.submitted} <span className="text-xs text-text-secondary">({submittedPct}%)</span></td>
                    <td className="px-3 py-2.5 text-right font-medium">{d.avgScore !== null ? `${d.avgScore}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {d.avgRating !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} className="fill-amber-400 text-amber-400" /> {d.avgRating}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">{d.avgVerifierScore !== null ? `${d.avgVerifierScore}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-text-secondary">—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
