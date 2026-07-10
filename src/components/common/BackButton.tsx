'use client';

import type { CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Navigates back using real browser history (so it always lands on whatever
 * page the user actually came from) instead of a hardcoded destination.
 * Falls back to `fallbackHref` only when there's no history to go back to
 * (e.g. the page was opened directly or in a new tab).
 */
export function BackButton({
  fallbackHref,
  label = 'Back',
  className,
  style,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleBack} className={className} style={style}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
