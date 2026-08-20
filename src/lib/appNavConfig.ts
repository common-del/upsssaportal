export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  hideForGovt?: boolean;
};

export type NavSection = { label?: string; items: NavItem[] };

/**
 * Seven working destinations, then a rule, then the four you touch rarely.
 *
 * The group headings are gone: at this length they labelled the obvious and each
 * cost a line of vertical space. Two entries were removed rather than renamed —
 * Analytics and Self Assessment Monitoring both answered "how is the cycle going
 * and what is wrong", which is now split between the Dashboard and the pages that
 * own each question.
 *
 * Appeals is no longer an entry: an appeal is one of the two ways a verification
 * ends, so it is a queue on Verification rather than a page of its own.
 *
 * Complaints stays separate, and should not be folded in with it. A parent
 * complaining about a school is a Ticket: filed on the public form, tracked by
 * mobile, escalating on `nextDueAt` through SCHOOL → DISTRICT → SSSA. A school
 * disputing its verification is an Appeal with AppealItem rows: one per school per
 * cycle, argued indicator by indicator, decided only by SSSA, with no ladder and no
 * clock. Different filer, different object, different resolution path. The only
 * thing they share is that someone is unhappy.
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
      { href: '/app/sssa/cohort', label: 'Field Cohort' },
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

/**
 * The school's own sidebar, in the same shape as the officials' above.
 *
 * Three of these entries are not new pages. Verifier Feedback and Complaints were
 * built, working, and linked from nowhere at all; Appeals was reachable only from
 * Verifier Feedback, which was itself unreachable. So the whole route by which a
 * school reads its verifier's reasoning, answers a parent, or contests a score was
 * closed — and complaints escalate on a `nextDueAt` clock whether the school ever
 * saw them or not.
 *
 * Labels lose the word "School": the sidebar sits inside the school's own portal, so
 * repeating it on four entries spends width a 232px column does not have.
 *
 * School Profile sits directly under the dashboard: it is the school's own record —
 * address, phone, photographs — and the thing the officials' Compliance page grades,
 * so it belongs above the cycle work rather than filed with the reference pages.
 */
export const SCHOOL_SIDEBAR_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app/school', label: 'Dashboard', exact: true },
      { href: '/app/school/profile', label: 'School Profile' },
      { href: '/app/school/sqaaf', label: 'SQAAF Update' },
      { href: '/app/school/evidence', label: 'Evidence Manager' },
      { href: '/app/school/documents', label: 'Mandatory Documents' },
      { href: '/app/school/fee-disclosure', label: 'Fee Disclosure', hideForGovt: true },
      { href: '/app/school/verifier-feedback', label: 'Verifier Feedback' },
      { href: '/app/school/appeals', label: 'Appeals' },
      { href: '/app/school/tickets', label: 'Complaints' },
      { href: '/app/school/improvement-plan', label: 'Improvement Plan' },
      { href: '/app/school/report-card', label: 'Report Card' },
    ],
  },
  {
    items: [
      { href: '/app/school/notifications', label: 'Notifications' },
      { href: '/app/school/help/sqaaf', label: 'How to fill SQAAF' },
      { href: '/app/school/faq', label: 'FAQ' },
      { href: '/app/school/settings', label: 'Settings' },
    ],
  },
];

export const VERIFIER_NAV_ITEMS: NavItem[] = [
  { href: '/app/verifier', label: 'My Assignments', exact: true },
  { href: '/app/verifier/desk', label: 'Desk Screening' },
  { href: '/app/verifier/assignments', label: 'Field Assignments' },
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

/**
 * The four verification roles route to the verifier portal, not to the officials' one.
 *
 * Without them listed here they fell through to OFFICIAL and /app/sssa, so an Online Verifier
 * signing in would land on the SSSA dashboard and be bounced straight back out by middleware,
 * which role-gates that prefix. A login that ends in a redirect loop is indistinguishable from
 * a broken account.
 *
 * SUPERVISOR and AUDIT_CELL are grouped here too for now. Both oversee verification work and
 * both need screens that do not exist yet; sending them to the verifier portal is the closest
 * true answer until their own areas are built, and it is better than a dashboard they cannot
 * open.
 */
const VERIFICATION_ROLES = new Set([
  'VERIFIER',
  'ONLINE_VERIFIER',
  'ONGROUND_VERIFIER',
  'SUPERVISOR',
  'AUDIT_CELL',
]);

export function roleLabelForRole(role: string): RoleLabel {
  if (role === 'SCHOOL' || role === 'SCHOOL_USER') return 'SCHOOL';
  if (VERIFICATION_ROLES.has(role)) return 'VERIFIER';
  if (role === 'DISTRICT_OFFICIAL' || role === 'DISTRICT_ADMIN') return 'DISTRICT';
  return 'OFFICIAL';
}

export function brandHrefForRole(role: string): string {
  if (role === 'SCHOOL' || role === 'SCHOOL_USER') return '/app/school';
  if (VERIFICATION_ROLES.has(role)) return '/app/verifier';
  if (role === 'DISTRICT_OFFICIAL' || role === 'DISTRICT_ADMIN') return '/app/district';
  return '/app/sssa';
}

export function fallbackHrefForRole(role: string): string {
  return brandHrefForRole(role);
}
