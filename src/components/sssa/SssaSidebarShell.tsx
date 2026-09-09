'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { ADMIN_SIDEBAR_SECTIONS, type NavSection } from '@/lib/appNavConfig';

/**
 * The officials' portal frame. The frame itself now lives in SidebarShell, shared
 * with the school portal — this file is only the officials' three strings and their
 * nav. The layout may pass `sections` with live badges injected (the Decisions
 * count); without it the static config renders unchanged.
 */
export function SssaAdminLayout({
  userName,
  unreadCount = 0,
  sections,
  children,
}: {
  userName: string;
  unreadCount?: number;
  sections?: NavSection[];
  children: React.ReactNode;
}) {
  return (
    <SidebarShell
      sections={sections ?? ADMIN_SIDEBAR_SECTIONS}
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
