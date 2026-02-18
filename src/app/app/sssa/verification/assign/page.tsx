import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import AssignForm from '@/components/verification/AssignForm';

export default async function VerifierAssignPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('verifierAssign');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const districts = await prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true, nameHi: true } });
  const verifierCount = await prisma.user.count({ where: { role: 'VERIFIER', active: true } });
  const assignedCount = cycle ? await prisma.verifierAssignment.count({ where: { cycleId: cycle.id } }) : 0;
  const totalSchools = await prisma.school.count();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>

      {!cycle ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('noCycle')}</div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
            <span>{t('cycle')}: <span className="font-semibold text-navy-900">{cycle.name}</span></span>
            <span>{t('verifiers')}: <span className="font-semibold text-navy-900">{verifierCount}</span></span>
            <span>{t('assigned')}: <span className="font-semibold text-navy-900">{assignedCount}</span> / {totalSchools}</span>
          </div>
          <AssignForm
            cycleId={cycle.id}
            districts={districts}
          />
        </>
      )}
    </div>
  );
}
