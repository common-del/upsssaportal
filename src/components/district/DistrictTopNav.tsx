'use client';

import { AppShell } from '@/components/layout/AppShell';
import { DISTRICT_NAV_ITEMS, type NavItem } from '@/lib/appNavConfig';

export function DistrictAdminLayout({
  userName,
  unreadCount = 0,
  navItems,
  brandHref,
  children,
}: {
  userName: string;
  unreadCount?: number;
  /** Defaults to the district official's nav; the layout passes the district admin's
   *  set instead when that role visits shared pages here, so their Dashboard entry
   *  keeps pointing at /app/dashboard, their actual home. */
  navItems?: NavItem[];
  brandHref?: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      navItems={navItems ?? DISTRICT_NAV_ITEMS}
      roleLabel="DISTRICT"
      userName={userName}
      brandHref={brandHref ?? '/app/district'}
      notificationsHref="/app/district/notifications"
      unreadCount={unreadCount}
      fallbackHref={brandHref ?? '/app/district'}
    >
      {children}
    </AppShell>
  );
}
