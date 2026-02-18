import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import CreateUserForm from '@/components/users/CreateUserForm';

export default async function SssaCreateUserPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('userMgmt');
  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/app/sssa/users" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToUsers')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('createTitle')}</h1>
      <CreateUserForm
        actorId={session.user.id!} actorRole="SSSA_ADMIN"
        districts={districts} allowedRoles={['VERIFIER', 'DISTRICT_OFFICIAL', 'SSSA_ADMIN', 'SCHOOL']}
        backPath="/app/sssa/users"
      />
    </div>
  );
}
