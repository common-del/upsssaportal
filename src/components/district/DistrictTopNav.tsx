'use client';



import { AppShell } from '@/components/layout/AppShell';

import { DISTRICT_NAV_ITEMS } from '@/lib/appNavConfig';



export function DistrictAdminLayout({

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

      navItems={DISTRICT_NAV_ITEMS}

      roleLabel="DISTRICT"

      userName={userName}

      brandHref="/app/district"

      notificationsHref="/app/district/notifications"

      unreadCount={unreadCount}

      fallbackHref="/app/district"

    >

      {children}

    </AppShell>

  );

}

