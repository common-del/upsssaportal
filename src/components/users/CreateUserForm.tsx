'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createUser } from '@/lib/actions/users';

type District = { code: string; nameEn: string; nameHi: string };

export default function CreateUserForm({
  actorId, actorRole, actorDistrictCode, districts, allowedRoles, backPath,
}: {
  actorId: string; actorRole: string; actorDistrictCode?: string;
  districts: District[]; allowedRoles: string[]; backPath: string;
}) {
  const t = useTranslations('userMgmt');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [role, setRole] = useState(allowedRoles[0]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [capacity, setCapacity] = useState('50');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(actorDistrictCode ? [actorDistrictCode] : []);

  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);

  const toggleDistrict = (code: string) => {
    setSelectedDistricts((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const handleSubmit = () => {
    setError('');
    startTransition(async () => {
      const res = await createUser(
        { userId: actorId, role: actorRole, districtCode: actorDistrictCode },
        { username, password, name: name || undefined, role, districtCode: districtCode || undefined, verifierCapacity: parseInt(capacity, 10) || 50, districtCodes: selectedDistricts },
      );
      if (res.success) router.push(backPath);
      else setError(res.error ?? t('createError'));
    });
  };

  const inputCls = 'w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500';

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-navy-900">{t('fieldRole')}</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`mt-1 ${inputCls}`}>
          {allowedRoles.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900">{t('fieldUsername')}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className={`mt-1 ${inputCls}`} placeholder={role === 'SCHOOL' ? t('udisePh') : t('usernamePh')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900">{t('fieldPassword')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${inputCls}`} placeholder={t('passwordPh')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-navy-900">{t('fieldName')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputCls}`} placeholder={t('namePh')} />
      </div>

      {role === 'DISTRICT_OFFICIAL' && (
        <div>
          <label className="block text-sm font-medium text-navy-900">{t('fieldDistrict')}</label>
          <select value={districtCode} onChange={(e) => setDistrictCode(e.target.value)} className={`mt-1 ${inputCls}`}>
            <option value="">{t('selectDistrict')}</option>
            {districts.map((d) => <option key={d.code} value={d.code}>{label(d.nameEn, d.nameHi)}</option>)}
          </select>
        </div>
      )}

      {role === 'VERIFIER' && (
        <>
          <div>
            <label className="block text-sm font-medium text-navy-900">{t('fieldCapacity')}</label>
            <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`mt-1 ${inputCls}`} min={1} />
          </div>
          {actorRole === 'SSSA_ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-navy-900">{t('fieldAllowedDistricts')}</label>
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
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} disabled={isPending}
          className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
          {isPending ? t('creating') : t('createUser')}
        </button>
        <button onClick={() => router.push(backPath)} className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-navy-700 hover:bg-surface">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
