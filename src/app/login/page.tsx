'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircle, LogIn } from 'lucide-react';
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

/**
 * `hint` names who each tab is for, and it earns its place. Official is the tab you
 * land on by default, so somebody meaning to sign in as a school types a school ID
 * into the officials' form. Getting the tab wrong is not a typo you can see: each
 * tab posts to a different provider, so the same details can be refused on one and
 * accepted on another.
 */
const TABS = [
  {
    id: 'official' as const,
    label: 'Official',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.SSSA,
    fallbackUrl: '/app/sssa',
    hint: 'For SSSA and district officials.',
  },
  {
    id: 'school' as const,
    label: 'School',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.SCHOOL,
    fallbackUrl: '/app/school',
    hint: 'Schools sign in with their 11-digit UDISE code.',
  },
  {
    id: 'verifier' as const,
    label: 'Verifier',
    provider: DEMO_CREDENTIAL_PROVIDER_IDS.VERIFIER,
    fallbackUrl: '/app/verifier',
    hint: 'For verifiers assigned to inspect schools.',
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLoginTab(tabParam)) setTab(tabParam);
    else if (tabParam === 'district') setTab('official');
  }, [tabParam]);

  const active = TABS.find((t) => t.id === tab)!;

  function selectTab(id: LoginTab) {
    setTab(id);
    // A refusal from the previous tab says nothing about this one.
    setFailed(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFailed(false);

    const fd = new FormData(e.currentTarget);
    const result = await signIn(active.provider, {
      username: fd.get('username') ?? '',
      password: fd.get('password') ?? '',
      redirect: false,
    });

    // Say so. This branch used to stop the spinner and return, which left the form
    // sitting there looking untouched — indistinguishable from a click that never
    // registered, and no reason to think the tab above was the problem.
    if (!result?.ok) {
      setFailed(true);
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
              onClick={() => selectTab(t.id)}
              aria-pressed={tab === t.id}
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
        <p className="mt-2 text-xs text-gray-500">{active.hint}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              User ID
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder={tab === 'school' ? 'UDISE code' : 'Enter your User ID'}
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

          {/* Deliberately does not say which of the two was wrong — that tells anyone
              guessing whether a user ID exists. It does point at the tab, because
              that is the mistake the form itself invites. */}
          {failed && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                We could not sign you in. Check the User ID and password, and that
                &ldquo;{active.label}&rdquo; above is the right one for you — {active.hint}
              </span>
            </div>
          )}

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
