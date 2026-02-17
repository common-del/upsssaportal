import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role?: string;
    districtCode?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      districtCode: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    districtCode?: string | null;
  }
}
