'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';

export function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();

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

        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
          aria-label="Switch language"
        >
          <Globe size={15} />
          {t('switchLang')}
        </button>
      </div>
    </header>
  );
}
