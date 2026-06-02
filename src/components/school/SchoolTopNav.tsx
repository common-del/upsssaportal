'use client';



import { AppShell } from '@/components/layout/AppShell';

import { SCHOOL_NAV_ITEMS } from '@/lib/appNavConfig';

import { isFeeDisclosureEligible } from '@/lib/school/helpers';



export function SchoolAdminLayout({

  schoolName,

  schoolInitials: initials,

  schoolCategory,

  unreadCount,

  children,

}: {

  schoolName: string;

  schoolInitials: string;

  schoolCategory: string;

  unreadCount: number;

  children: React.ReactNode;

}) {

  const showFeeDisclosure = isFeeDisclosureEligible(schoolCategory);

  const navItems = SCHOOL_NAV_ITEMS.filter((item) => !item.hideForGovt || showFeeDisclosure);



  return (

    <AppShell

      navItems={navItems}

      roleLabel="SCHOOL"

      userName={schoolName}

      brandHref="/app/school"

      notificationsHref="/app/school/notifications"

      unreadCount={unreadCount}

      fallbackHref="/app/school"

    >

      {children}

    </AppShell>

  );

}



/** @deprecated Use SchoolAdminLayout */

export function SchoolTopNav({

  schoolName,

  schoolInitials: initials,

  schoolCategory,

  unreadCount,

  children,

}: {

  schoolName: string;

  schoolInitials: string;

  schoolCategory: string;

  unreadCount: number;

  children: React.ReactNode;

}) {

  return (

    <SchoolAdminLayout

      schoolName={schoolName}

      schoolInitials={initials}

      schoolCategory={schoolCategory}

      unreadCount={unreadCount}

    >

      {children}

    </SchoolAdminLayout>

  );

}

