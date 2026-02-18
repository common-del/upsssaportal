import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import BulkUploadForm from '@/components/users/BulkUploadForm';

export default async function SssaBulkUploadPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('userMgmt');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/sssa/users" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToUsers')}
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-navy-900">{t('bulkTitle')}</h1>
      <p className="mb-6 text-sm text-text-secondary">{t('bulkDesc')}</p>
      <BulkUploadForm actorId={session.user.id!} backPath="/app/sssa/users" />
    </div>
  );
}
