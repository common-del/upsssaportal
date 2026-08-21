'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { VERIFIER_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';

/**
 * The verifier portal frame, on the same pinned sidebar as the school and SSSA portals.
 * It ran on the top-bar shell until the workforce actually used it: seven destinations
 * wrapped onto a second row of pills at laptop width, and the portal looked like a
 * different product from the one it sits beside.
 */
export function VerifierAppLayout({
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
      sections={VERIFIER_SIDEBAR_SECTIONS}
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
