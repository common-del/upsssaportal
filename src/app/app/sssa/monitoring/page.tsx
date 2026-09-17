import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { buildExceptions } from '@/lib/sssa/exceptions';
import { buildBehindBlocks } from '@/lib/sssa/cycleCounts';
import { lastRemindedByBlock } from '@/lib/actions/reminders';
import { ExceptionMonitor } from '@/components/sssa/ExceptionMonitor';
import { BehindBlocks } from '@/components/sssa/CycleFunnel';

/**
 * Self Assessment Monitoring, rebuilt exception-first.
 *
 * It used to open on funnel tiles and a paginated list of all 32,579 schools,
 * which made finding the handful that need chasing the officer's job. It now
 * opens on what is wrong. The funnel moved to the School Directory, where the
 * full list already lives, so neither is duplicated.
 *
 * The blocks furthest behind arrived here from the Schools page on 17 September 2026. It was a
 * table of blocks with a chase button, which is monitoring rather than a register of schools,
 * and this page already carried a weaker version of the same finding. Its panel is passed in as
 * a slot because the generic exception table has nowhere to put a Remind button.
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

  // The district select on the block table writes ?district=…, and the reminder history is
  // only needed by that one panel.
  const districtFilter = sp.district ?? '';
  const [groups, behind, lastReminded, districtRecords] = await Promise.all([
    buildExceptions(cycle.id),
    buildBehindBlocks(districtFilter),
    lastRemindedByBlock(),
    prisma.district.findMany({ select: { code: true, nameEn: true }, orderBy: { nameEn: 'asc' } }),
  ]);

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
        <ExceptionMonitor
          groups={groups}
          selectedId={selectedId}
          slots={{
            'behind-blocks': (
              <BehindBlocks
                blocks={behind}
                district={districtFilter}
                districts={districtRecords}
                lastReminded={lastReminded}
              />
            ),
          }}
        />
      </Suspense>
    </div>
  );
}
