import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ensureEscalationUpToDate } from '@/lib/actions/dispute';
import { TicketActionBar } from '@/components/tickets/TicketActionBar';

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED_TO_SCHOOL: 'bg-blue-100 text-blue-800', RESPONDED: 'bg-emerald-100 text-emerald-800',
  ASSIGNED_TO_BLOCK: 'bg-amber-100 text-amber-800', ASSIGNED_TO_DISTRICT: 'bg-orange-100 text-orange-800',
  ASSIGNED_TO_STATE: 'bg-purple-100 text-purple-800', RESOLVED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-800',
};
const EVENT_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-700', SCHOOL_RESPONDED: 'bg-blue-50 text-blue-700', ESCALATED: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700', NOTE: 'bg-indigo-50 text-indigo-700',
};

export default async function SssaTicketDetailPage(props: { params: Promise<{ ticketId: string }> }) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const { ticketId } = await props.params;
  const t = await getTranslations('ticketDetail');
  const locale = await getLocale();
  const hi = locale === 'hi';

  await ensureEscalationUpToDate(ticketId);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      school: { select: { nameEn: true, nameHi: true, udise: true } },
      category: { select: { nameEn: true, nameHi: true } },
      timeline: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket) notFound();

  function fmtDate(date: Date) {
    return date.toLocaleString(hi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/app/sssa/tickets" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToList')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
          <p className="mt-1 font-mono text-sm text-text-secondary">{ticket.id}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>{t(`status_${ticket.status}`)}</span>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-text-secondary">{t('school')}: </span><span className="font-medium">{hi ? ticket.school.nameHi : ticket.school.nameEn} ({ticket.school.udise})</span></div>
          <div><span className="text-text-secondary">{t('category')}: </span><span className="font-medium">{hi ? ticket.category.nameHi : ticket.category.nameEn}</span></div>
          <div><span className="text-text-secondary">{t('handlerLevel')}: </span><span className="font-medium">{t(`level_${ticket.handlerLevel}`)}</span></div>
          <div><span className="text-text-secondary">{t('created')}: </span><span>{fmtDate(ticket.createdAt)}</span></div>
          {ticket.nextDueAt && <div><span className="text-text-secondary">{t('nextDue')}: </span><span className={new Date() > ticket.nextDueAt ? 'font-medium text-red-600' : ''}>{fmtDate(ticket.nextDueAt)}</span></div>}
          {ticket.districtCode && <div><span className="text-text-secondary">{t('districtCode')}: </span><span>{ticket.districtCode}</span></div>}
          <div className="sm:col-span-2"><span className="text-text-secondary">{t('description')}: </span><span>{ticket.description}</span></div>
          {ticket.submitterName && <div><span className="text-text-secondary">{t('submitter')}: </span><span>{ticket.submitterName}</span></div>}
          {ticket.closedReason && <div className="sm:col-span-2"><span className="text-text-secondary">{t('closedReason')}: </span><span>{ticket.closedReason}</span></div>}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-navy-900">{t('timeline')}</h2>
        <div className="space-y-3">
          {ticket.timeline.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <div className="mt-0.5"><Clock size={14} className="text-text-secondary" /></div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${EVENT_COLORS[entry.eventType] || 'bg-gray-100 text-gray-700'}`}>{t(`event_${entry.eventType}`)}</span>
                  {entry.actorRole && <span className="text-xs text-text-secondary">({t(`role_${entry.actorRole}`)})</span>}
                  <span className="text-xs text-text-secondary">{fmtDate(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm">{entry.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TicketActionBar ticketId={ticket.id} ticketStatus={ticket.status} role="SSSA_ADMIN" />
    </div>
  );
}
