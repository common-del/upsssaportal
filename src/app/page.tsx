import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Info, LogIn, School } from 'lucide-react';

const cards = [
  { key: 'publicInfo' as const, descKey: 'publicDesc' as const, href: '/public', Icon: Info },
  { key: 'systemLogin' as const, descKey: 'systemDesc' as const, href: '/system', Icon: LogIn },
  { key: 'schoolLogin' as const, descKey: 'schoolDesc' as const, href: '/school', Icon: School },
] as const;

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24">
      <h1 className="text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 text-center text-lg text-text-secondary">
        {t('subtitle')}
      </p>

      <div className="mt-16 grid w-full max-w-3xl gap-6 sm:grid-cols-3">
        {cards.map(({ key, descKey, href, Icon }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col items-center rounded-xl border border-border bg-white p-8 text-center shadow-sm transition-all hover:border-navy-700 hover:shadow-md"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-white transition-colors group-hover:bg-cta">
              <Icon size={22} />
            </span>
            <span className="text-base font-semibold text-navy-900">
              {t(key)}
            </span>
            <span className="mt-1.5 text-sm text-text-secondary">
              {t(descKey)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
