import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SettingsClient } from '@/components/school/SettingsClient';

export default async function SchoolSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      username: true,
      preferredLocale: true,
      notificationPreference: true,
    },
  });
  if (!user) redirect('/login?tab=school');

  return (
    <SettingsClient
      username={user.username}
      preferredLocale={user.preferredLocale}
      prefs={user.notificationPreference}
    />
  );
}
