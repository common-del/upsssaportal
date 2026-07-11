'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ADMIN_NAV_ITEMS } from '@/lib/appNavConfig';

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
      navItems={ADMIN_NAV_ITEMS}
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
