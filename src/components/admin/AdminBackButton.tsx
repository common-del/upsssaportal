'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { showsShellBackButton } from '@/lib/isDetailPage';

export function AdminBackButton({ fallbackHref = '/app/dashboard' }: { fallbackHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Silent on a page that prints its own named back link, so a console does not carry two.
  if (!showsShellBackButton(pathname)) return null;

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1B2A6B]"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
