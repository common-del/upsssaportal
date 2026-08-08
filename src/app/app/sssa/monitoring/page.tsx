import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { buildExceptions } from '@/lib/sssa/exceptions';
import { ExceptionMonitor } from '@/components/sssa/ExceptionMonitor';

/**
 * Self Assessment Monitoring, rebuilt exception-first.
 *
 * It used to open on funnel tiles and a paginated list of all 32,579 schools,
 * which made finding the handful that need chasing the officer's job. It now
 * opens on what is wrong. The funnel moved to the School Directory, where the
 * full list already lives, so neither is duplicated.
 */
export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
        No active cycle. Start one to see what needs attention.
      </div>
    );
  }

  const groups = await buildExceptions(cycle.id);

  // Analytics' Low/High Performing tiles still link in with ?performance=…, so
  // that lands on the closest exception rather than 404-ing on a dead filter.
  const requested = sp.flag ?? (sp.performance ? 'low-districts' : '');
  const selectedId = groups.some((g) => g.id === requested) ? requested : (groups[0]?.id ?? '');

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Self Assessment Monitoring</h1>
        <p className="mt-1 text-sm text-gray-600">
          Active Cycle: <span className="font-semibold text-gray-900">{cycle.name}</span> · what
          needs attention first
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <ExceptionMonitor groups={groups} selectedId={selectedId} />
      </Suspense>
    </div>
  );
}
