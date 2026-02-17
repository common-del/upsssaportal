import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function DistrictHomePage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'DISTRICT_OFFICIAL') redirect('/');

  const t = await getTranslations('appDistrict');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">
        {t('welcome', { username: session.user.name })}
      </p>
      <p className="mt-2 text-sm font-medium text-navy-700">
        {t('district', { code: session.user.districtCode ?? '—' })}
      </p>
      <p className="mt-6 text-sm text-text-secondary">{t('placeholder')}</p>
    </div>
  );
}
