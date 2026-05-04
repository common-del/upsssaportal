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
