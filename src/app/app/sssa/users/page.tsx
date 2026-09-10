import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listUsers } from '@/lib/actions/users';
import UserListClient from '@/components/users/UserListClient';
import { buildVerificationQueue } from '@/lib/sssa/verificationQueue';
import { buildVerifierList } from '@/lib/sssa/verifierList';
import { VerifierTable } from '@/components/sssa/VerifierTable';
import Link from 'next/link';

const NAVY = '#1B2A6B';

export default async function SssaUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  // Tabs as links, so the page stays server-rendered and the view is shareable.
  const tab = sp.tab === 'verifiers' ? 'verifiers' : 'everyone';

  const session = await auth();
  // No actor argument: listUsers reads the session itself. The literal role that used to
  // be assembled here was the claim the action trusted.
  const { users, total, pageSize } = await listUsers({
    role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q, page,
  });

  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });

  const serialized = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  // The queue is still fetched for the verifier counts and load figures below; its
  // idle-verifiers banner went with the legacy assignment window.
  const queue = await buildVerificationQueue();

  const verifiers = tab === 'verifiers' ? await buildVerifierList() : [];
  const verifierCount = queue?.verifiers.length ?? 0;

  const tabs = [
    { id: 'everyone', label: 'Everyone', count: total ?? 0, href: '/app/sssa/users' },
    {
      id: 'verifiers',
      label: 'Verifiers',
      count: verifierCount,
      href: '/app/sssa/users?tab=verifiers',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Who can sign in, and what the verifiers among them are doing
        </p>
      </header>

      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => {
          const on = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold ${
                on ? 'text-[#1B2A6B]' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
              style={on ? { borderColor: NAVY } : undefined}
            >
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                  on ? 'bg-[#1B2A6B] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t.count.toLocaleString('en-IN')}
              </span>
            </Link>
          );
        })}
      </div>

      {tab === 'verifiers' ? (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Busiest first. Appealed is withheld below 20 checked verifications — a rate over three
            of them describes the sample, not the verifier.
          </p>
          <VerifierTable rows={verifiers} />
        </section>
      ) : (
        <UserListClient
          users={serialized} total={total ?? 0} pageSize={pageSize ?? 20} page={page}
          districts={districts}
          filters={{ role: sp.role, districtCode: sp.districtCode, active: sp.active, q: sp.q }}
          actorRole="SSSA_ADMIN" actorId={session!.user.id!} basePath="/app/sssa/users"
        />
      )}
    </div>
  );
}
