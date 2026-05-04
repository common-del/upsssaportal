import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

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
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
      async authorize() {
        return authorizeDemoFirstUser(['SCHOOL_USER', 'SCHOOL']);
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
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.districtCode = user.districtCode;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as string;
      session.user.districtCode = (token.districtCode as string) ?? null;
      return session;
    },
  },
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
});
