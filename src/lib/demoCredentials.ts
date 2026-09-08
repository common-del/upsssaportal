/**
 * Demo login: provider ids for NextAuth Credentials providers, and prefill values
 * matching the first user of each role in prisma/seed.ts (ordered as in seed).
 */
export const DEMO_CREDENTIAL_PROVIDER_IDS = {
  SSSA: 'credentials-sssa',
  SCHOOL: 'credentials-school',
  VERIFIER: 'credentials-verifier',
  DISTRICT: 'credentials-district',
} as const;

export type DemoCredentialProviderId =
  (typeof DEMO_CREDENTIAL_PROVIDER_IDS)[keyof typeof DEMO_CREDENTIAL_PROVIDER_IDS];

export const DEMO_LOGIN_PREFILL: Record<
  DemoCredentialProviderId,
  { username: string; password: string }
> = {
  'credentials-sssa': { username: 'sssa', password: 'admin123' },
  'credentials-school': { username: '11111111111', password: 'school123' },
  'credentials-verifier': { username: 'verifier1', password: 'verifier123' },
  'credentials-district': { username: 'district1', password: 'district123' },
};

export type DemoCredentialSet = {
  label: string;
  /** One line on what this account sees, so a demo audience knows why to pick it. */
  detail: string;
  username: string;
  password: string;
  /** The dot beside the row. Follows the portal's track colours. */
  dot: string;
};

/**
 * The credential sets printed on the login page, per tab.
 *
 * DEMONSTRATION BUILD ONLY. This deliberately puts working passwords on a public page so a
 * demo audience can walk every role without a handout. Removing the panel for a real
 * deployment is deleting this export and the block that renders it in
 * src/app/login/page.tsx; rotate every password below at the same time, because they are
 * also committed in the seed files.
 *
 * Accounts come from prisma/seed.ts and prisma/seedVerificationWorkforce.ts. Every row is
 * accepted by the provider its tab posts to; a row that the tab would refuse is worse than
 * no row, because it demonstrates a bug instead of a feature.
 */
export const DEMO_CREDENTIAL_SETS: Record<'official' | 'school' | 'verifier', DemoCredentialSet[]> = {
  official: [
    {
      label: 'SSSA PMU',
      detail: 'Everything: configuration, cohort build, reporting, publication.',
      username: 'sssa',
      password: 'admin123',
      dot: '#1B2A6B',
    },
    {
      label: 'District Official',
      detail: 'One district\'s monitoring and dispute resolution.',
      username: 'district1',
      password: 'district123',
      dot: '#0E7A46',
    },
  ],
  school: [
    {
      label: 'Demo School, full story',
      detail: 'Filled self assessment, verifier feedback, an appeal, complaints, report card.',
      username: 'school',
      password: 'school-demo',
      dot: '#0E7A46',
    },
    {
      label: 'Register School, blank',
      detail: 'A bare account for walking the self assessment from the start. Every registered school signs in with its UDISE code and school123.',
      username: '11111111111',
      password: 'school123',
      dot: '#1B2A6B',
    },
  ],
  // Two rows, matching the two verifier jobs. Supervision and audit are admin functions
  // now: their screens live under the SSSA login and their demo accounts (supervisor1,
  // supervisor2, audit1) are deactivated by the workforce seed. verifier1, the first
  // seeded account on the legacy assignment screens, still signs in but is not offered
  // here — a demo audience should meet the two roles the programme actually staffs.
  verifier: [
    {
      label: 'Online Verifier',
      detail: 'Desk screening and video walkthroughs, schools masked.',
      username: 'online1',
      password: 'verifier123',
      dot: '#1F3864',
    },
    {
      label: 'On-Ground Verifier',
      detail: 'Field assignments, sealed until the morning of the visit.',
      username: 'field1',
      password: 'verifier123',
      dot: '#BF9000',
    },
  ],
};
