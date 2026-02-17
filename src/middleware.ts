import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Check for session cookie (NextAuth v5 uses authjs.* prefix)
  const token =
    req.cookies.get('authjs.session-token')?.value ||
    req.cookies.get('__Secure-authjs.session-token')?.value ||
    req.cookies.get('next-auth.session-token')?.value ||
    req.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Role-based access is enforced in each page component via auth()
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
