'use client';

import { UnifiedAppHeader } from '@/components/layout/UnifiedAppHeader';
import { AdminBackButton } from '@/components/admin/AdminBackButton';
import type { NavItem, RoleLabel } from '@/lib/appNavConfig';

export function AppShell({
  navItems,
  roleLabel,
  userName,
  brandHref,
  notificationsHref,
  unreadCount,
  fallbackHref,
  children,
}: {
  navItems: NavItem[];
  roleLabel: RoleLabel;
  userName: string;
  brandHref: string;
  notificationsHref: string;
  unreadCount?: number;
  fallbackHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <UnifiedAppHeader
        navItems={navItems}
        roleLabel={roleLabel}
        userName={userName}
        brandHref={brandHref}
        notificationsHref={notificationsHref}
        unreadCount={unreadCount}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <AdminBackButton fallbackHref={fallbackHref} />
        {children}
      </main>
    </div>
  );
}
