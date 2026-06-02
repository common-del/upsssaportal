import { auth } from '@/lib/auth';

import { redirect } from 'next/navigation';

import { DistrictAdminLayout } from '@/components/district/DistrictTopNav';

import { unreadNotificationCount } from '@/lib/unreadNotifications';



export default async function DistrictLayout({ children }: { children: React.ReactNode }) {

  const session = await auth();

  if (!session) redirect('/login?tab=official');

  if (session.user.role !== 'DISTRICT_OFFICIAL') redirect('/');



  const userName = session.user.name ?? session.user.id ?? 'District Admin';

  const unreadCount = await unreadNotificationCount(session.user.id!);



  return <DistrictAdminLayout userName={userName} unreadCount={unreadCount}>{children}</DistrictAdminLayout>;

}

