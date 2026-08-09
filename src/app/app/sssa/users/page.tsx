import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/actions/users';
import UserListClient from '@/components/users/UserListClient';
import { buildVerificationQueue } from '@/lib/sssa/verificationQueue';
import Link from 'next/link';

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

  // Idle verifiers are an account fact and a queue fact at the same time. Nobody
  // opens Users to find them, so the page says it here and links to where the
  // assignment actually happens rather than making that connection the reader's job.
  const queue = await buildVerificationQueue();
  const idle = queue?.idle.length ?? 0;
  const waiting = queue?.waiting ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">Accounts and what each one can see</p>
      </header>

      {idle > 0 && waiting > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          <span>
            <b className="font-bold tabular-nums">{idle}</b>{' '}
            {idle === 1 ? 'verifier has' : 'verifiers have'} nothing assigned while{' '}
            <b className="font-bold tabular-nums">{waiting.toLocaleString('en-IN')}</b>{' '}
            {waiting === 1 ? 'school waits' : 'schools wait'} to be verified.
          </span>
          <Link
            href="/app/sssa/verifiers"
            className="ml-auto rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            Assign them
          </Link>
        </div>
      )}

    <UserListClient
        users={serialized} total={total ?? 0} pageSize={pageSize ?? 20} page={page}
        districts={districts}
        filters={{ role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q }}
        actorRole="SSSA_ADMIN" actorId={session!.user.id!} basePath="/app/sssa/users"
      />
    </div>
  );
}
