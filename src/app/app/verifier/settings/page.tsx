import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SettingsClient } from '@/components/school/SettingsClient';
import { brandHrefForRole } from '@/lib/appNavConfig';

const VERIFIER_PORTAL_ROLES = new Set(['VERIFIER', 'ONLINE_VERIFIER', 'ONGROUND_VERIFIER']);

export default async function VerifierSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');
  const role = session.user.role as string;
  if (!VERIFIER_PORTAL_ROLES.has(role)) redirect(brandHrefForRole(role));

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
      roleLabel="Verifier"
      department="School Education Department, Uttar Pradesh"
      scope="Assigned Schools"
      settingsPath="/app/verifier/settings"
    />
  );
}
