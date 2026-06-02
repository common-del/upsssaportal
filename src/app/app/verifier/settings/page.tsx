import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SettingsClient } from '@/components/school/SettingsClient';

export default async function VerifierSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');
  if (session.user.role !== 'VERIFIER') redirect('/');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      username: true,
      preferredLocale: true,
      notificationPreference: true,
    },
  });
  if (!user) redirect('/login?tab=verifier');

  return (
    <SettingsClient
      username={user.username}
      preferredLocale={user.preferredLocale}
      prefs={user.notificationPreference}
    />
  );
}
