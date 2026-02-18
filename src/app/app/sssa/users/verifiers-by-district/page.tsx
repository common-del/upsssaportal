import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';

export default async function VerifiersByDistrictPage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('verifierByDistrict');
  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });

  const districts = await prisma.school.groupBy({
    by: ['districtCode'],
    _count: { _all: true },
  });

  const districtRecords = await prisma.district.findMany({
    select: { code: true, nameEn: true },
  });
  const nameMap = new Map(districtRecords.map((d) => [d.code, d.nameEn]));

  const verifierDistricts = await prisma.verifierDistrict.findMany({
    include: { verifier: { select: { id: true, username: true, verifierCapacity: true, active: true } } },
  });

  type DistrictRow = {
    code: string;
    name: string;
    schoolCount: number;
    verifierCount: number;
    totalCapacity: number;
    currentLoad: number;
    remainingCapacity: number;
  };

  let assignmentsByVerifier = new Map<string, number>();
  if (activeCycle) {
    const counts = await prisma.verifierAssignment.groupBy({
      by: ['verifierUserId'],
      where: { cycleId: activeCycle.id },
      _count: { _all: true },
    });
    assignmentsByVerifier = new Map(counts.map((c) => [c.verifierUserId, c._count._all]));
  }

  const districtVerifiers = new Map<string, { verifierCount: number; totalCapacity: number; currentLoad: number }>();
  for (const vd of verifierDistricts) {
    if (!vd.verifier.active) continue;
    const prev = districtVerifiers.get(vd.districtCode) ?? { verifierCount: 0, totalCapacity: 0, currentLoad: 0 };
    prev.verifierCount++;
    prev.totalCapacity += vd.verifier.verifierCapacity ?? 50;
    prev.currentLoad += assignmentsByVerifier.get(vd.verifierUserId) ?? 0;
    districtVerifiers.set(vd.districtCode, prev);
  }

  const rows: DistrictRow[] = districts.map((d) => {
    const stats = districtVerifiers.get(d.districtCode) ?? { verifierCount: 0, totalCapacity: 0, currentLoad: 0 };
    return {
      code: d.districtCode,
      name: nameMap.get(d.districtCode) ?? d.districtCode,
      schoolCount: d._count._all,
      verifierCount: stats.verifierCount,
      totalCapacity: stats.totalCapacity,
      currentLoad: stats.currentLoad,
      remainingCapacity: stats.totalCapacity - stats.currentLoad,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce((acc, r) => ({
    schoolCount: acc.schoolCount + r.schoolCount,
    verifierCount: acc.verifierCount + r.verifierCount,
    totalCapacity: acc.totalCapacity + r.totalCapacity,
    currentLoad: acc.currentLoad + r.currentLoad,
    remainingCapacity: acc.remainingCapacity + r.remainingCapacity,
  }), { schoolCount: 0, verifierCount: 0, totalCapacity: 0, currentLoad: 0, remainingCapacity: 0 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/sssa/verification/assign" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToAssign')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-navy-900">{t('title')}</h1>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-left">
              <th className="px-4 py-3 font-semibold text-navy-800">{t('district')}</th>
              <th className="px-4 py-3 font-semibold text-navy-800 text-right">{t('schools')}</th>
              <th className="px-4 py-3 font-semibold text-navy-800 text-right">{t('verifiers')}</th>
              <th className="px-4 py-3 font-semibold text-navy-800 text-right">{t('totalCapacity')}</th>
              <th className="px-4 py-3 font-semibold text-navy-800 text-right">{t('currentLoad')}</th>
              <th className="px-4 py-3 font-semibold text-navy-800 text-right">{t('remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-border/50 hover:bg-surface/30">
                <td className="px-4 py-2.5 font-medium text-navy-900">{r.name}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">{r.schoolCount}</td>
                <td className="px-4 py-2.5 text-right">{r.verifierCount === 0 ? <span className="text-red-500 font-medium">0</span> : r.verifierCount}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">{r.totalCapacity}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">{r.currentLoad}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={r.remainingCapacity <= 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                    {r.remainingCapacity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface/40 font-semibold">
              <td className="px-4 py-3 text-navy-900">{t('total')}</td>
              <td className="px-4 py-3 text-right">{totals.schoolCount}</td>
              <td className="px-4 py-3 text-right">{totals.verifierCount}</td>
              <td className="px-4 py-3 text-right">{totals.totalCapacity}</td>
              <td className="px-4 py-3 text-right">{totals.currentLoad}</td>
              <td className="px-4 py-3 text-right">
                <span className={totals.remainingCapacity <= 0 ? 'text-red-500' : 'text-green-600'}>
                  {totals.remainingCapacity}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
