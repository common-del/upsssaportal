import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const routeRoleMap: Record<string, string[]> = {
  '/app/school': ['SCHOOL'],
  '/app/verifier': ['VERIFIER'],
  '/app/district': ['DISTRICT_OFFICIAL'],
  '/app/sssa': ['SSSA_ADMIN'],
};

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const role = token.role as string;
  for (const [prefix, allowed] of Object.entries(routeRoleMap)) {
    if (pathname.startsWith(prefix) && !allowed.includes(role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
