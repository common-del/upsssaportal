'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useTransition } from 'react';
import { ChevronLeft, ChevronRight, UserPlus, Upload, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';
import { setUserEnabled, resetPassword } from '@/lib/actions/users';

type UserRow = {
  id: string; username: string; name: string | null; role: string; districtCode: string | null;
  verifierCapacity: number | null; active: boolean; createdAt: string;
  verifierDistricts: { districtCode: string }[];
};
type District = { code: string; nameEn: string; nameHi: string };

export default function UserListClient({
  users, total, pageSize, page, districts, filters, actorRole, actorId, actorDistrictCode, basePath,
}: {
  users: UserRow[]; total: number; pageSize: number; page: number;
  districts: District[]; filters: { role?: string; districtCode?: string; active?: string; q?: string };
  actorRole: string; actorId: string; actorDistrictCode?: string; basePath: string;
}) {
  const t = useTranslations('userMgmt');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const label = useCallback((en: string, hi: string) => (locale === 'hi' ? hi || en : en), [locale]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isSssa = actorRole === 'SSSA_ADMIN';

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [sp, pathname, router]);

  const handleToggle = (userId: string, enable: boolean) => {
    if (!confirm(enable ? t('confirmEnable') : t('confirmDisable'))) return;
    startTransition(async () => {
      await setUserEnabled({ userId: actorId, role: actorRole, districtCode: actorDistrictCode }, userId, enable);
      router.refresh();
    });
  };

  const handleResetPw = (userId: string) => {
    const pw = prompt(t('newPasswordPrompt'));
    if (!pw) return;
    startTransition(async () => {
      const res = await resetPassword({ userId: actorId, role: actorRole, districtCode: actorDistrictCode }, userId, pw);
      if (!res.success) alert(res.error);
      else alert(t('passwordResetDone'));
    });
  };

  const selectCls = 'rounded-md border border-border bg-white px-2.5 py-1.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {isSssa && (
          <select value={filters.role ?? ''} onChange={(e) => setParam('role', e.target.value)} className={selectCls}>
            <option value="">{t('allRoles')}</option>
            <option value="SSSA_ADMIN">{t('roleSssaAdmin')}</option>
            <option value="DISTRICT_OFFICIAL">{t('roleDistrict')}</option>
            <option value="VERIFIER">{t('roleVerifier')}</option>
            <option value="SCHOOL">{t('roleSchool')}</option>
          </select>
        )}
        {isSssa && (
          <select value={filters.districtCode ?? ''} onChange={(e) => setParam('districtCode', e.target.value)} className={selectCls}>
            <option value="">{t('allDistricts')}</option>
            {districts.map((d) => <option key={d.code} value={d.code}>{label(d.nameEn, d.nameHi)}</option>)}
          </select>
        )}
        <select value={filters.active ?? ''} onChange={(e) => setParam('active', e.target.value)} className={selectCls}>
          <option value="">{t('allStatus')}</option>
          <option value="true">{t('enabled')}</option>
          <option value="false">{t('disabled')}</option>
        </select>
        <input type="text" defaultValue={filters.q ?? ''} placeholder={t('searchPh')}
          onKeyDown={(e) => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value); }}
          className={`${selectCls} w-48`} />
        <div className="ml-auto flex gap-2">
          <Link href={`${basePath}/new`} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
            <UserPlus size={16} /> {t('createUser')}
          </Link>
          {isSssa && (
            <Link href={`${basePath}/bulk`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-surface">
              <Upload size={16} /> {t('bulkUpload')}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-text-secondary">
              <th className="px-3 py-2.5">{t('colUsername')}</th>
              <th className="px-3 py-2.5">{t('colName')}</th>
              {isSssa && <th className="px-3 py-2.5">{t('colRole')}</th>}
              <th className="px-3 py-2.5">{t('colDistrict')}</th>
              <th className="px-3 py-2.5 text-right">{t('colCapacity')}</th>
              <th className="px-3 py-2.5">{t('colStatus')}</th>
              <th className="px-3 py-2.5">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={isSssa ? 7 : 6} className="px-3 py-6 text-center text-text-secondary">{t('noUsers')}</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-3 py-2.5 font-mono text-xs font-medium">{u.username}</td>
                <td className="px-3 py-2.5 text-xs">{u.name ?? '—'}</td>
                {isSssa && <td className="px-3 py-2.5"><span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium">{t(`role_${u.role}`)}</span></td>}
                <td className="px-3 py-2.5 text-xs">
                  {u.districtCode ?? (u.verifierDistricts.length > 0 ? u.verifierDistricts.map((v) => v.districtCode).join(', ') : '—')}
                </td>
                <td className="px-3 py-2.5 text-right text-xs">{u.verifierCapacity ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.active ? t('enabled') : t('disabled')}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Link href={`${basePath}/${u.id}/edit`} className="rounded-md px-2 py-1 text-xs font-medium text-navy-700 hover:bg-surface">{t('edit')}</Link>
                    <button onClick={() => handleToggle(u.id, !u.active)} disabled={isPending}
                      className="rounded-md px-1.5 py-1 text-xs hover:bg-surface" title={u.active ? t('disable') : t('enable')}>
                      {u.active ? <ShieldOff size={14} className="text-red-500" /> : <ShieldCheck size={14} className="text-green-600" />}
                    </button>
                    <button onClick={() => handleResetPw(u.id)} disabled={isPending}
                      className="rounded-md px-1.5 py-1 text-xs hover:bg-surface" title={t('resetPw')}>
                      <KeyRound size={14} className="text-navy-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t('showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setParam('page', String(page - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"><ChevronLeft size={14} /> {t('prev')}</button>
            <button onClick={() => setParam('page', String(page + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40">{t('next')} <ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
