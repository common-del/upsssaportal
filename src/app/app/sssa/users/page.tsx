import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/actions/users';
import UserListClient from '@/components/users/UserListClient';

export default async function SssaUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('userMgmt');
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const actor = { userId: session.user.id!, role: 'SSSA_ADMIN' };
  const { users, total, pageSize } = await listUsers(actor, {
    role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q, page,
  });

  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });

  const serialized = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('title')}</h1>
      <UserListClient
        users={serialized} total={total ?? 0} pageSize={pageSize ?? 20} page={page}
        districts={districts}
        filters={{ role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q }}
        actorRole="SSSA_ADMIN" actorId={session.user.id!} basePath="/app/sssa/users"
      />
    </div>
  );
}
