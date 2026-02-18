import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listUsers } from '@/lib/actions/users';
import UserListClient from '@/components/users/UserListClient';

export default async function DistrictUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'DISTRICT_OFFICIAL') redirect('/');

  const t = await getTranslations('userMgmt');
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const districtCode = session.user.districtCode ?? '';

  const actor = { userId: session.user.id!, role: 'DISTRICT_OFFICIAL', districtCode };
  const { users, total, pageSize } = await listUsers(actor, { active: sp.active, q: sp.q, page });

  const serialized = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/district" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('districtTitle')}</h1>
      <UserListClient
        users={serialized} total={total ?? 0} pageSize={pageSize ?? 20} page={page}
        districts={[]}
        filters={{ active: sp.active, q: sp.q }}
        actorRole="DISTRICT_OFFICIAL" actorId={session.user.id!} actorDistrictCode={districtCode}
        basePath="/app/district/users"
      />
    </div>
  );
}
