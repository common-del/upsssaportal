'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send, Loader2 } from 'lucide-react';
import { schoolRespondToTicket } from '@/lib/actions/dispute';

interface Props {
  ticketId: string;
}

export function TicketResponseForm({ ticketId }: Props) {
  const t = useTranslations('schoolTicketDetail');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!message.trim()) {
      setError(t('emptyMessage'));
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await schoolRespondToTicket(ticketId, message);
      if ('error' in result) {
        setError(t('respondError'));
        return;
      }
      setMessage('');
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-navy-900">{t('respondTitle')}</h3>
      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setError('');
        }}
        rows={3}
        maxLength={2000}
        placeholder={t('respondPh')}
        className="mt-2 w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isPending ? t('sending') : t('sendResponse')}
        </button>
      </div>
    </div>
  );
}
