import { auth } from '@/lib/auth';

import { redirect } from 'next/navigation';

import { VerifierAppLayout } from '@/components/verifier/VerifierLayout';

import { unreadNotificationCount } from '@/lib/unreadNotifications';



export default async function VerifierRouteLayout({ children }: { children: React.ReactNode }) {

  const session = await auth();

  if (!session) redirect('/login?tab=verifier');

  if (session.user.role !== 'VERIFIER') redirect('/');



  const userName = session.user.name ?? session.user.id ?? 'Verifier';

  const unreadCount = await unreadNotificationCount(session.user.id!);



  return <VerifierAppLayout userName={userName} unreadCount={unreadCount}>{children}</VerifierAppLayout>;

}

