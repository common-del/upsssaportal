import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  buildBlockDashboardData,
  buildDistrictDashboardData,
  buildStateDashboardData,
} from '@/lib/sssa/adminMetrics';
import { UnifiedDashboard } from '@/components/sssa/UnifiedDashboard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; district?: string; block?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login?tab=official');

  const role = session.user.role as string;
  const isDistrictAdmin = role === 'DISTRICT_ADMIN';
  const isSssaAdmin = role === 'SSSA_ADMIN' || role === 'admin';
  if (!isSssaAdmin && !isDistrictAdmin) redirect('/');

  const sp = await searchParams;
  const userDistrictCode = (session.user as { districtCode?: string }).districtCode;

  // Enforce district admin scope restriction
  let scopeDistrict = sp.district ?? '';
  if (isDistrictAdmin) {
    if (!userDistrictCode) redirect('/');
    // Force their own district regardless of query param
    if (sp.scope !== 'state') {
      scopeDistrict = userDistrictCode;
    }
  }

  const scope = sp.scope === 'state' && isSssaAdmin ? 'state'
    : scopeDistrict ? 'district'
    : 'state';

  const blockCode = sp.block ?? '';

  const stateData = await buildStateDashboardData();

  let districtData = null;
  let districtName = '';
  if (scope === 'district' && scopeDistrict) {
    districtData = blockCode
      ? await buildBlockDashboardData(scopeDistrict, blockCode)
      : await buildDistrictDashboardData(scopeDistrict);
    districtName = stateData.districts.find((d) => d.code === scopeDistrict)?.nameEn ?? scopeDistrict;
  }

  return (
    <UnifiedDashboard
      scope={scope as 'state' | 'district'}
      districtCode={scopeDistrict}
      districtName={districtName}
      blockCode={blockCode}
      stateData={stateData}
      districtData={districtData}
      isDistrictAdmin={isDistrictAdmin}
      userDistrictCode={userDistrictCode}
    />
  );
}
