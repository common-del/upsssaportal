import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { NotificationsClient } from '@/components/school/NotificationsClient';

export default async function DistrictNotificationsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  const role = session.user.role;
  if (role !== 'DISTRICT_OFFICIAL' && role !== 'DISTRICT_ADMIN') redirect('/');

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <NotificationsClient
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toLocaleString('en-IN'),
      }))}
    />
  );
}
