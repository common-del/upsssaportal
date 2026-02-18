import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getBatchSelfAssessmentScores, getBatchVerificationScores } from '@/lib/scoring';
import MonitoringSchoolTabs from '@/components/monitoring/MonitoringSchoolTabs';

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
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/sssa/monitoring" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
          <ArrowLeft size={16} /> {t('backToMonitoring')}
        </Link>
        <h1 className="text-xl font-bold text-navy-900">{school.nameEn}</h1>
        <p className="mt-2 text-text-secondary">{t('noCycle')}</p>
      </div>
    );
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';

  const [saSubmission, vSubmission] = await Promise.all([
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true, notes: true } } },
    }),
    prisma.verificationSubmission.findFirst({
      where: { cycleId: cycle.id, schoolUdise: udise },
      include: { responses: { select: { parameterId: true, selectedOptionKey: true, notes: true } } },
    }),
  ]);

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

  const [saScores, vScores] = framework
    ? await Promise.all([
        getBatchSelfAssessmentScores(cycle.id, framework.id, [udise]),
        getBatchVerificationScores(cycle.id, framework.id, [udise]),
      ])
    : [{}, {}];

  const saScore = saScores[udise];
  const vScore = vScores[udise];

  const saStatus = !saSubmission ? 'not_started' : saSubmission.status === 'SUBMITTED' ? 'submitted' : 'draft';
  const vStatus = !vSubmission ? 'not_started' : vSubmission.status === 'SUBMITTED' ? 'submitted' : 'draft';

  // Serialize responses
  const saMap: Record<string, { selectedOptionKey: string; notes: string | null }> = {};
  if (saSubmission) for (const r of saSubmission.responses) saMap[r.parameterId] = { selectedOptionKey: r.selectedOptionKey, notes: r.notes };

  const vMap: Record<string, { selectedOptionKey: string; notes: string | null }> = {};
  if (vSubmission) for (const r of vSubmission.responses) vMap[r.parameterId] = { selectedOptionKey: r.selectedOptionKey, notes: r.notes };

  // Serialize framework
  const serializedDomains = fullFramework?.domains.map((d) => ({
    id: d.id, code: d.code, titleEn: d.titleEn, titleHi: d.titleHi,
    subDomains: d.subDomains.map((sd) => ({
      id: sd.id, titleEn: sd.titleEn, titleHi: sd.titleHi,
      parameters: sd.parameters
        .filter((p) => (p.applicability as string[]).includes(categoryCode))
        .map((p) => ({
          id: p.id, code: p.code, titleEn: p.titleEn, titleHi: p.titleHi,
          options: p.options.map((o) => ({ key: o.key, labelEn: o.labelEn, labelHi: o.labelHi })),
        })),
    })).filter((sd) => sd.parameters.length > 0),
  })).filter((d) => d.subDomains.length > 0) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/app/sssa/monitoring?view=schools" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToMonitoring')}
      </Link>

      <div className="mb-6 rounded-xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy-900">{school.nameHi}</h1>
            <p className="text-sm text-text-secondary">{school.nameEn}</p>
            <p className="mt-1 text-xs text-text-secondary">
              UDISE: {school.udise} · {school.category} · {school.districtCode} / {school.blockCode}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <StatusBadge status={saStatus} label={saStatus === 'submitted' ? t('statusSubmitted') : saStatus === 'draft' ? t('statusDraft') : t('statusNotStarted')} />
            </div>
            <div className="flex gap-4 text-xs">
              {saScore?.scorePercent != null && (
                <span className="text-navy-700">{t('saScoreLabel')}: <span className="font-bold text-lg">{saScore.scorePercent}%</span></span>
              )}
              {vScore?.scorePercent != null && (
                <span className="text-indigo-700">{t('vScoreLabel')}: <span className="font-bold text-lg">{vScore.scorePercent}%</span></span>
              )}
            </div>
          </div>
        </div>
      </div>

      <MonitoringSchoolTabs
        domains={serializedDomains}
        saResponses={saMap}
        vResponses={vMap}
        saStatus={saStatus}
        vStatus={vStatus}
      />
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cls = status === 'submitted' ? 'bg-green-100 text-green-700'
    : status === 'draft' ? 'bg-amber-100 text-amber-700'
    : 'bg-surface text-text-secondary';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status === 'submitted' ? <CheckCircle2 size={14} /> : status === 'draft' ? <Clock size={14} /> : null}
      {label}
    </span>
  );
}
