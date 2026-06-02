'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DEMO_CREDENTIAL_PROVIDER_IDS } from '@/lib/demoCredentials';

const ROLE_REDIRECT: Record<string, string> = {
  SCHOOL: '/app/school',
  SCHOOL_USER: '/app/school',
  VERIFIER: '/app/verifier',
  DISTRICT_OFFICIAL: '/app/district',
  DISTRICT_ADMIN: '/app/dashboard',
  SSSA_ADMIN: '/app/sssa',
  admin: '/app/sssa',
};

const TABS = [
  {
    id: 'official' as const,
    label: 'Official',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.SSSA,
    fallbackUrl: '/app/sssa',
  },
  {
    id: 'school' as const,
    label: 'School',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.SCHOOL,
    fallbackUrl: '/app/school',
  },
  {
    id: 'verifier' as const,
    label: 'Verifier',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.VERIFIER,
    fallbackUrl: '/app/verifier',
  },
];

type LoginTab = (typeof TABS)[number]['id'];

function isLoginTab(value: string | null): value is LoginTab {
  return value === 'official' || value === 'school' || value === 'verifier';
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<LoginTab>(() =>
    isLoginTab(tabParam) ? tabParam : tabParam === 'district' ? 'official' : 'official',
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoginTab(tabParam)) setTab(tabParam);
    else if (tabParam === 'district') setTab('official');
  }, [tabParam]);

  const active = TABS.find((t) => t.id === tab)!;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await signIn(active.provider, {
      username: fd.get('username') ?? '',
      password: fd.get('password') ?? '',
      redirect: false,
    });

    if (!result?.ok) {
      setLoading(false);
      return;
    }

    const session = await fetch('/api/auth/session').then((r) => r.json());
    const role: string = session?.user?.role ?? '';
    router.push(ROLE_REDIRECT[role] || active.fallbackUrl);
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-8 shadow-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1B2A6B] text-white">
          <LogIn size={26} strokeWidth={2.25} />
        </div>

        <h1 className="mt-5 text-center text-xl font-bold text-[#1B2A6B]">
          SSSA UP Portal Login
        </h1>
        <p className="mt-1 text-center text-sm text-gray-600">
          Sign in to access the portal
        </p>

        <p className="mt-6 text-sm font-medium text-gray-700">Login As</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              User ID
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your User ID"
              autoComplete="username"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-[#1B2A6B] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
