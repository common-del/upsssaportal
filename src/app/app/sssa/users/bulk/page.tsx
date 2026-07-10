import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import BulkUploadForm from '@/components/users/BulkUploadForm';
import { BackButton } from '@/components/common/BackButton';

export default async function SssaBulkUploadPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('userMgmt');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton fallbackHref="/app/sssa/users" label={t('backToUsers')} className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900" />
      <h1 className="mb-2 text-2xl font-bold text-navy-900">{t('bulkTitle')}</h1>
      <p className="mb-6 text-sm text-text-secondary">{t('bulkDesc')}</p>
      <BulkUploadForm actorId={session.user.id!} backPath="/app/sssa/users" />
    </div>
  );
}
