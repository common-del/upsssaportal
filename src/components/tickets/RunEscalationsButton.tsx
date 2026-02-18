'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Zap, Loader2 } from 'lucide-react';
import { runEscalations } from '@/lib/actions/dispute';

interface Props {
  districtCode?: string;
}

export function RunEscalationsButton({ districtCode }: Props) {
  const t = useTranslations('ticketActions');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await runEscalations(districtCode);
      if ('error' in res) {
        setResult(t('escalationError'));
      } else {
        setResult(t('escalated', { count: res.escalated ?? 0 }));
        router.refresh();
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
        {t('runEscalations')}
      </button>
      {result && <span className="text-xs text-text-secondary">{result}</span>}
    </div>
  );
}
