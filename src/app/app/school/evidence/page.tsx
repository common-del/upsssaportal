import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getActiveFrameworkForSchool, getOrCreateSubmission } from '@/lib/actions/selfAssessment';
import { EvidenceManagerClient } from '@/components/school/EvidenceManagerClient';

export default async function EvidenceManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ parameterId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const sp = await searchParams;
  const data = await getActiveFrameworkForSchool(schoolUdise);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Evidence Manager</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No active assessment cycle. Evidence management will be available when a cycle is active.
        </div>
      </div>
    );
  }

  const submission = await getOrCreateSubmission(data.cycleId, schoolUdise, data.framework.id);

  const evidenceLinks = await prisma.evidenceLink.findMany({
    where: { kind: 'SELF_RESPONSE', saSubmissionId: submission.id },
    include: {
      asset: true,
      parameter: {
        select: {
          id: true,
          code: true,
          titleEn: true,
          subDomain: {
            select: {
              titleEn: true,
              domain: { select: { id: true, titleEn: true } },
            },
          },
        },
      },
    },
    orderBy: { asset: { createdAt: 'desc' } },
  });

  const parameters = data.framework.domains.flatMap((d) =>
    d.subDomains.flatMap((sd) =>
      sd.parameters.map((p) => ({
        id: p.id,
        code: p.code,
        label: p.titleEn,
        domainId: d.id,
        domainLabel: d.titleEn,
        subDomainLabel: sd.titleEn,
      })),
    ),
  );

  const rows = evidenceLinks
    .filter((l) => l.parameter)
    .map((l) => ({
      assetId: l.asset.id,
      fileName: l.asset.fileName,
      uploadedAt: l.asset.createdAt.toLocaleDateString('en-IN'),
      parameterId: l.parameterId!,
      domainLabel: l.parameter!.subDomain.domain.titleEn,
      subDomainLabel: l.parameter!.subDomain.titleEn,
      parameterLabel: l.parameter!.titleEn,
    }));

  return (
    <EvidenceManagerClient
      saSubmissionId={submission.id}
      parameters={parameters}
      rows={rows}
      initialParameterFilter={sp.parameterId}
    />
  );
}
