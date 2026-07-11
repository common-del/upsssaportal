import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SssaAdminLayout } from '@/components/sssa/SssaSidebarShell';
import { unreadNotificationCount } from '@/lib/unreadNotifications';

export default async function SssaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  const role = session.user.role;
  if (role !== 'SSSA_ADMIN' && role !== 'admin') redirect('/');

  const userName = session.user.name ?? session.user.id ?? 'Admin';
  const unreadCount = await unreadNotificationCount(session.user.id!);

  return <SssaAdminLayout userName={userName} unreadCount={unreadCount}>{children}</SssaAdminLayout>;
}
