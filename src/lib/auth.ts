import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

/**
 * All four login tabs verify a password. Three of them did not.
 *
 * `credentials-sssa`, `credentials-verifier` and `credentials-district` used to declare
 * `authorize()` with no credentials parameter at all and return the first active user of
 * the role, so anyone reaching the login page could sign in as an SSSA administrator with
 * any password, or none. The school tab checked bcrypt but exempted the username
 * "school", which had the same effect for that one account.
 *
 * Nothing about the demo needs that. Every demo account is seeded with a real bcrypt hash
 * of the password the login form already prefills, so clicking through a demo still works
 * unchanged. The only behaviour that changes is that a wrong password now fails.
 *
 * Still outstanding, and not fixable here: the demo passwords are weak, published in
 * `demoCredentials.ts`, and every one of the ~32,000 school accounts shares `school123`
 * from `backfillSchoolAccounts.ts`. Rotating those and forcing a change at first login is
 * a separate change that touches every account, so it needs SSSA's decision rather than
 * being folded in silently here.
 */
async function authorizeWithPassword(
  credentials: Partial<Record<string, unknown>> | undefined,
  allowedRoles: string[],
) {
  const username = (credentials?.username as string | undefined)?.trim();
  const password = credentials?.password as string | undefined;

  // Both required. An empty password must never reach bcrypt.compare, because comparing
  // "" against a hash is a legitimate false rather than a reason to skip the check.
  if (!username || !password) return null;

  const { prisma } = await import('./db');
  const user = await prisma.user.findUnique({ where: { username } });

  // Same null for every failure: unknown user, wrong password, deactivated account, or
  // right password on the wrong tab. Distinguishing them would let the form be used to
  // enumerate which usernames and roles exist.
  if (!user || !user.active || !allowedRoles.includes(user.role)) return null;

  const bcrypt = await import('bcryptjs');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    name: user.username,
    role: user.role,
    districtCode: user.districtCode,
  };
}

const demoCredentialsFields = {
  username: { label: 'Username', type: 'text' },
  password: { label: 'Password', type: 'password' },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'credentials-sssa',
      name: 'SSSA System',
      credentials: demoCredentialsFields,
      async authorize(credentials) {
        // The Official tab's own hint says "For SSSA and district officials", but this
        // list refused the district roles, so district1 could not sign in anywhere: the
        // only tab that claimed them posted to a provider that turned them away.
        return authorizeWithPassword(credentials, [
          'SSSA_ADMIN',
          'admin',
          'DISTRICT_OFFICIAL',
          'DISTRICT_ADMIN',
        ]);
      },
    }),
    Credentials({
      id: 'credentials-school',
      name: 'School',
      credentials: demoCredentialsFields,
      async authorize(credentials) {
        return authorizeWithPassword(credentials, ['SCHOOL_USER', 'SCHOOL']);
      },
    }),
    Credentials({
      id: 'credentials-verifier',
      name: 'Verifier',
      credentials: demoCredentialsFields,
      // The verification roles share this tab. ONLINE_VERIFIER, ONGROUND_VERIFIER,
      // SUPERVISOR and AUDIT_CELL are listed so accounts created for the SQAAF pipeline
      // can sign in without a fifth tab; the role still decides what they then see.
      async authorize(credentials) {
        return authorizeWithPassword(credentials, [
          'VERIFIER',
          'ONLINE_VERIFIER',
          'ONGROUND_VERIFIER',
          'SUPERVISOR',
          'AUDIT_CELL',
        ]);
      },
    }),
    Credentials({
      id: 'credentials-district',
      name: 'District',
      credentials: demoCredentialsFields,
      async authorize(credentials) {
        return authorizeWithPassword(credentials, ['DISTRICT_ADMIN', 'DISTRICT_OFFICIAL']);
      },
    }),
  ],
});
