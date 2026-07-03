'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { href: '/public', label: 'Homepage' },
  { href: '/public/find', label: 'Schools' },
  { href: '/public#reports', label: 'Reports' },
  { href: '/public/compare', label: 'Compare Schools' },
  { href: '/public/about', label: 'About' },
] as const;

export function PublicNav() {
  const pathname = usePathname();
  const locale = useLocale();

  function toggleLocale() {
    const next = locale === 'en' ? 'hi' : 'en';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <header className="bg-[#1B2A6B] text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:py-4">
        <Link href="/public" className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5B731] text-sm font-bold text-[#1B2A6B]">
            UP
          </div>
          <div>
            <div className="text-base font-semibold leading-tight sm:text-lg">
              SSSA Uttar Pradesh
            </div>
            <p className="text-xs text-white/80 sm:text-sm">
              School Education Department, Uttar Pradesh
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 lg:gap-x-3">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === '/public'
                ? pathname === '/public'
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-2 py-1 text-sm transition-colors hover:bg-white/10',
                  active && 'bg-white/15 font-medium',
                )}
              >
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-full bg-[#F5B731] px-3 py-1 text-xs font-semibold text-[#1B2A6B] transition-opacity hover:opacity-90"
          >
            {locale === 'en' ? 'EN - Hindi' : 'Hindi - EN'}
          </button>
          <Link
            href="/login"
            className="rounded-lg border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-white/20"
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
