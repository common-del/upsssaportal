import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db';
import CycleManager from '@/components/framework/CycleManager';
import { BackButton } from '@/components/common/BackButton';

export default async function FrameworksPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('framework');

  const cycles = await prisma.cycle.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      frameworks: {
        include: {
          _count: { select: { domains: true } },
          parameters: { where: { isActive: true }, select: { applicability: true } },
        },
      },
    },
  });

  const cyclesData = cycles.map((c) => {
    const f = c.frameworks ?? null;
    let frameworkData = null;
    if (f) {
      const typeCounts = { PRIMARY: 0, UPPER_PRIMARY: 0, SECONDARY: 0 };
      for (const p of f.parameters) {
        const app = p.applicability as string[];
        if (app.includes('PRIMARY')) typeCounts.PRIMARY++;
        if (app.includes('UPPER_PRIMARY')) typeCounts.UPPER_PRIMARY++;
        if (app.includes('SECONDARY')) typeCounts.SECONDARY++;
      }
      frameworkData = {
        id: f.id,
        status: f.status,
        version: f.version,
        domainCount: f._count.domains,
        typeCounts,
      };
    }
    return {
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      framework: frameworkData,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackButton
        fallbackHref="/app/sssa"
        label={t('backToDashboard')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      />

      <h1 className="mb-6 text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>

      <CycleManager
        cycles={cyclesData}
        hasPublishedFramework={cyclesData.some((c) => c.framework?.status === 'PUBLISHED')}
      />
    </div>
  );
}
