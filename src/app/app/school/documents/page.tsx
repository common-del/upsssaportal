import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ensureMandatoryDocuments } from '@/lib/actions/schoolPortal';
import { MandatoryDocumentsClient } from '@/components/school/MandatoryDocumentsClient';

export default async function MandatoryDocumentsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) redirect('/login?tab=school');

  await ensureMandatoryDocuments(schoolUdise, school.category);

  const documents = await prisma.mandatoryDocument.findMany({
    where: { schoolUdise },
    orderBy: { documentType: 'asc' },
  });

  return (
    <MandatoryDocumentsClient
      documents={documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        status: d.status,
        uploadedAt: d.uploadedAt?.toLocaleDateString('en-IN') ?? null,
        validTill: d.validTill?.toLocaleDateString('en-IN') ?? null,
      }))}
    />
  );
}
