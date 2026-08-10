'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavSection, RoleLabel } from '@/lib/appNavConfig';
import { AdminBackButton } from '@/components/admin/AdminBackButton';

/**
 * The pinned-sidebar app frame, shared by every role that uses one.
 *
 * This was the SSSA layout, copied nowhere and used once. The school portal ran on
 * a two-row top nav instead, which meant the two halves of the same portal did not
 * look like the same product — and a school with twelve destinations was wrapping
 * pills onto a second line while the officials' eleven sat in a column.
 *
 * Kept as one component rather than two similar ones on purpose: the header is
 * identical for every role apart from three strings, and the last time this frame
 * was duplicated the copies drifted.
 */

const NAVY = '#1B2A6B';
const NAVY_INK = '#131f52';
const GOLD = '#F5B731';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarShell({
  sections,
  roleLabel,
  userName,
  brandHref,
  notificationsHref,
  unreadCount = 0,
  children,
}: {
  sections: NavSection[];
  roleLabel: RoleLabel;
  userName: string;
  /** Each role's own dashboard — for a signed-in user that is home, not the public site. */
  brandHref: string;
  notificationsHref: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleLocale() {
    const next = locale === 'en' ? 'hi' : 'en';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  const sidebarNav = (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {sections.map((section, i) => (
        <div key={section.label ?? `top-${i}`} className={i > 0 ? 'mt-4' : undefined}>
          {section.label && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-[#1B2A6B]' : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
                style={active ? { backgroundColor: GOLD } : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header
        className="sticky top-0 z-50 text-white shadow-md print:hidden"
        style={{ backgroundColor: NAVY }}
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="mr-1 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <Link href={brandHref} className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                UP
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-bold text-white sm:text-base">
                  State School Standard Authority (SSSA), Uttar Pradesh
                </p>
              </div>
            </Link>
          </div>

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
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              {roleLabel}
            </span>

            <span className="hidden max-w-[140px] truncate text-sm text-white sm:inline">
              {userName}
            </span>

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
      </header>

      <div className="mx-auto flex max-w-[1720px]">
        {/* Pinned under the 64px header rather than scrolling away with the page.
            self-start is what makes sticky work here — a stretched flex item is as
            tall as the whole page and has nowhere to stick to. The fixed height plus
            overflow-y-auto means a nav longer than the viewport scrolls inside
            itself instead of being cut off. */}
        <aside
          className="sticky top-16 hidden shrink-0 self-start overflow-y-auto lg:block"
          style={{ width: 232, backgroundColor: NAVY_INK, height: 'calc(100vh - 64px)' }}
        >
          {sidebarNav}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside
              className="absolute inset-y-0 left-0 w-64 overflow-y-auto"
              style={{ backgroundColor: NAVY_INK }}
            >
              {sidebarNav}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <AdminBackButton fallbackHref={brandHref} />
          {children}
        </main>
      </div>
    </div>
  );
}
