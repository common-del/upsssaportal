'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calculator, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { finalizeAllResults, publishResults } from '@/lib/actions/finalization';

type Row = {
  udise: string; nameEn: string; nameHi: string; districtCode: string;
  verified: boolean; selfScore: number | null; verifierScore: number | null;
  delta: number | null; appealStatus: string | null;
  finalScore: number | null; gradeBand: string | null; published: boolean;
};
type GradeBand = { key: string; labelEn: string; labelHi: string };

const PAGE_SIZE = 25;

export default function FinalizationClient({
  rows, cycleId, gradeBands, isPublished,
}: {
  rows: Row[]; cycleId: string;
  gradeBands: GradeBand[]; isPublished: boolean;
}) {
  const t = useTranslations('finalization');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterAppeal, setFilterAppeal] = useState('');
  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);

  const bandLabel = (key: string | null) => {
    if (!key) return '—';
    const band = gradeBands.find((b) => b.key === key);
    return band ? label(band.labelEn, band.labelHi) : key;
  };

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.nameEn.toLowerCase().includes(q) && !r.nameHi.includes(q) && !r.udise.includes(q)) return false;
    }
    if (filterAppeal === 'has') return !!r.appealStatus;
    if (filterAppeal === 'none') return !r.appealStatus;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFinalizeAll = () => {
    if (!confirm(t('finalizeAllConfirm'))) return;
    setMsg('');
    startTransition(async () => {
      const res = await finalizeAllResults(cycleId);
      if (res.success) { setMsg(t('finalizedAll', { count: res.computed })); router.refresh(); }
      else setMsg(res.error ?? 'Error');
    });
  };

  const handlePublish = () => {
    if (!confirm(t('publishConfirm'))) return;
    setMsg('');
    startTransition(async () => {
      const res = await publishResults(cycleId);
      if (res.success) { setMsg(t('publishedSuccess')); router.refresh(); }
      else setMsg(res.error ?? 'Error');
    });
  };

  const selectCls = 'rounded-md border border-border bg-white px-2.5 py-1.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('searchPh')} className={`${selectCls} w-56`} />
        <select value={filterAppeal} onChange={(e) => { setFilterAppeal(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">{t('allAppeals')}</option>
          <option value="has">{t('hasAppeal')}</option>
          <option value="none">{t('noAppeal')}</option>
        </select>
        <div className="ml-auto flex gap-2">
          {!isPublished && (
            <button onClick={handleFinalizeAll} disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
              <Calculator size={16} /> {isPending ? t('computing') : t('finalizeAll')}
            </button>
          )}
          {!isPublished && (
            <button onClick={handlePublish} disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              <Globe size={16} /> {t('publishResults')}
            </button>
          )}
        </div>
      </div>

      {!isPublished && (
        <p className="mt-2 text-xs text-text-secondary">{t('computeHelper')}</p>
      )}

      {msg && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-left text-xs font-semibold text-text-secondary">
              <th className="px-3 py-2.5">{t('colSchool')}</th>
              <th className="px-3 py-2.5">{t('colUdise')}</th>
              <th className="px-3 py-2.5 text-right">{t('colSaScore')}</th>
              <th className="px-3 py-2.5 text-right">{t('colVScore')}</th>
              <th className="px-3 py-2.5 text-right">{t('colDelta')}</th>
              <th className="px-3 py-2.5">{t('colAppeal')}</th>
              <th className="px-3 py-2.5 text-right">{t('colFinalScore')}</th>
              <th className="px-3 py-2.5">{t('colGrade')}</th>
              <th className="px-3 py-2.5">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-text-secondary">{t('noResults')}</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.udise} className="border-b border-border/50 hover:bg-surface/30">
                <td className="px-3 py-2 text-xs font-medium text-navy-900">{label(r.nameEn, r.nameHi)}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.udise}</td>
                <td className="px-3 py-2 text-right text-xs">{r.selfScore != null ? `${r.selfScore}%` : '—'}</td>
                <td className="px-3 py-2 text-right text-xs">{r.verifierScore != null ? `${r.verifierScore}%` : '—'}</td>
                <td className="px-3 py-2 text-right text-xs">
                  {r.delta != null ? (
                    <span className={r.delta >= 10 ? 'font-medium text-red-600' : ''}>{r.delta.toFixed(1)}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.appealStatus ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.appealStatus === 'DECIDED' ? 'bg-green-100 text-green-700' :
                      r.appealStatus === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{r.appealStatus}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium">{r.finalScore != null ? `${r.finalScore}%` : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {r.gradeBand ? (
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-700">{bandLabel(r.gradeBand)}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.appealStatus === 'SUBMITTED' && (
                    <Link href={`/app/sssa/finalization/appeal/${r.udise}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium">{t('decideAppeal')}</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t('showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40">
              <ChevronLeft size={14} /> {t('prev')}
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40">
              {t('next')} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
