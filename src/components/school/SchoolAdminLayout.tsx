'use client';

import { SidebarShell } from '@/components/layout/SidebarShell';
import { SCHOOL_SIDEBAR_SECTIONS } from '@/lib/appNavConfig';
import { isFeeDisclosureEligible } from '@/lib/school/helpers';

/**
 * The school portal frame. A pinned sidebar now, the same one the officials' portal
 * uses, so the two halves of the portal read as one product.
 *
 * Fee Disclosure is filtered here rather than in the shell: whether a school is asked
 * to disclose fees is a fact about the school, which the shell has no business
 * knowing.
 */
export function SchoolAdminLayout({
  schoolName,
  schoolCategory,
  unreadCount,
  children,
}: {
  schoolName: string;
  schoolCategory: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const showFeeDisclosure = isFeeDisclosureEligible(schoolCategory);

  const sections = SCHOOL_SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.hideForGovt || showFeeDisclosure),
  }));

  return (
    <SidebarShell
      sections={sections}
      roleLabel="SCHOOL"
      userName={schoolName}
      brandHref="/app/school"
      notificationsHref="/app/school/notifications"
      unreadCount={unreadCount}
    >
      {children}
    </SidebarShell>
  );
}
