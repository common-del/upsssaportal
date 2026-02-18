import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getBatchSelfAssessmentScores } from '@/lib/scoring';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export default async function MonitoringSchoolDetailPage({
  params,
}: {
  params: Promise<{ udise: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const { udise } = await params;
  const t = await getTranslations('monitoring');

  const school = await prisma.school.findUnique({
    where: { udise },
    select: { udise: true, nameEn: true, nameHi: true, category: true, districtCode: true, blockCode: true },
  });
  if (!school) notFound();

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/app/sssa/monitoring" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
          <ArrowLeft size={16} /> {t('backToMonitoring')}
        </Link>
        <h1 className="text-xl font-bold text-navy-900">{school.nameEn}</h1>
        <p className="mt-2 text-text-secondary">{t('noCycle')}</p>
      </div>
    );
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true, notes: true } } },
  });

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';

  // Load framework structure
  const fullFramework = framework
    ? await prisma.framework.findUnique({
        where: { id: framework.id },
        include: {
          domains: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: {
              subDomains: {
                where: { isActive: true },
                orderBy: { order: 'asc' },
                include: {
                  parameters: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' },
                    include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const scores = framework ? await getBatchSelfAssessmentScores(cycle.id, framework.id, [udise]) : {};
  const scoreResult = scores[udise];

  const responseMap = new Map<string, { selectedOptionKey: string; notes: string | null }>();
  if (submission) {
    for (const r of submission.responses) {
      responseMap.set(r.parameterId, { selectedOptionKey: r.selectedOptionKey, notes: r.notes });
    }
  }

  const saStatus = !submission ? 'not_started' : submission.status === 'SUBMITTED' ? 'submitted' : 'draft';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/sssa/monitoring?view=schools" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToMonitoring')}
      </Link>

      {/* School header */}
      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy-900">{school.nameHi}</h1>
            <p className="text-sm text-text-secondary">{school.nameEn}</p>
            <p className="mt-1 text-xs text-text-secondary">
              UDISE: {school.udise} · {school.category} · {school.districtCode} / {school.blockCode}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              saStatus === 'submitted' ? 'bg-green-100 text-green-700'
              : saStatus === 'draft' ? 'bg-amber-100 text-amber-700'
              : 'bg-surface text-text-secondary'
            }`}>
              {saStatus === 'submitted' ? <><CheckCircle2 size={14} /> {t('statusSubmitted')}</>
               : saStatus === 'draft' ? <><Clock size={14} /> {t('statusDraft')}</>
               : t('statusNotStarted')}
            </span>
            {scoreResult?.scorePercent !== null && scoreResult?.scorePercent !== undefined && (
              <p className="mt-1 text-lg font-bold text-navy-700">{scoreResult.scorePercent}%</p>
            )}
          </div>
        </div>
      </div>

      {/* Responses */}
      {!fullFramework || responseMap.size === 0 ? (
        <div className="rounded-lg border border-border bg-white p-6 text-center text-text-secondary">
          {t('noResponses')}
        </div>
      ) : (
        <div className="space-y-4">
          {fullFramework.domains.map((domain) => {
            const filteredSubs = domain.subDomains
              .map((sd) => ({
                ...sd,
                parameters: sd.parameters.filter((p) => (p.applicability as string[]).includes(categoryCode)),
              }))
              .filter((sd) => sd.parameters.length > 0);

            if (filteredSubs.length === 0) return null;

            return (
              <div key={domain.id} className="rounded-xl border border-border bg-white">
                <div className="border-b border-border px-5 py-3">
                  <h2 className="text-sm font-semibold text-navy-900">{domain.titleHi}</h2>
                  <p className="text-xs text-text-secondary">{domain.titleEn}</p>
                </div>
                <div className="px-5 pb-4">
                  {filteredSubs.map((sd) => (
                    <div key={sd.id} className="mt-3">
                      <h3 className="mb-2 text-xs font-semibold text-navy-800">
                        {sd.titleHi} <span className="font-normal text-text-secondary">/ {sd.titleEn}</span>
                      </h3>
                      <div className="space-y-2">
                        {sd.parameters.map((param) => {
                          const resp = responseMap.get(param.id);
                          const selectedOpt = resp ? param.options.find((o) => o.key === resp.selectedOptionKey) : null;
                          return (
                            <div key={param.id} className={`rounded-lg border p-3 ${resp ? 'border-green-200 bg-green-50/30' : 'border-border'}`}>
                              <p className="text-xs font-medium text-navy-900">{param.titleHi}</p>
                              <p className="text-xs text-text-secondary">{param.titleEn}</p>
                              {resp ? (
                                <div className="mt-1.5">
                                  <p className="text-xs">
                                    <span className="font-medium text-navy-700">{resp.selectedOptionKey.replace('_', ' ')}:</span>{' '}
                                    <span className="text-navy-900">{selectedOpt?.labelHi}</span>
                                  </p>
                                  {selectedOpt && <p className="text-xs text-text-secondary">{selectedOpt.labelEn}</p>}
                                  {resp.notes && <p className="mt-1 rounded bg-surface px-2 py-1 text-xs italic text-text-secondary">{resp.notes}</p>}
                                </div>
                              ) : (
                                <p className="mt-1 text-xs italic text-text-secondary">— {t('notAnswered')} —</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
