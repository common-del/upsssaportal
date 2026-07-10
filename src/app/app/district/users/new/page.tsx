import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import CreateUserForm from '@/components/users/CreateUserForm';

export default async function DistrictCreateUserPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  if (session.user.role !== 'DISTRICT_OFFICIAL') redirect('/');

  const t = await getTranslations('userMgmt');
  const districtCode = session.user.districtCode ?? '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton fallbackHref="/app/district/users" label={t('backToUsers')} className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900" />
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('createTitle')}</h1>
      <CreateUserForm
        actorId={session.user.id!} actorRole="DISTRICT_OFFICIAL" actorDistrictCode={districtCode}
        districts={[]} allowedRoles={['VERIFIER']}
        backPath="/app/district/users"
      />
    </div>
  );
}
