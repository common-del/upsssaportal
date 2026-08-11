'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import { saveSchoolProfile } from '@/lib/actions/schoolPortal';
import type { SchoolProfileStatus } from '@/lib/school/profileStatus';

const NAVY = '#1B2A6B';

export function SchoolProfileForm({
  udise,
  profile,
}: {
  udise: string;
  profile: SchoolProfileStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addressEn, setAddressEn] = useState(profile.addressEn ?? '');
  const [addressHi, setAddressHi] = useState(profile.addressHi ?? '');
  const [publicPhone, setPublicPhone] = useState(profile.publicPhone ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaved(false);
    startTransition(async () => {
      const res = await saveSchoolProfile({ addressEn, addressHi, publicPhone });
      if (!res.ok) {
        setError(res.error ?? 'Could not save. Try again.');
        return;
      }
      setSaved(true);
      // The status strip above is server-rendered, so it only moves off Pending once
      // the page re-reads. Without this the school saves an address and the checklist
      // still says it is missing.
      router.refresh();
    });
  }

  const field =
    'mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contact and address</h2>
            <p className="mt-1 text-sm text-gray-500">
              Shown to parents on your public school page.
            </p>
          </div>
          <Link
            href={`/public/schools/${udise}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            See your public page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="addressEn" className="block text-sm font-medium text-gray-700">
                Address (English)
              </label>
              <input
                id="addressEn"
                value={addressEn}
                onChange={(e) => setAddressEn(e.target.value)}
                placeholder="Village or locality, block, district, PIN"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="addressHi" className="block text-sm font-medium text-gray-700">
                पता (हिन्दी)
              </label>
              <input
                id="addressHi"
                value={addressHi}
                onChange={(e) => setAddressHi(e.target.value)}
                placeholder="गाँव या मोहल्ला, ब्लॉक, जनपद, पिन"
                className={field}
              />
              {/* Optional on purpose. The public page is bilingual, but a school with
                  only an English address should not be held at Pending for it. */}
              <p className="mt-1 text-xs text-gray-400">Optional.</p>
            </div>
          </div>

          <div className="sm:max-w-sm">
            <label htmlFor="publicPhone" className="block text-sm font-medium text-gray-700">
              Public phone number
            </label>
            <input
              id="publicPhone"
              value={publicPhone}
              onChange={(e) => setPublicPhone(e.target.value)}
              placeholder="+91 5221234567"
              inputMode="tel"
              className={field}
            />
            <p className="mt-1 text-xs text-gray-400">
              A number a parent can call. A landline is fine.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: NAVY }}
            >
              {pending ? 'Saving…' : 'Save profile'}
            </button>
            {saved && !pending && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#14603A]">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">School photographs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Photographs appear at the bottom of your public school page.
        </p>
        {/* Named plainly rather than shown as a disabled upload button. A control that
            looks live and does nothing wastes more of a school's time than a sentence
            saying it is not ready. */}
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-[#F9FAFB] px-4 py-5 text-sm text-gray-500">
          Photograph upload is not available yet. Your public page currently shows
          labelled placeholders for the facilities your school reports.
        </div>
      </section>
    </div>
  );
}
