import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SssaAdminLayout } from '@/components/sssa/SssaSidebarShell';
import { unreadNotificationCount } from '@/lib/unreadNotifications';
import { countDecisions } from '@/lib/sssa/decisionsInbox';
import { ADMIN_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';

export default async function SssaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  const role = session.user.role;
  if (role !== 'SSSA_ADMIN' && role !== 'admin') redirect('/');

  const userName = session.user.name ?? session.user.id ?? 'Admin';
  const [unreadCount, decisionsCount] = await Promise.all([
    unreadNotificationCount(session.user.id!),
    countDecisions(),
  ]);

  // The Decisions badge is live per request: three cheap counts, so the sidebar
  // says how many rulings are waiting from any admin page.
  const sections = ADMIN_SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.href === '/app/sssa/decisions' ? { ...item, badge: decisionsCount } : item,
    ),
  }));

  return (
    <SssaAdminLayout userName={userName} unreadCount={unreadCount} sections={sections}>
      {children}
    </SssaAdminLayout>
  );
}
