export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  hideForGovt?: boolean;
};

export type NavSection = { label?: string; items: NavItem[] };

/**
 * Eight working destinations, then a rule, then the three you touch rarely.
 *
 * The group headings are gone: at this length they labelled the obvious and each
 * cost a line of vertical space. Two entries were removed rather than renamed —
 * Analytics and Self Assessment Monitoring both answered "how is the cycle going
 * and what is wrong", which is now split between the Dashboard and the pages that
 * own each question.
 *
 * Complaints and Appeals are separate entries because they are separate mechanisms,
 * not two views of one queue. A parent complaining about a school is a Ticket: filed
 * on the public form, tracked by mobile, escalating on `nextDueAt` through
 * SCHOOL → DISTRICT → SSSA. A school disputing its verification is an Appeal with
 * AppealItem rows: one per school per cycle, argued indicator by indicator, decided
 * only by SSSA, with no ladder and no clock. Different filer, different object,
 * different resolution path. The only thing they share is that someone is unhappy.
 *
 * `exact` is required on the Dashboard: without it the prefix match would light it
 * up on every /app/sssa/* page.
 */
export const ADMIN_SIDEBAR_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app/sssa', label: 'Dashboard', exact: true },
      { href: '/app/sssa/schools', label: 'Schools' },
      { href: '/app/sssa/compliance', label: 'Compliance' },
      // Verification carries appeals as a tab. An appeal is one of the two ways a
      // verification ends, so a separate sidebar item split one process in half and
      // listed appealed schools in two places at once.
      { href: '/app/sssa/verifiers', label: 'Verification' },
      { href: '/app/sssa/disputes', label: 'Complaints' },
      { href: '/app/sssa/framework', label: 'Framework' },
      { href: '/app/sssa/users', label: 'Users' },
    ],
  },
  {
    items: [
      { href: '/app/sssa/notifications', label: 'Notifications' },
      // Built, working, and reachable from nowhere until now. It sits in the
      // utility group rather than above with the workflow pages: an audit trail is
      // something you go looking for, not part of anyone's daily round.
      { href: '/app/sssa/activity', label: 'Activity log' },
      { href: '/app/sssa/help/sqaaf', label: 'Help' },
      { href: '/app/sssa/settings', label: 'Settings' },
    ],
  },
];

export const DISTRICT_NAV_ITEMS: NavItem[] = [
  { href: '/app/district', label: 'Dashboard', exact: true },
  { href: '/app/sssa/monitoring', label: 'Self Assessment Monitoring' },
  { href: '/app/district/tickets', label: 'Dispute Resolution' },
  { href: '/app/district/help/sqaaf', label: 'How to fill SQAAF' },
  { href: '/app/district/faq', label: 'FAQ' },
];

export const DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS: NavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', exact: true },
  { href: '/app/sssa/monitoring', label: 'Self Assessment Monitoring' },
  { href: '/app/sssa/disputes', label: 'Dispute Resolution' },
  { href: '/app/dashboard/help/sqaaf', label: 'How to fill SQAAF' },
  { href: '/app/dashboard/faq', label: 'FAQ' },
];

export const SCHOOL_NAV_ITEMS: NavItem[] = [
  { href: '/app/school', label: 'School Dashboard', exact: true },
  { href: '/app/school/sqaaf', label: 'SQAAF Update' },
  { href: '/app/school/evidence', label: 'Evidence Manager' },
  { href: '/app/school/documents', label: 'Mandatory Required Documents' },
  { href: '/app/school/fee-disclosure', label: 'Fee Disclosure', hideForGovt: true },
  { href: '/app/school/report-card', label: 'School Report Card' },
  { href: '/app/school/help/sqaaf', label: 'How to fill SQAAF' },
  { href: '/app/school/faq', label: 'FAQ' },
  { href: '/app/school/settings', label: 'Settings' },
];

export const VERIFIER_NAV_ITEMS: NavItem[] = [
  { href: '/app/verifier', label: 'My Assignments', exact: true },
  { href: '/app/verifier/help/sqaaf', label: 'How to fill SQAAF' },
  { href: '/app/verifier/faq', label: 'FAQ' },
  { href: '/app/verifier/settings', label: 'Settings' },
];

export const NOTIFICATIONS_HREF = {
  school: '/app/school/notifications',
  verifier: '/app/verifier/notifications',
  district: '/app/district/notifications',
  sssa: '/app/sssa/notifications',
} as const;

export function notificationsHrefForBrand(brandHref: string): string {
  if (brandHref.startsWith('/app/school')) return NOTIFICATIONS_HREF.school;
  if (brandHref.startsWith('/app/verifier')) return NOTIFICATIONS_HREF.verifier;
  if (brandHref.startsWith('/app/district')) return NOTIFICATIONS_HREF.district;
  return NOTIFICATIONS_HREF.sssa;
}

export type RoleLabel = 'OFFICIAL' | 'DISTRICT' | 'SCHOOL' | 'VERIFIER';

export function roleLabelForRole(role: string): RoleLabel {
  if (role === 'SCHOOL' || role === 'SCHOOL_USER') return 'SCHOOL';
  if (role === 'VERIFIER') return 'VERIFIER';
  if (role === 'DISTRICT_OFFICIAL' || role === 'DISTRICT_ADMIN') return 'DISTRICT';
  return 'OFFICIAL';
}

export function brandHrefForRole(role: string): string {
  if (role === 'SCHOOL' || role === 'SCHOOL_USER') return '/app/school';
  if (role === 'VERIFIER') return '/app/verifier';
  if (role === 'DISTRICT_OFFICIAL' || role === 'DISTRICT_ADMIN') return '/app/district';
  return '/app/sssa';
}

export function fallbackHrefForRole(role: string): string {
  return brandHrefForRole(role);
}
