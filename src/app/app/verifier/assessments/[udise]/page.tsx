import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import {
  getActiveFrameworkForVerification,
  getOrCreateVerificationSubmission,
} from '@/lib/actions/verification';
import VerifierAssessmentForm from '@/components/verification/VerifierAssessmentForm';

export default async function VerifierAssessmentPage({
  params,
}: {
  params: Promise<{ udise: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/system/verifier');
  if (session.user.role !== 'VERIFIER') redirect('/');

  const { udise } = await params;
  const t = await getTranslations('verifierAssessment');
  const userId = session.user.id!;

  // Verify assignment exists for this verifier
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return <EmptyState t={t} msg={t('noCycle')} />;

  const assignment = await prisma.verifierAssignment.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
  });
  if (!assignment || assignment.verifierUserId !== userId) notFound();

  const school = await prisma.school.findUnique({
    where: { udise },
    select: { nameEn: true, nameHi: true, category: true },
  });
  if (!school) notFound();

  const data = await getActiveFrameworkForVerification(udise);
  if (!data) return <EmptyState t={t} msg={t('noFramework')} />;

  const { framework, cycleId, cycleName, totalApplicable } = data;
  const submission = await getOrCreateVerificationSubmission(
    assignment.id, cycleId, udise, framework.id, userId,
  );

  const responseMap: Record<string, { selectedOptionKey: string; notes: string | null }> = {};
  for (const r of submission.responses) {
    responseMap[r.parameterId] = { selectedOptionKey: r.selectedOptionKey, notes: r.notes };
  }

  const evidenceLinks = await prisma.evidenceLink.findMany({
    where: { kind: 'VERIFICATION_RESPONSE', vSubmissionId: submission.id },
    include: { asset: true },
    orderBy: { asset: { createdAt: 'asc' } },
  });
  const evidenceMap: Record<string, { id: string; fileName: string; fileType: string; fileSize: number; blobUrl: string }[]> = {};
  for (const link of evidenceLinks) {
    const pid = link.parameterId ?? '';
    if (!evidenceMap[pid]) evidenceMap[pid] = [];
    evidenceMap[pid].push({ id: link.asset.id, fileName: link.asset.fileName, fileType: link.asset.fileType, fileSize: link.asset.fileSize, blobUrl: link.asset.blobUrl });
  }

  const serializedFramework = {
    id: framework.id,
    domains: framework.domains.map((d) => ({
      id: d.id, code: d.code, titleEn: d.titleEn, titleHi: d.titleHi,
      subDomains: d.subDomains.map((sd) => ({
        id: sd.id, code: sd.code, titleEn: sd.titleEn, titleHi: sd.titleHi,
        parameters: sd.parameters.map((p) => ({
          id: p.id, code: p.code, titleEn: p.titleEn, titleHi: p.titleHi,
          evidenceRequired: p.evidenceRequired,
          options: p.options.map((o) => ({ key: o.key, labelEn: o.labelEn, labelHi: o.labelHi })),
        })),
      })),
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/verifier" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToList')}
      </Link>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-navy-900">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-navy-800">{school.nameHi} <span className="text-text-secondary">/ {school.nameEn}</span></p>
        <p className="text-xs text-text-secondary">UDISE: {udise} · {school.category} · {t('cycle')}: {cycleName}</p>
      </div>

      <VerifierAssessmentForm
        framework={serializedFramework}
        submissionId={submission.id}
        verifierUserId={userId}
        existingResponses={responseMap}
        existingEvidence={evidenceMap}
        totalApplicable={totalApplicable}
        isSubmitted={submission.status === 'SUBMITTED'}
      />
    </div>
  );
}

function EmptyState({ t, msg }: { t: (k: string) => string; msg: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/verifier" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToList')}
      </Link>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{msg}</div>
    </div>
  );
}
