'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { ADMIN_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';

/**
 * The officials' portal frame. The frame itself now lives in SidebarShell, shared
 * with the school portal — this file is only the officials' three strings and their
 * nav.
 */
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
    <SidebarShell
      sections={ADMIN_SIDEBAR_SECTIONS}
      roleLabel="OFFICIAL"
      userName={userName}
      brandHref="/app/sssa"
      notificationsHref="/app/sssa/notifications"
      unreadCount={unreadCount}
    >
      {children}
    </SidebarShell>
  );
}

/** @deprecated Use SssaAdminLayout */
export const SssaTopNav = SssaAdminLayout;
