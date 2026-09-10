'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { verifierSidebarSections } from '@/lib/appNavConfig';

/**
 * The verifier portal frame, on the same pinned sidebar as the school and SSSA portals.
 * The nav is per cell: the online and on-ground verifiers are separate people with
 * separate work, so neither sees the other's queues.
 */
export function VerifierAppLayout({
  role,
  userName,
  unreadCount = 0,
  children,
}: {
  role: string;
  userName: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <SidebarShell
      sections={verifierSidebarSections(role)}
      roleLabel="VERIFIER"
      userName={userName}
      brandHref="/app/verifier"
      notificationsHref="/app/verifier/notifications"
      unreadCount={unreadCount}
    >
      {children}
    </SidebarShell>
  );
}
