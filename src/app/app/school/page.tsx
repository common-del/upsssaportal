import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MessageSquare, ClipboardList } from 'lucide-react';
import { prisma } from '@/lib/db';

export default async function SchoolHomePage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('appSchool');
  const schoolUdise = session.user.name!;

  const [ticketCount, saSubmission] = await Promise.all([
    prisma.ticket.count({ where: { schoolUdise } }),
    (async () => {
      const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
      if (!cycle) return null;
      return prisma.selfAssessmentSubmission.findUnique({
        where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
        include: { _count: { select: { responses: true } } },
      });
    })(),
  ]);

  const saStatus = saSubmission
    ? saSubmission.status === 'SUBMITTED' ? 'submitted' : 'draft'
    : 'not_started';

  const saResponseCount = saSubmission?._count.responses ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 text-text-secondary">
        {t('welcome', { username: session.user.name })}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/school/self-assessment"
          className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            saStatus === 'submitted' ? 'bg-green-50' : 'bg-navy-50'
          }`}>
            <ClipboardList size={20} className={saStatus === 'submitted' ? 'text-green-600' : 'text-navy-700'} />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('saLink')}</p>
            <p className="text-sm text-text-secondary">
              {saStatus === 'submitted'
                ? t('saSubmitted')
                : saStatus === 'draft'
                  ? t('saDraft', { count: saResponseCount })
                  : t('saNotStarted')}
            </p>
          </div>
        </Link>

        <Link
          href="/app/school/tickets"
          className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <MessageSquare size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('ticketsLink')}</p>
            <p className="text-sm text-text-secondary">
              {t('ticketsCount', { count: ticketCount })}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
