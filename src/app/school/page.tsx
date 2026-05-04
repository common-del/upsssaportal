import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { DEMO_CREDENTIAL_PROVIDER_IDS } from '@/lib/demoCredentials';

export default function SchoolLoginPage() {
  const t = useTranslations('school');
  const ta = useTranslations('auth');
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
      <p className="mt-2 text-text-secondary">{t('body')}</p>

      <LoginForm
        credentialsProviderId={DEMO_CREDENTIAL_PROVIDER_IDS.SCHOOL}
        usernameLabel={ta('udiseCode')}
        usernamePlaceholder="11111111111"
      />
    </div>
  );
}
