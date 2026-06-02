'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAVY = '#1B2A6B';
const YELLOW = '#F5B731';

export function LoginHeader() {
  const locale = useLocale();

  function toggleLocale() {
    const next = locale === 'en' ? 'hi' : 'en';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <header
      className="sticky top-0 z-50 shrink-0 text-white shadow-md print:hidden"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center px-6">
        {/* Left zone: brand */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Link href="/public" className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: YELLOW, color: NAVY }}
            >
              UP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white sm:text-base">SSSA Uttar Pradesh</p>
              <p className="hidden truncate text-xs text-white/70 sm:block">
                School Education Department, Uttar Pradesh
              </p>
            </div>
          </Link>
        </div>

        <div className="min-w-0 flex-1" />

        {/* Right zone: actions */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/public"
            className="hidden items-center gap-1 text-sm font-medium text-white hover:text-white/80 sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </Link>
          <Link
            href="/public"
            className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-white/80 sm:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10 sm:px-3"
          >
            <span className={cn(locale === 'en' && 'font-bold')}>EN</span>
            <span className="text-white/50"> | </span>
            <span className={cn(locale === 'hi' && 'font-bold')}>हिंदी</span>
          </button>
        </div>
      </div>
    </header>
  );
}
