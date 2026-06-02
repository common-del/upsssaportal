import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/actions/users';
import UserListClient from '@/components/users/UserListClient';

export default async function SssaUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const session = await auth();
  const actor = { userId: session!.user.id!, role: 'SSSA_ADMIN' };
  const { users, total, pageSize } = await listUsers(actor, {
    role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q, page,
  });

  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });

  const serialized = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return (
    <UserListClient
        users={serialized} total={total ?? 0} pageSize={pageSize ?? 20} page={page}
        districts={districts}
        filters={{ role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q }}
        actorRole="SSSA_ADMIN" actorId={session!.user.id!} basePath="/app/sssa/users"
      />
  );
}
