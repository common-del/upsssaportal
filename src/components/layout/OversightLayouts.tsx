'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { AUDIT_SIDEBAR_SECTIONS, SUPERVISOR_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';

/**
 * The shells for the two oversight areas. On the same pinned sidebar as every other
 * portal, because a supervisor moves between their area and escalated desk cases and the
 * furniture should not change under them.
 */

export function SupervisorAppLayout({
  userName,
  unreadCount = 0,
  children,
}: {
  userName: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <SidebarShell
      sections={SUPERVISOR_SIDEBAR_SECTIONS}
      roleLabel="SUPERVISOR"
      userName={userName}
      brandHref="/app/supervisor"
      notificationsHref="/app/supervisor/notifications"
      unreadCount={unreadCount}
    >
      {children}
    </SidebarShell>
  );
}

export function AuditAppLayout({
  userName,
  unreadCount = 0,
  children,
}: {
  userName: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <SidebarShell
      sections={AUDIT_SIDEBAR_SECTIONS}
      roleLabel="AUDIT"
      userName={userName}
      brandHref="/app/audit"
      notificationsHref="/app/audit/notifications"
      unreadCount={unreadCount}
    >
      {children}
    </SidebarShell>
  );
}
