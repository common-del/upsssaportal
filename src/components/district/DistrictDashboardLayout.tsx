'use client';



import { AppShell } from '@/components/layout/AppShell';

import { DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS } from '@/lib/appNavConfig';



export function DistrictDashboardLayout({

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

      navItems={DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS}

      roleLabel="DISTRICT"

      userName={userName}

      brandHref="/app/dashboard"

      notificationsHref="/app/district/notifications"

      unreadCount={unreadCount}

      fallbackHref="/app/dashboard"

    >

      {children}

    </AppShell>

  );

}

