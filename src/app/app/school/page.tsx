import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export default async function SchoolHomePage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('appSchool');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">
        {t('welcome', { username: session.user.name })}
      </p>
      <p className="mt-6 text-sm text-text-secondary">{t('placeholder')}</p>
    </div>
  );
}
