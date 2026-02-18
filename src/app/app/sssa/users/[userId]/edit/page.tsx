import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getUserAuditLogs } from '@/lib/actions/users';
import EditUserForm from '@/components/users/EditUserForm';

export default async function SssaEditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const { userId } = await params;
  const t = await getTranslations('userMgmt');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, role: true, districtCode: true, verifierCapacity: true, active: true, verifierDistricts: { select: { districtCode: true } } },
  });
  if (!user) notFound();

  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });
  const logs = await getUserAuditLogs(userId);
  const serializedLogs = logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), metadata: l.metadata as Record<string, unknown> }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/app/sssa/users" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToUsers')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('editTitle')}: {user.username}</h1>
      <EditUserForm
        actorId={session.user.id!} actorRole="SSSA_ADMIN"
        user={user} districts={districts} auditLogs={serializedLogs}
        backPath="/app/sssa/users"
      />
    </div>
  );
}
