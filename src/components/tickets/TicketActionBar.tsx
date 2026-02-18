'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send, CheckCircle, XCircle, Loader2, StickyNote } from 'lucide-react';
import {
  schoolRespondToTicket,
  addTicketNote,
  resolveTicket,
  rejectTicket,
} from '@/lib/actions/dispute';

interface Props {
  ticketId: string;
  ticketStatus: string;
  role: 'SCHOOL' | 'DISTRICT_OFFICIAL' | 'SSSA_ADMIN';
}

export function TicketActionBar({ ticketId, ticketStatus, role }: Props) {
  const t = useTranslations('ticketActions');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [action, setAction] = useState<'respond' | 'note' | 'resolve' | 'reject' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isClosed = ['RESOLVED', 'REJECTED'].includes(ticketStatus);

  const selectClass =
    'w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';

  function handleSubmit() {
    if (action === 'reject' && !message.trim()) {
      setError(t('reasonRequired'));
      return;
    }
    if ((action === 'respond' || action === 'note') && !message.trim()) {
      setError(t('messageRequired'));
      return;
    }
    setError('');
    startTransition(async () => {
      let result: { success?: boolean; error?: string };
      switch (action) {
        case 'respond':
          result = await schoolRespondToTicket(ticketId, message);
          break;
        case 'note':
          result = await addTicketNote(ticketId, message);
          break;
        case 'resolve':
          result = await resolveTicket(ticketId, message || 'Resolved');
          break;
        case 'reject':
          result = await rejectTicket(ticketId, message);
          break;
        default:
          return;
      }
      if (result.error) {
        setError(t('actionError'));
        return;
      }
      setMessage('');
      setAction(null);
      router.refresh();
    });
  }

  if (isClosed) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
        {t('ticketClosed')}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      {/* Action buttons */}
      {!action && (
        <div className="flex flex-wrap gap-2">
          {role === 'SCHOOL' && (
            <button type="button" onClick={() => setAction('respond')} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800">
              <Send size={14} /> {t('respond')}
            </button>
          )}
          {['DISTRICT_OFFICIAL', 'SSSA_ADMIN'].includes(role) && (
            <>
              <button type="button" onClick={() => setAction('note')} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-surface">
                <StickyNote size={14} /> {t('addNote')}
              </button>
              <button type="button" onClick={() => setAction('resolve')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
                <CheckCircle size={14} /> {t('resolve')}
              </button>
              <button type="button" onClick={() => setAction('reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700">
                <XCircle size={14} /> {t('reject')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Action form */}
      {action && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-navy-900">
            {t(`action_${action}`)}
          </h3>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError(''); }}
            rows={3}
            maxLength={2000}
            placeholder={
              action === 'reject' ? t('rejectReasonPh') : t('messagePh')
            }
            className={selectClass}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleSubmit} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              {isPending ? t('submitting') : t('submitAction')}
            </button>
            <button type="button" onClick={() => { setAction(null); setMessage(''); setError(''); }} className="rounded-lg border border-border px-4 py-2 text-sm text-navy-700 transition-colors hover:bg-white">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
