'use client';

import { useState } from 'react';

export default function DownloadSchoolReportButton({
  udise,
  variant = 'primary',
  className = '',
  locale,
}: {
  udise?: string;
  variant?: 'primary' | 'secondary' | 'link';
  className?: string;
  locale?: 'en' | 'hi';
}) {
  const [busy, setBusy] = useState(false);

  const base =
    variant === 'link'
      ? 'text-indigo-600 hover:text-indigo-800 font-medium'
      : variant === 'secondary'
        ? 'inline-flex items-center justify-center rounded-lg border border-navy-700 px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:opacity-50'
        : 'inline-flex items-center justify-center rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50';

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (udise) qs.set('udise', udise);
      if (locale) qs.set('locale', locale);
      const url = `/api/school/report/download${qs.toString() ? `?${qs.toString()}` : ''}`;
      window.location.assign(url);
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  };

  return (
    <button onClick={onClick} disabled={busy} className={`${base} ${className}`}>
      {busy ? 'Preparing…' : 'Download School Report'}
    </button>
  );
}

