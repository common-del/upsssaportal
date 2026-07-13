import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getActiveFrameworkForSchool,
  getOrCreateSubmission,
} from '@/lib/actions/selfAssessment';
import { prisma } from '@/lib/db';
import SelfAssessmentForm from '@/components/selfAssessment/SelfAssessmentForm';

export default async function SqaafUpdatePage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const t = await getTranslations('selfAssessment');

  const initial = await getActiveFrameworkForSchool(schoolUdise);

  if (!initial) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">SQAAF Update</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {t('noActiveFramework')}
        </div>
      </div>
    );
  }

  const submission = await getOrCreateSubmission(initial.cycleId, schoolUdise, initial.framework.id);
  const answeredParameterIds = submission.responses.map((r) => r.parameterId);

  // Re-fetch with the school's actually-answered parameters kept visible, even if
  // the framework or category applicability changed since the school submitted.
  const data = answeredParameterIds.length > 0
    ? (await getActiveFrameworkForSchool(schoolUdise, answeredParameterIds)) ?? initial
    : initial;

  const { framework, cycleName, totalApplicable } = data;

  const responseMap: Record<string, { selectedOptionKey: string; notes: string | null }> = {};
  for (const r of submission.responses) {
    responseMap[r.parameterId] = { selectedOptionKey: r.selectedOptionKey, notes: r.notes };
  }

  const evidenceLinks = await prisma.evidenceLink.findMany({
    where: { kind: 'SELF_RESPONSE', saSubmissionId: submission.id },
    include: { asset: true },
    orderBy: { asset: { createdAt: 'asc' } },
  });
  const evidenceMap: Record<string, { id: string; fileName: string; fileType: string; fileSize: number; blobUrl: string }[]> = {};
  for (const link of evidenceLinks) {
    const pid = link.parameterId ?? '';
    if (!evidenceMap[pid]) evidenceMap[pid] = [];
    evidenceMap[pid].push({
      id: link.asset.id,
      fileName: link.asset.fileName,
      fileType: link.asset.fileType,
      fileSize: link.asset.fileSize,
      blobUrl: link.asset.blobUrl,
    });
  }

  const serializedFramework = {
    id: framework.id,
    domains: framework.domains.map((d) => ({
      id: d.id,
      code: d.code,
      titleEn: d.titleEn,
      titleHi: d.titleHi,
      subDomains: d.subDomains.map((sd) => ({
        id: sd.id,
        code: sd.code,
        titleEn: sd.titleEn,
        titleHi: sd.titleHi,
        parameters: sd.parameters.map((p) => ({
          id: p.id,
          code: p.code,
          titleEn: p.titleEn,
          titleHi: p.titleHi,
          evidenceRequired: p.evidenceRequired,
          options: p.options.map((o) => ({
            key: o.key,
            labelEn: o.labelEn,
            labelHi: o.labelHi,
          })),
        })),
      })),
    })),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">SQAAF Update</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('cycle')}: <span className="font-semibold">{cycleName}</span>
        </p>
      </header>

      <SelfAssessmentForm
        framework={serializedFramework}
        submissionId={submission.id}
        schoolUdise={schoolUdise}
        userId={session.user.id!}
        existingResponses={responseMap}
        existingEvidence={evidenceMap}
        totalApplicable={totalApplicable}
        isSubmitted={submission.status === 'SUBMITTED'}
        variant="school"
      />
    </div>
  );
}
