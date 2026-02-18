import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ensureEscalationUpToDate } from '@/lib/actions/dispute';
import { RunEscalationsButton } from '@/components/tickets/RunEscalationsButton';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED_TO_SCHOOL: 'bg-blue-100 text-blue-800', RESPONDED: 'bg-emerald-100 text-emerald-800',
  ASSIGNED_TO_BLOCK: 'bg-amber-100 text-amber-800', ASSIGNED_TO_DISTRICT: 'bg-orange-100 text-orange-800',
  ASSIGNED_TO_STATE: 'bg-purple-100 text-purple-800', RESOLVED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-800',
};

export default async function SssaTicketsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const searchParams = await props.searchParams;
  const t = await getTranslations('adminTickets');
  const locale = await getLocale();
  const hi = locale === 'hi';
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));
  const statusFilter = (searchParams.status as string) || '';
  const levelFilter = (searchParams.level as string) || '';
  const districtFilter = (searchParams.district as string) || '';

  // Lazy escalation
  const overdue = await prisma.ticket.findMany({
    where: { status: { notIn: ['RESOLVED', 'REJECTED'] }, nextDueAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const tk of overdue) await ensureEscalationUpToDate(tk.id);

  const where: Prisma.TicketWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (levelFilter) where.handlerLevel = levelFilter;
  if (districtFilter) where.districtCode = districtFilter;

  const [tickets, total, districts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        school: { select: { nameEn: true, nameHi: true, udise: true } },
        category: { select: { nameEn: true, nameHi: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ticket.count({ where }),
    prisma.district.findMany({ select: { code: true, nameEn: true, nameHi: true }, orderBy: { nameEn: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function buildHref(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { status: statusFilter, level: levelFilter, district: districtFilter, page: '1', ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.level) params.set('level', merged.level);
    if (merged.district) params.set('district', merged.district);
    if (parseInt(merged.page) > 1) params.set('page', merged.page);
    const qs = params.toString();
    return `/app/sssa/tickets${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
        <RunEscalationsButton />
      </div>

      {/* Filter chips for active filters */}
      <div className="mt-4 flex flex-wrap gap-1">
        {statusFilter && <Link href={buildHref({ status: '' })} className="rounded bg-navy-100 px-2 py-1 text-xs text-navy-700 hover:bg-navy-200">✕ {t(`status_${statusFilter}`)}</Link>}
        {levelFilter && <Link href={buildHref({ level: '' })} className="rounded bg-navy-100 px-2 py-1 text-xs text-navy-700 hover:bg-navy-200">✕ {t(`level_${levelFilter}`)}</Link>}
        {districtFilter && <Link href={buildHref({ district: '' })} className="rounded bg-navy-100 px-2 py-1 text-xs text-navy-700 hover:bg-navy-200">✕ {districtFilter}</Link>}
      </div>

      {/* Filter row */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link href={buildHref({ status: '', level: '', district: '', page: '1' })} className="text-xs text-navy-700 underline">{t('clearAll')}</Link>
        {['ASSIGNED_TO_SCHOOL','ASSIGNED_TO_BLOCK','ASSIGNED_TO_DISTRICT','ASSIGNED_TO_STATE','RESPONDED','RESOLVED','REJECTED'].map((s) => (
          <Link key={s} href={buildHref({ status: s })} className={`rounded-full border px-2 py-0.5 text-xs ${statusFilter === s ? 'border-navy-600 bg-navy-100 font-medium' : 'border-border hover:bg-surface'}`}>{t(`status_${s}`)}</Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {['SCHOOL','BLOCK','DISTRICT','STATE'].map((l) => (
          <Link key={l} href={buildHref({ level: l })} className={`rounded-full border px-2 py-0.5 text-xs ${levelFilter === l ? 'border-navy-600 bg-navy-100 font-medium' : 'border-border hover:bg-surface'}`}>{t(`level_${l}`)}</Link>
        ))}
        {districts.map((d) => (
          <Link key={d.code} href={buildHref({ district: d.code })} className={`rounded-full border px-2 py-0.5 text-xs ${districtFilter === d.code ? 'border-navy-600 bg-navy-100 font-medium' : 'border-border hover:bg-surface'}`}>{hi ? d.nameHi : d.nameEn}</Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-text-secondary">
        {total > 0 ? t('showing', { from, to, total }) : t('noTickets')}
      </p>

      {total > 0 && (
        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/app/sssa/tickets/${ticket.id}`} className="block rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-mono text-xs text-text-secondary">{ticket.id}</p>
                  <p className="mt-1 text-sm font-medium text-navy-900">{hi ? ticket.school.nameHi : ticket.school.nameEn} <span className="text-text-secondary">({ticket.school.udise})</span></p>
                  <p className="mt-0.5 text-sm text-text-secondary">{hi ? ticket.category.nameHi : ticket.category.nameEn}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>{t(`status_${ticket.status}`)}</span>
                  <span className="text-xs text-text-secondary">{t(`level_${ticket.handlerLevel}`)}</span>
                  <span className="text-xs text-text-secondary">{new Date(ticket.createdAt).toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={buildHref({ page: String(page - 1) })} className="rounded-lg border border-border px-4 py-2 text-navy-700 hover:bg-surface">{t('prev')}</Link> : <span />}
          <span className="text-text-secondary">{t('page', { page, totalPages })}</span>
          {page < totalPages ? <Link href={buildHref({ page: String(page + 1) })} className="rounded-lg border border-border px-4 py-2 text-navy-700 hover:bg-surface">{t('next')}</Link> : <span />}
        </div>
      )}
    </div>
  );
}
