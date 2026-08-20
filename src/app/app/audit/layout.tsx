import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuditAppLayout } from '@/components/layout/OversightLayouts';
import { brandHrefForRole } from '@/lib/appNavConfig';
import { unreadNotificationCount } from '@/lib/unreadNotifications';

export default async function AuditRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');

  const role = session.user.role as string;
  // The Audit Cell's independence cuts both ways: supervisors do not enter here. SSSA PMU
  // may, because the role table gives it everything.
  if (role !== 'AUDIT_CELL' && role !== 'SSSA_ADMIN') redirect(brandHrefForRole(role));

  const userName = session.user.name ?? session.user.id ?? 'Audit Cell';
  const unreadCount = await unreadNotificationCount(session.user.id!);

  return (
    <AuditAppLayout userName={userName} unreadCount={unreadCount}>
      {children}
    </AuditAppLayout>
  );
}
