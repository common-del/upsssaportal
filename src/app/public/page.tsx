import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, BookOpen, Search, MessageSquare } from 'lucide-react';

const cards = [
  { key: 'directory', href: '/public/directory', icon: BookOpen },
  { key: 'findSchools', href: '/public/find', icon: Search },
  { key: 'feedback', href: '/public/feedback', icon: MessageSquare },
] as const;

export default function PublicPage() {
  const t = useTranslations('public');
  const tc = useTranslations('common');

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">{t('subtitle')}</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {cards.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col items-center rounded-xl border border-border bg-white p-8 text-center transition-shadow hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900/10 text-navy-900 transition-colors group-hover:bg-navy-900 group-hover:text-white">
              <Icon size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-navy-900">
              {t(key as 'directory' | 'findSchools' | 'feedback')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t(`${key}Desc` as 'directoryDesc' | 'findSchoolsDesc' | 'feedbackDesc')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
