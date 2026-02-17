'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Loader2, Clock } from 'lucide-react';
import { trackTicket } from '@/lib/actions/dispute';

interface TimelineEntry {
  id: string;
  actorType: string;
  message: string;
  createdAt: string;
}

interface TicketData {
  id: string;
  status: string;
  description: string;
  createdAt: string;
  school: { nameEn: string; nameHi: string; udise: string };
  category: { nameEn: string; nameHi: string };
  timeline: TimelineEntry[];
}

interface Props {
  locale: string;
  prefillTicketId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  ASSIGNED_TO_SCHOOL: 'bg-amber-100 text-amber-800',
  RESPONDED: 'bg-emerald-100 text-emerald-800',
  RESOLVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export function TrackDisputeForm({ locale, prefillTicketId }: Props) {
  const t = useTranslations('track');
  const [isPending, startTransition] = useTransition();

  const [ticketId, setTicketId] = useState(prefillTicketId || '');
  const [mobile, setMobile] = useState('');
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [error, setError] = useState('');

  const hi = locale === 'hi';

  const selectClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';

  function handleTrack() {
    if (!ticketId.trim() || mobile.replace(/\D/g, '').length < 10) {
      setError(t('invalidInput'));
      return;
    }
    setError('');
    setTicket(null);
    startTransition(async () => {
      const result = await trackTicket(ticketId.trim(), mobile);
      if ('error' in result) {
        setError(t('notFound'));
        return;
      }
      // Serialize dates for client
      setTicket({
        ...result.ticket,
        createdAt: result.ticket.createdAt.toISOString(),
        timeline: result.ticket.timeline.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
        })),
      });
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(hi ? 'hi-IN' : 'en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-text-secondary">
            {t('ticketIdLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder={t('ticketIdPh')}
            className={`mt-1.5 ${selectClass}`}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary">
            {t('mobileLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder={t('mobilePh')}
            maxLength={10}
            className={`mt-1.5 ${selectClass}`}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleTrack}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        {isPending ? t('searching') : t('trackBtn')}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {ticket && (
        <div className="space-y-4 rounded-lg border border-border bg-white p-5">
          {/* Ticket header */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-text-secondary">{t('ticketIdLabel')}</p>
              <p className="font-mono text-sm font-bold text-navy-900">{ticket.id}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
              {t(`status_${ticket.status}`)}
            </span>
          </div>

          {/* Ticket details */}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-text-secondary">{t('schoolLabel')}: </span>
              <span className="font-medium">{hi ? ticket.school.nameHi : ticket.school.nameEn}</span>
            </div>
            <div>
              <span className="text-text-secondary">{t('categoryLabel')}: </span>
              <span className="font-medium">{hi ? ticket.category.nameHi : ticket.category.nameEn}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-text-secondary">{t('descriptionLabel')}: </span>
              <span>{ticket.description}</span>
            </div>
            <div>
              <span className="text-text-secondary">{t('createdAt')}: </span>
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-navy-900">{t('timeline')}</h3>
            <div className="space-y-3">
              {ticket.timeline.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="mt-0.5">
                    <Clock size={14} className="text-text-secondary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        entry.actorType === 'SCHOOL'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {t(`actor_${entry.actorType}`)}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{entry.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
