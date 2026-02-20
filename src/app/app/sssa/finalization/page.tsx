import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getFinalizationSummary } from '@/lib/actions/finalization';
import FinalizationClient from '@/components/finalization/FinalizationClient';

export default async function FinalizationPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('finalization');
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('noCycle')}</div>
    </div>
  );

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('noFramework')}</div>
    </div>
  );

  const gradeBands = await prisma.gradeBand.findMany({ where: { frameworkId: framework.id }, orderBy: { order: 'asc' } });
  const rows = await getFinalizationSummary(cycle.id, framework.id);

  const totalSchools = rows.length;
  const withSa = rows.filter((r) => r.selfScore != null).length;
  const withVerifier = rows.filter((r) => r.verified).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/app/sssa" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-secondary">
        <span>{t('cycle')}: <span className="font-semibold text-navy-900">{cycle.name}</span></span>
        <span>{t('published')}: <span className={`font-semibold ${cycle.resultsPublished ? 'text-green-600' : 'text-amber-600'}`}>{cycle.resultsPublished ? t('yes') : t('no')}</span></span>
      </div>

      {/* Cycle summary banner */}
      <div className="mt-4 rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm text-navy-800">
        {t('cycleBanner', { total: totalSchools, sa: withSa, verified: withVerifier })}
      </div>

      <FinalizationClient
        rows={rows}
        cycleId={cycle.id}
        gradeBands={gradeBands.map((b) => ({ key: b.key, labelEn: b.labelEn, labelHi: b.labelHi }))}
        isPublished={cycle.resultsPublished}
      />
    </div>
  );
}
