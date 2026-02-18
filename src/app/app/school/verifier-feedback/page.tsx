import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getBatchSelfAssessmentScores, getBatchVerificationScores } from '@/lib/scoring';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export default async function VerifierFeedbackPage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('verifierFeedback');
  const schoolUdise = session.user.name!;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return <EmptyWrap t={t} msg={t('noCycle')} />;
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') {
    return <EmptyWrap t={t} msg={t('noFramework')} />;
  }

  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) return <EmptyWrap t={t} msg={t('notFound')} />;

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';

  const vSubmission = await prisma.verificationSubmission.findFirst({
    where: { cycleId: cycle.id, schoolUdise, status: 'SUBMITTED' },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true, notes: true } } },
  });

  if (!vSubmission) {
    return <EmptyWrap t={t} msg={t('noVerifierYet')} />;
  }

  const saSubmission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
  });

  const fullFramework = await prisma.framework.findUnique({
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
  });
  if (!fullFramework) return <EmptyWrap t={t} msg={t('noFramework')} />;

  const [saScores, vScores] = await Promise.all([
    getBatchSelfAssessmentScores(cycle.id, framework.id, [schoolUdise]),
    getBatchVerificationScores(cycle.id, framework.id, [schoolUdise]),
  ]);

  const saMap = new Map<string, string>();
  if (saSubmission) for (const r of saSubmission.responses) saMap.set(r.parameterId, r.selectedOptionKey);

  const vMap = new Map<string, { selectedOptionKey: string; notes: string | null }>();
  for (const r of vSubmission.responses) vMap.set(r.parameterId, { selectedOptionKey: r.selectedOptionKey, notes: r.notes });

  let matches = 0;
  let diffs = 0;
  let total = 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToHome')}
      </Link>

      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>

      <div className="mt-4 flex gap-4 text-sm">
        {saScores[schoolUdise]?.scorePercent != null && (
          <span className="rounded-lg border border-border bg-white px-3 py-2">
            {t('saScore')}: <span className="font-bold text-navy-700">{saScores[schoolUdise].scorePercent}%</span>
          </span>
        )}
        {vScores[schoolUdise]?.scorePercent != null && (
          <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-700">
            {t('vScore')}: <span className="font-bold">{vScores[schoolUdise].scorePercent}%</span>
          </span>
        )}
      </div>

      <div className="mt-6 space-y-4">
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
                        const saKey = saMap.get(param.id);
                        const vResp = vMap.get(param.id);
                        const saOpt = saKey ? param.options.find((o) => o.key === saKey) : null;
                        const vOpt = vResp ? param.options.find((o) => o.key === vResp.selectedOptionKey) : null;
                        const isDiff = saKey && vResp && saKey !== vResp.selectedOptionKey;
                        if (saKey || vResp) { total++; if (saKey && vResp) { if (saKey === vResp.selectedOptionKey) matches++; else diffs++; } }

                        return (
                          <div key={param.id} className={`rounded-lg border p-3 ${isDiff ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
                            <div className="flex items-start gap-2">
                              {isDiff && <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-navy-900">{param.titleHi}</p>
                                <p className="text-xs text-text-secondary">{param.titleEn}</p>
                              </div>
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-md bg-surface p-2">
                                <p className="text-[10px] font-semibold uppercase text-text-secondary">{t('yourAssessment')}</p>
                                {saOpt ? (
                                  <>
                                    <p className="mt-0.5 text-xs font-medium text-navy-900">{saKey!.replace(/_/g, ' ')}</p>
                                    <p className="text-[11px] text-navy-800">{saOpt.labelHi}</p>
                                    <p className="text-[11px] text-text-secondary">{saOpt.labelEn}</p>
                                  </>
                                ) : <p className="mt-0.5 text-xs italic text-text-secondary">—</p>}
                              </div>
                              <div className="rounded-md bg-indigo-50/50 p-2">
                                <p className="text-[10px] font-semibold uppercase text-indigo-600">{t('verifierAssessment')}</p>
                                {vOpt ? (
                                  <>
                                    <p className="mt-0.5 text-xs font-medium text-navy-900">{vResp!.selectedOptionKey.replace(/_/g, ' ')}</p>
                                    <p className="text-[11px] text-navy-800">{vOpt.labelHi}</p>
                                    <p className="text-[11px] text-text-secondary">{vOpt.labelEn}</p>
                                  </>
                                ) : <p className="mt-0.5 text-xs italic text-text-secondary">—</p>}
                              </div>
                            </div>
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
    </div>
  );
}

function EmptyWrap({ t, msg }: { t: (k: string) => string; msg: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToHome')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{msg}</div>
    </div>
  );
}
