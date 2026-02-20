import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import PilotImportClient from '@/components/pilotImport/PilotImportClient';

export default async function PilotImportPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('pilotImport');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t('subtitle')}</p>
      <PilotImportClient />
    </div>
  );
}
