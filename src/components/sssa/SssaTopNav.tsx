'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ADMIN_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';

/** @deprecated Only reached via the legacy /app/dashboard route for SSSA_ADMIN;
 * the live SSSA_ADMIN experience is the sidebar shell at /app/sssa (SssaSidebarShell.tsx). */
const FLAT_NAV_ITEMS = ADMIN_SIDEBAR_SECTIONS.flatMap((s) => s.items);

export function SssaAdminLayout({
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
      navItems={FLAT_NAV_ITEMS}
      roleLabel="OFFICIAL"
      userName={userName}
      brandHref="/app/sssa"
      notificationsHref="/app/sssa/notifications"
      unreadCount={unreadCount}
      fallbackHref="/app/sssa"
    >
      {children}
    </AppShell>
  );
}

/** @deprecated Use SssaAdminLayout */
export const SssaTopNav = SssaAdminLayout;
