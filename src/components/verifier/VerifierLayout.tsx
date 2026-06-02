'use client';



import { AppShell } from '@/components/layout/AppShell';

import { VERIFIER_NAV_ITEMS } from '@/lib/appNavConfig';



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

    <AppShell

      navItems={VERIFIER_NAV_ITEMS}

      roleLabel="VERIFIER"

      userName={userName}

      brandHref="/app/verifier"

      notificationsHref="/app/verifier/notifications"

      unreadCount={unreadCount}

      fallbackHref="/app/verifier"

    >

      {children}

    </AppShell>

  );

}

