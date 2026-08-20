'use client';

import { AppShell } from '@/components/layout/AppShell';
import { AUDIT_NAV_ITEMS, SUPERVISOR_NAV_ITEMS } from '@/lib/appNavConfig';

/**
 * The shells for the two oversight areas built in step 7. Same chrome as the verifier
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
    <AppShell
      navItems={SUPERVISOR_NAV_ITEMS}
      roleLabel="SUPERVISOR"
      userName={userName}
      brandHref="/app/supervisor"
      notificationsHref="/app/supervisor/notifications"
      unreadCount={unreadCount}
      fallbackHref="/app/supervisor"
    >
      {children}
    </AppShell>
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
    <AppShell
      navItems={AUDIT_NAV_ITEMS}
      roleLabel="AUDIT"
      userName={userName}
      brandHref="/app/audit"
      notificationsHref="/app/audit/notifications"
      unreadCount={unreadCount}
      fallbackHref="/app/audit"
    >
      {children}
    </AppShell>
  );
}
