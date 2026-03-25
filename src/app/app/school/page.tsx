import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MessageSquare, ClipboardList, UserCheck, Scale } from 'lucide-react';
import { prisma } from '@/lib/db';
import DownloadSchoolReportButton from '@/components/reports/DownloadSchoolReportButton';

export default async function SchoolHomePage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('appSchool');
  const schoolUdise = session.user.name!;

  const [ticketCount, saSubmission, school, report] = await Promise.all([
    prisma.ticket.count({ where: { schoolUdise } }),
    (async () => {
      const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
      if (!cycle) return null;
      return prisma.selfAssessmentSubmission.findUnique({
        where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
        include: { _count: { select: { responses: true } } },
      });
    })(),
    prisma.school.findUnique({
      where: { udise: schoolUdise },
      select: {
        udise: true,
        nameEn: true,
        nameHi: true,
        category: true,
        block: { select: { nameEn: true, nameHi: true } },
        district: { select: { nameEn: true, nameHi: true } },
      },
    }),
    (async () => {
      const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
      if (!cycle) return null;
      const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id }, select: { id: true } });
      if (!framework) return { resultsPublished: cycle.resultsPublished, gradeLabelEn: null, gradeLabelHi: null };

      const [result, gradeBands] = await Promise.all([
        prisma.result.findUnique({
          where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
          select: { gradeBandCode: true },
        }),
        prisma.gradeBand.findMany({
          where: { frameworkId: framework.id },
          orderBy: { order: 'asc' },
          select: { key: true, labelEn: true, labelHi: true },
        }),
      ]);

      const band = result?.gradeBandCode ? gradeBands.find((b) => b.key === result.gradeBandCode) : null;
      return {
        resultsPublished: cycle.resultsPublished,
        gradeLabelEn: band?.labelEn ?? (result?.gradeBandCode ?? null),
        gradeLabelHi: band?.labelHi ?? (result?.gradeBandCode ?? null),
      };
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

      {school && (
        <div className="mt-6 rounded-xl border border-border bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-navy-900">
                {school.nameEn} <span className="font-mono text-sm text-text-secondary">({school.udise})</span>
              </h2>
              <div className="mt-2 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                <div>
                  <span className="font-medium text-navy-900">Location:</span>{' '}
                  {(school.block?.nameEn || '—')}{school.district?.nameEn ? `, ${school.district.nameEn}` : ''}
                </div>
                <div>
                  <span className="font-medium text-navy-900">Type:</span> {school.category}
                </div>
                <div>
                  <span className="font-medium text-navy-900">Grade obtained:</span>{' '}
                  {report?.resultsPublished && report.gradeLabelEn ? (
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-700">
                      {report.gradeLabelEn}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <DownloadSchoolReportButton />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          href="/app/school/verifier-feedback"
          className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
            <UserCheck size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('verifierFeedbackLink')}</p>
            <p className="text-sm text-text-secondary">{t('verifierFeedbackDesc')}</p>
          </div>
        </Link>

        <Link
          href="/app/school/appeals"
          className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <Scale size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('appealsLink')}</p>
            <p className="text-sm text-text-secondary">{t('appealsDesc')}</p>
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
