'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DEMO_LOGIN_PREFILL,
  type DemoCredentialProviderId,
} from '@/lib/demoCredentials';

const roleRedirectMap: Record<string, string> = {
  SCHOOL: '/app/school',
  SCHOOL_USER: '/app/school',
  VERIFIER: '/app/verifier',
  DISTRICT_OFFICIAL: '/app/district',
  DISTRICT_ADMIN: '/app/district',
  SSSA_ADMIN: '/app/sssa',
  admin: '/app/sssa',
};

interface LoginFormProps {
  credentialsProviderId: DemoCredentialProviderId;
  usernameLabel?: string;
  usernamePlaceholder?: string;
}

export function LoginForm({
  credentialsProviderId,
  usernameLabel,
  usernamePlaceholder,
}: LoginFormProps) {
  const t = useTranslations('auth');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const prefill = DEMO_LOGIN_PREFILL[credentialsProviderId];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await signIn(credentialsProviderId, {
      username: fd.get('username'),
      password: fd.get('password'),
      redirect: false,
    });

    if (!result?.ok) {
      setError(t('error'));
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/session');
    const session = await res.json();
    const role: string = session?.user?.role ?? '';
    router.push(roleRedirectMap[role] || '/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-5">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-text-primary">
          {usernameLabel || t('username')}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={prefill.username}
          placeholder={usernamePlaceholder}
          autoComplete="username"
          className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-text-primary">
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          defaultValue={prefill.password}
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cta px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cta-hover disabled:opacity-50"
      >
        {loading ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
