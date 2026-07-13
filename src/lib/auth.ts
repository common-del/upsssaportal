import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

async function authorizeDemoFirstUser(roles: string[]) {
  const { prisma } = await import('./db');
  const user = await prisma.user.findFirst({
    where: { active: true, role: { in: roles } },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) return null;
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
      async authorize() {
        return authorizeDemoFirstUser(['SSSA_ADMIN', 'admin']);
      },
    }),
    Credentials({
      id: 'credentials-school',
      name: 'School',
      credentials: demoCredentialsFields,
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim();
        if (!username) return null;

        const { prisma } = await import('./db');

        // Convenience demo login: username "school" always reaches the same
        // designated demo account, password not checked - matches the other
        // demo-tab providers below. Any other username goes through a real
        // username+password check so different school accounts (e.g. real
        // UDISE logins) can actually be distinguished from one another.
        if (username.toLowerCase() === 'school') {
          const user = await prisma.user.findFirst({
            where: { username: 'school', active: true, role: { in: ['SCHOOL_USER', 'SCHOOL'] } },
          });
          if (!user) return null;
          return { id: user.id, name: user.username, role: user.role, districtCode: user.districtCode };
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active || !['SCHOOL_USER', 'SCHOOL'].includes(user.role)) return null;

        const bcrypt = await import('bcryptjs');
        const valid = await bcrypt.compare(String(credentials?.password ?? ''), user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.username, role: user.role, districtCode: user.districtCode };
      },
    }),
    Credentials({
      id: 'credentials-verifier',
      name: 'Verifier',
      credentials: demoCredentialsFields,
      async authorize() {
        return authorizeDemoFirstUser(['VERIFIER']);
      },
    }),
    Credentials({
      id: 'credentials-district',
      name: 'District',
      credentials: demoCredentialsFields,
      async authorize() {
        return authorizeDemoFirstUser(['DISTRICT_ADMIN', 'DISTRICT_OFFICIAL']);
      },
    }),
  ],
});
