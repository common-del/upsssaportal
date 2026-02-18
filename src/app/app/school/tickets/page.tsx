import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ensureEscalationUpToDate } from '@/lib/actions/dispute';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED_TO_SCHOOL: 'bg-blue-100 text-blue-800',
  RESPONDED: 'bg-emerald-100 text-emerald-800',
  ASSIGNED_TO_BLOCK: 'bg-amber-100 text-amber-800',
  ASSIGNED_TO_DISTRICT: 'bg-orange-100 text-orange-800',
  ASSIGNED_TO_STATE: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default async function SchoolTicketsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const searchParams = await props.searchParams;
  const t = await getTranslations('schoolTickets');
  const locale = await getLocale();
  const hi = locale === 'hi';
  const schoolUdise = session.user.name!;
  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));

  // Lazy escalation for this school's tickets
  const overdueTickets = await prisma.ticket.findMany({
    where: { schoolUdise, status: { notIn: ['RESOLVED', 'REJECTED'] }, nextDueAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const t of overdueTickets) {
    await ensureEscalationUpToDate(t.id);
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where: { schoolUdise },
      include: { category: { select: { nameEn: true, nameHi: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ticket.count({ where: { schoolUdise } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/app/school/tickets${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>

      <p className="mt-4 text-sm text-text-secondary">
        {total > 0 ? t('showing', { from, to, total }) : t('noTickets')}
      </p>

      {total > 0 && (
        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/app/school/tickets/${ticket.id}`} className="block rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-mono text-xs text-text-secondary">{ticket.id}</p>
                  <p className="mt-1 font-medium text-navy-900">{hi ? ticket.category.nameHi : ticket.category.nameEn}</p>
                  <p className="mt-1 text-sm text-text-secondary line-clamp-2">{ticket.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t(`status_${ticket.status}`)}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {new Date(ticket.createdAt).toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface">{t('prev')}</Link> : <span />}
          <span className="text-text-secondary">{t('page', { page, totalPages })}</span>
          {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-lg border border-border px-4 py-2 text-navy-700 transition-colors hover:bg-surface">{t('next')}</Link> : <span />}
        </div>
      )}
    </div>
  );
}
