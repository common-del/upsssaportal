'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSession, signOut } from 'next-auth/react';
import { Globe, LogOut } from 'lucide-react';

const roleColors: Record<string, string> = {
  SSSA_ADMIN: 'bg-amber-600',
  DISTRICT_OFFICIAL: 'bg-emerald-600',
  VERIFIER: 'bg-sky-600',
  SCHOOL: 'bg-violet-600',
};

export function Header() {
  const t = useTranslations('nav');
  const tr = useTranslations('roles');
  const locale = useLocale();
  const { data: session } = useSession();

  function toggleLocale() {
    const next = locale === 'en' ? 'hi' : 'en';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <header className="bg-navy-900 text-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-base font-semibold tracking-wide hover:opacity-90"
        >
          {t('home')}
        </Link>

        <div className="flex items-center gap-3">
          {session?.user && (
            <>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${roleColors[session.user.role] || 'bg-gray-600'}`}
              >
                {tr(session.user.role as 'SSSA_ADMIN' | 'DISTRICT_OFFICIAL' | 'VERIFIER' | 'SCHOOL')}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-sm transition-colors hover:bg-white/10"
                aria-label={t('signOut')}
              >
                <LogOut size={14} />
                {t('signOut')}
              </button>
            </>
          )}

          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
            aria-label="Switch language"
          >
            <Globe size={15} />
            {t('switchLang')}
          </button>
        </div>
      </div>
    </header>
  );
}
