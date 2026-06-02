import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/app')) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req, secret });

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = token.role as string | undefined;

  if (pathname.startsWith('/app/sssa')) {
    if (role !== 'SSSA_ADMIN' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  if (pathname.startsWith('/app/dashboard')) {
    if (role !== 'SSSA_ADMIN' && role !== 'admin' && role !== 'DISTRICT_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // District admin scope enforcement: reject if trying to scope to another district
    if (role === 'DISTRICT_ADMIN') {
      const districtParam = req.nextUrl.searchParams.get('district');
      const userDistrictCode = (token as { districtCode?: string }).districtCode;
      if (districtParam && userDistrictCode && districtParam !== userDistrictCode) {
        return NextResponse.json({ error: 'Forbidden: district scope mismatch' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
