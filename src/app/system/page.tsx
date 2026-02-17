import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ShieldCheck, ClipboardCheck } from 'lucide-react';

const tiles = [
  {
    key: 'sssaLogin' as const,
    descKey: 'sssaDesc' as const,
    href: '/system/sssa',
    Icon: ShieldCheck,
  },
  {
    key: 'verifierLogin' as const,
    descKey: 'verifierDesc' as const,
    href: '/system/verifier',
    Icon: ClipboardCheck,
  },
] as const;

export default function SystemPage() {
  const t = useTranslations('system');
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

      <div className="mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
        {tiles.map(({ key, descKey, href, Icon }) => (
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
