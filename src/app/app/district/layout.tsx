import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DistrictAdminLayout } from '@/components/district/DistrictTopNav';
import { DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS } from '@/lib/appNavConfig';
import { unreadNotificationCount } from '@/lib/unreadNotifications';

/**
 * Both district roles share this portal now. District admins used to be linked into
 * /app/sssa pages that middleware bounced them out of; their Monitoring and Dispute
 * Resolution live here instead, so the layout admits them — with their own nav, whose
 * Dashboard entry stays /app/dashboard, their actual home.
 */
export default async function DistrictLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  const role = session.user.role;
  if (role !== 'DISTRICT_OFFICIAL' && role !== 'DISTRICT_ADMIN') redirect('/');

  const userName = session.user.name ?? session.user.id ?? 'District Admin';
  const unreadCount = await unreadNotificationCount(session.user.id!);

  return (
    <DistrictAdminLayout
      userName={userName}
      unreadCount={unreadCount}
      navItems={role === 'DISTRICT_ADMIN' ? DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS : undefined}
      brandHref={role === 'DISTRICT_ADMIN' ? '/app/dashboard' : undefined}
    >
      {children}
    </DistrictAdminLayout>
  );
}
