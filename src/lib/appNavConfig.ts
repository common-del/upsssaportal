export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  hideForGovt?: boolean;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', exact: true },
  { href: '/app/sssa/monitoring', label: 'Self Assessment Monitoring' },
  { href: '/app/sssa/framework', label: 'SQAAF Framework Builder' },
  { href: '/app/sssa/verifiers', label: 'Verifier Assignment' },
  { href: '/app/sssa/disputes', label: 'Dispute Resolution' },
  { href: '/app/sssa/users', label: 'User Management' },
];

export const DISTRICT_NAV_ITEMS: NavItem[] = [
  { href: '/app/district', label: 'Dashboard', exact: true },
  { href: '/app/sssa/monitoring', label: 'Self Assessment Monitoring' },
  { href: '/app/district/tickets', label: 'Dispute Resolution' },
];

export const DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS: NavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', exact: true },
  { href: '/app/sssa/monitoring', label: 'Self Assessment Monitoring' },
  { href: '/app/sssa/disputes', label: 'Dispute Resolution' },
];

export const SCHOOL_NAV_ITEMS: NavItem[] = [
  { href: '/app/school', label: 'School Dashboard', exact: true },
  { href: '/app/school/sqaaf', label: 'SQAAF Update' },
  { href: '/app/school/evidence', label: 'Evidence Manager' },
  { href: '/app/school/documents', label: 'Mandatory Required Documents' },
  { href: '/app/school/fee-disclosure', label: 'Fee Disclosure', hideForGovt: true },
  { href: '/app/school/report-card', label: 'School Report Card' },
  { href: '/app/school/settings', label: 'Settings' },
];

export const VERIFIER_NAV_ITEMS: NavItem[] = [
  { href: '/app/verifier', label: 'My Assignments', exact: true },
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
  return '/app/dashboard';
}

export function fallbackHrefForRole(role: string): string {
  return brandHrefForRole(role);
}
