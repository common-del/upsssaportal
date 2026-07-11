import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SettingsClient } from '@/components/school/SettingsClient';

export default async function SssaSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=official');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      username: true,
      preferredLocale: true,
      notificationPreference: true,
    },
  });
  if (!user) redirect('/login?tab=official');

  return (
    <SettingsClient
      username={user.username}
      preferredLocale={user.preferredLocale}
      prefs={user.notificationPreference}
      roleLabel="Official"
      department="School Education Department, Uttar Pradesh"
      scope="State"
      settingsPath="/app/sssa/settings"
    />
  );
}
