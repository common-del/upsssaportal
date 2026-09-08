import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildExceptions } from '@/lib/sssa/exceptions';
import { ExceptionMonitor } from '@/components/sssa/ExceptionMonitor';

/**
 * The district's own Self Assessment Monitoring.
 *
 * Both district navs used to point this entry at /app/sssa/monitoring, which
 * middleware role-gates to SSSA_ADMIN — so for every district user the link was a
 * silent bounce to the homepage. This is the same exception-first page, scoped to
 * the caller's district: their silent blocks, their schools' score gaps, their
 * verifiers, and the Uday-band question asked only of themselves.
 */
export default async function DistrictMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect('/login?tab=official');
  const role = session.user.role;
  if (role !== 'DISTRICT_OFFICIAL' && role !== 'DISTRICT_ADMIN') redirect('/');

  // Fail closed: without a district there is nothing this page may show.
  const districtCode = session.user.districtCode;
  if (!districtCode) redirect('/');

  const sp = await searchParams;

  const [cycle, district] = await Promise.all([
    prisma.cycle.findFirst({ where: { isActive: true } }),
    prisma.district.findUnique({ where: { code: districtCode }, select: { nameEn: true } }),
  ]);

  if (!cycle) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No active cycle. Monitoring begins when one starts.
        </div>
      </div>
    );
  }

  const groups = await buildExceptions(cycle.id, { districtCode });
  const requested = sp.flag ?? '';
  const selectedId = groups.some((g) => g.id === requested) ? requested : (groups[0]?.id ?? '');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Self Assessment Monitoring</h1>
        <p className="mt-1 text-sm text-gray-600">
          {district?.nameEn ?? districtCode} · Active Cycle:{' '}
          <span className="font-semibold text-gray-900">{cycle.name}</span> · what needs
          attention first
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <ExceptionMonitor groups={groups} selectedId={selectedId} />
      </Suspense>
    </div>
  );
}
