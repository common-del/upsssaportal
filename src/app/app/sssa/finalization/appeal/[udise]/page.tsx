import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import AppealDecisionForm from '@/components/finalization/AppealDecisionForm';

export default async function AppealDecisionPage({ params }: { params: Promise<{ udise: string }> }) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const { udise } = await params;
  const t = await getTranslations('finalization');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) notFound();

  const appeal = await prisma.appeal.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: udise } },
    include: {
      school: { select: { nameEn: true, nameHi: true } },
      items: {
        include: {
          parameter: {
            select: {
              code: true, titleEn: true, titleHi: true,
              options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { key: true, labelEn: true, labelHi: true } },
              subDomain: { select: { domain: { select: { titleEn: true, titleHi: true } } } },
            },
          },
        },
      },
    },
  });
  if (!appeal) notFound();

  const serializedItems = appeal.items.map((item) => ({
    id: item.id,
    parameterId: item.parameterId,
    code: item.parameter.code,
    titleEn: item.parameter.titleEn,
    titleHi: item.parameter.titleHi,
    domainTitleEn: item.parameter.subDomain.domain.titleEn,
    domainTitleHi: item.parameter.subDomain.domain.titleHi,
    schoolSelectedOptionKey: item.schoolSelectedOptionKey,
    verifierSelectedOptionKey: item.verifierSelectedOptionKey,
    schoolJustification: item.schoolJustification,
    decision: item.decision,
    options: item.parameter.options,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/sssa/finalization" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToFinalization')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('decideAppealTitle')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{appeal.school.nameHi} / {appeal.school.nameEn} — {udise}</p>

      <AppealDecisionForm
        appealId={appeal.id}
        items={serializedItems}
        appealStatus={appeal.status}
        actorUserId={session.user.id!}
      />
    </div>
  );
}
