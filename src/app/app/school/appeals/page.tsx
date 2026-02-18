import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getAppealEligibility, getDifferingParameters } from '@/lib/actions/finalization';
import AppealForm from '@/components/appeals/AppealForm';

export default async function SchoolAppealsPage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('appeal');
  const schoolUdise = session.user.name!;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return <Wrap t={t} msg={t('noCycle')} />;

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') return <Wrap t={t} msg={t('noFramework')} />;

  const elig = await getAppealEligibility(cycle.id, schoolUdise);
  if (!elig.eligible && !('existingAppeal' in elig && elig.existingAppeal)) {
    return <Wrap t={t} msg={t('notEligible')} />;
  }

  const existingAppeal = 'existingAppeal' in elig ? elig.existingAppeal : null;
  const deadlineStr = 'deadline' in elig ? elig.deadline!.toISOString() : null;
  const expired = 'expired' in elig ? elig.expired : false;

  const { diffs } = await getDifferingParameters(cycle.id, schoolUdise, framework.id);

  const existingItems = existingAppeal
    ? await prisma.appealItem.findMany({
        where: { appealId: existingAppeal.id },
        select: { parameterId: true, schoolJustification: true, decision: true },
      })
    : [];

  const serializedDiffs = diffs.map((d) => ({
    ...d,
    existingJustification: existingItems.find((i) => i.parameterId === d.parameterId)?.schoolJustification ?? '',
    decision: existingItems.find((i) => i.parameterId === d.parameterId)?.decision ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToHome')}
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>

      {deadlineStr && (
        <div className="mt-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
          {t('deadline')}: <span className="font-semibold text-navy-900">{new Date(deadlineStr).toLocaleDateString()}</span>
          {expired && <span className="ml-2 text-red-600 font-medium">{t('expired')}</span>}
        </div>
      )}

      <AppealForm
        schoolUdise={schoolUdise}
        cycleId={cycle.id}
        frameworkId={framework.id}
        diffs={serializedDiffs}
        appealStatus={existingAppeal?.status ?? null}
        expired={expired}
      />
    </div>
  );
}

function Wrap({ t, msg }: { t: (k: string) => string; msg: string }) {
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
