'use client';

import { usePathname } from 'next/navigation';

/** Legacy public header — hidden on all authenticated /app routes (each role has its own unified header). */
export function Header() {
  const pathname = usePathname();

  if (pathname.startsWith('/public') || pathname === '/login' || pathname.startsWith('/app')) {
    return null;
  }

  return null;
}
