import { auth } from '@/lib/auth';

import { redirect } from 'next/navigation';

import { SssaAdminLayout } from '@/components/sssa/SssaTopNav';

import { DistrictDashboardLayout } from '@/components/district/DistrictDashboardLayout';

import { unreadNotificationCount } from '@/lib/unreadNotifications';



export default async function DashboardLayout({ children }: { children: React.ReactNode }) {

  const session = await auth();

  if (!session) redirect('/login?tab=official');

  const role = session.user.role as string;

  if (role !== 'SSSA_ADMIN' && role !== 'admin' && role !== 'DISTRICT_ADMIN') redirect('/');

  const userName = session.user.name ?? session.user.id ?? 'Admin';

  const unreadCount = await unreadNotificationCount(session.user.id!);



  if (role === 'DISTRICT_ADMIN') {

    return <DistrictDashboardLayout userName={userName} unreadCount={unreadCount}>{children}</DistrictDashboardLayout>;

  }



  return <SssaAdminLayout userName={userName} unreadCount={unreadCount}>{children}</SssaAdminLayout>;

}

