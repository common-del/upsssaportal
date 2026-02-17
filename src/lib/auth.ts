import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize() {
        // Stub — login logic will be wired in Step 2
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/school', // placeholder — real login pages added in Step 2
  },
  session: { strategy: 'jwt' },
});
