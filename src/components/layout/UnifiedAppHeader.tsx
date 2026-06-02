'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavItem, RoleLabel } from '@/lib/appNavConfig';

const NAVY = '#1B2A6B';
const YELLOW = '#F5B731';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavPill({
  href,
  label,
  exact,
  pathname,
}: {
  href: string;
  label: string;
  exact?: boolean;
  pathname: string;
}) {
  const active = isActive(pathname, href, exact);
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'text-[#1B2A6B]' : 'text-white/80 hover:bg-white/10 hover:text-white',
      )}
      style={active ? { backgroundColor: YELLOW } : undefined}
    >
      {label}
    </Link>
  );
}

export function UnifiedAppHeader({
  navItems,
  roleLabel,
  userName,
  brandHref = '/app/dashboard',
  notificationsHref,
  unreadCount = 0,
}: {
  navItems: NavItem[];
  roleLabel: RoleLabel;
  userName: string;
  brandHref?: string;
  notificationsHref: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1440);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function updateWidth() {
      setViewportWidth(window.innerWidth);
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  function toggleLocale() {
    const next = locale === 'en' ? 'hi' : 'en';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  const showMobileMenu = viewportWidth < 1024;
  const showDesktopNav = viewportWidth >= 1024;

  return (
    <header
      className="sticky top-0 z-50 text-white shadow-md print:hidden"
      style={{ backgroundColor: NAVY }}
    >
      {/* Row 1: brand + actions (~64px) */}
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        <Link href={brandHref} className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: YELLOW, color: NAVY }}
          >
            UP
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-white sm:text-base">SSSA Uttar Pradesh</p>
            <p className="truncate text-xs text-white/70">School Education Department, Uttar Pradesh</p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleLocale}
            className="hidden items-center gap-0.5 rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10 sm:flex"
            aria-label="Toggle language"
          >
            <span className={cn(locale === 'en' && 'font-bold')}>EN</span>
            <span className="text-white/50">|</span>
            <span className={cn(locale === 'hi' && 'font-bold')}>हिंदी</span>
          </button>

          <Link
            href={notificationsHref}
            className="inline-flex items-center justify-center rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Notifications"
          >
            <span className="inline-flex items-center gap-1">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
          </Link>

          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ backgroundColor: YELLOW, color: NAVY }}
          >
            {roleLabel}
          </span>

          <span className="hidden max-w-[140px] truncate text-sm text-white sm:inline">{userName}</span>

          {showMobileMenu && (
            <button
              type="button"
              className="rounded-lg p-2 text-white hover:bg-white/10"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Row 2: nav pills (~52px), desktop only */}
      {showDesktopNav && (
        <div className="mx-auto flex h-[52px] max-w-[1600px] items-center px-6">
          <nav className="flex flex-wrap items-center gap-2 lg:gap-3">
            {navItems.map(({ href, label, exact }) => (
              <NavPill key={href} href={href} label={label} exact={exact} pathname={pathname} />
            ))}
          </nav>
        </div>
      )}

      {showMobileMenu && mobileOpen && (
        <nav className="px-6 pb-4">
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium text-white"
            >
              <span className={locale === 'en' ? 'font-bold' : ''}>EN</span>
              <span className="text-white/50"> | </span>
              <span className={locale === 'hi' ? 'font-bold' : ''}>हिंदी</span>
            </button>
            <span className="max-w-[120px] truncate text-sm text-white">{userName}</span>
          </div>
          <div className="flex flex-col gap-1">
            {navItems.map(({ href, label, exact }) => {
              const active = isActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    active ? 'text-[#1B2A6B]' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  )}
                  style={active ? { backgroundColor: YELLOW } : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
