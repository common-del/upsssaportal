import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SupervisorAppLayout } from '@/components/layout/OversightLayouts';
import { brandHrefForRole } from '@/lib/appNavConfig';
import { unreadNotificationCount } from '@/lib/unreadNotifications';

export default async function SupervisorRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');

  const role = session.user.role as string;
  // SSSA PMU may enter to see what supervisors see; everyone else goes to their own area.
  if (role !== 'SUPERVISOR' && role !== 'SSSA_ADMIN') redirect(brandHrefForRole(role));

  const userName = session.user.name ?? session.user.id ?? 'Supervisor';
  const unreadCount = await unreadNotificationCount(session.user.id!);

  return (
    <SupervisorAppLayout userName={userName} unreadCount={unreadCount}>
      {children}
    </SupervisorAppLayout>
  );
}
