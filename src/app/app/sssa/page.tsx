import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function SssaHomePage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');

  const t = await getTranslations('appSssa');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-6 text-sm text-text-secondary">{t('placeholder')}</p>
    </div>
  );
}
