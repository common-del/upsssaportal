'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { updateUser, setVerifierDistricts } from '@/lib/actions/users';

type District = { code: string; nameEn: string; nameHi: string };
type AuditEntry = { id: string; action: string; metadata: Record<string, unknown> | null; createdAt: string; actor: { username: string } };

export default function EditUserForm({
  actorId, actorRole, actorDistrictCode, user, districts, auditLogs, backPath,
}: {
  actorId: string; actorRole: string; actorDistrictCode?: string;
  user: { id: string; username: string; name: string | null; role: string; districtCode: string | null; verifierCapacity: number | null; active: boolean; verifierDistricts: { districtCode: string }[] };
  districts: District[]; auditLogs: AuditEntry[]; backPath: string;
}) {
  const t = useTranslations('userMgmt');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isSssa = actorRole === 'SSSA_ADMIN';

  const [name, setName] = useState(user.name ?? '');
  const [role, setRole] = useState(user.role);
  const [districtCode, setDistrictCode] = useState(user.districtCode ?? '');
  const [capacity, setCapacity] = useState(String(user.verifierCapacity ?? 50));
  const [active, setActive] = useState(user.active);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(user.verifierDistricts.map((v) => v.districtCode));

  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);
  const toggleDistrict = (code: string) => {
    setSelectedDistricts((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const handleSave = () => {
    setError(''); setSuccess('');
    startTransition(async () => {
      const actor = { userId: actorId, role: actorRole, districtCode: actorDistrictCode };
      const res = await updateUser(actor, user.id, {
        name: name || undefined,
        ...(isSssa ? { role, districtCode: districtCode || null } : {}),
        verifierCapacity: parseInt(capacity, 10) || 50,
        active,
      });
      if (!res.success) { setError(res.error ?? t('saveError')); return; }

      if (isSssa && (role === 'VERIFIER' || user.role === 'VERIFIER')) {
        const dRes = await setVerifierDistricts(actor, user.id, selectedDistricts);
        if (!dRes.success) { setError(dRes.error ?? t('saveError')); return; }
      }
      setSuccess(t('saved'));
      router.refresh();
    });
  };

  const inputCls = 'w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t('editDetails')}</h2>
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary">{t('fieldUsername')}</label>
            <p className="mt-1 font-mono text-sm text-navy-900">{user.username}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary">{t('fieldName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputCls}`} />
          </div>
          {isSssa && (
            <div>
              <label className="block text-xs font-medium text-text-secondary">{t('fieldRole')}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`mt-1 ${inputCls}`}>
                <option value="SSSA_ADMIN">{t('role_SSSA_ADMIN')}</option>
                <option value="DISTRICT_OFFICIAL">{t('role_DISTRICT_OFFICIAL')}</option>
                <option value="VERIFIER">{t('role_VERIFIER')}</option>
                <option value="SCHOOL">{t('role_SCHOOL')}</option>
              </select>
            </div>
          )}
          {isSssa && (role === 'DISTRICT_OFFICIAL') && (
            <div>
              <label className="block text-xs font-medium text-text-secondary">{t('fieldDistrict')}</label>
              <select value={districtCode} onChange={(e) => setDistrictCode(e.target.value)} className={`mt-1 ${inputCls}`}>
                <option value="">—</option>
                {districts.map((d) => <option key={d.code} value={d.code}>{label(d.nameEn, d.nameHi)}</option>)}
              </select>
            </div>
          )}
          {(role === 'VERIFIER' || user.role === 'VERIFIER') && (
            <div>
              <label className="block text-xs font-medium text-text-secondary">{t('fieldCapacity')}</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`mt-1 ${inputCls}`} min={1} />
            </div>
          )}
          {isSssa && (role === 'VERIFIER' || user.role === 'VERIFIER') && (
            <div>
              <label className="block text-xs font-medium text-text-secondary">{t('fieldAllowedDistricts')}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {districts.map((d) => (
                  <button key={d.code} type="button" onClick={() => toggleDistrict(d.code)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selectedDistricts.includes(d.code) ? 'border-navy-500 bg-navy-700 text-white' : 'border-border text-navy-700 hover:bg-surface'}`}>
                    {label(d.nameEn, d.nameHi)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} id="active-toggle" className="accent-navy-700" />
            <label htmlFor="active-toggle" className="text-sm text-navy-900">{t('enabled')}</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={isPending}
              className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
              {isPending ? t('saving') : t('save')}
            </button>
            <button onClick={() => router.push(backPath)} className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-navy-700 hover:bg-surface">
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>

      {isSssa && auditLogs.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy-900">{t('auditLog')}</h2>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 rounded-lg bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-navy-900">{log.action}</p>
                  <p className="text-[11px] text-text-secondary">by {log.actor.username} · {new Date(log.createdAt).toLocaleString()}</p>
                  {log.metadata ? (
                    <pre className="mt-1 text-[10px] text-text-secondary">{JSON.stringify(log.metadata, null, 2)}</pre>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
