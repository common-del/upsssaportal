import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { VerifierAppLayout } from '@/components/verifier/VerifierLayout';
import { brandHrefForRole } from '@/lib/appNavConfig';
import { unreadNotificationCount } from '@/lib/unreadNotifications';

/** The three verifier roles. SUPERVISOR and AUDIT_CELL have their own areas and are sent
 *  there rather than bounced to the public site, which read as a broken account. */
const VERIFIER_PORTAL_ROLES = new Set(['VERIFIER', 'ONLINE_VERIFIER', 'ONGROUND_VERIFIER']);

export default async function VerifierRouteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');

  const role = session.user.role as string;
  if (!VERIFIER_PORTAL_ROLES.has(role)) redirect(brandHrefForRole(role));

  const userName = session.user.name ?? session.user.id ?? 'Verifier';
  const unreadCount = await unreadNotificationCount(session.user.id!);

  return (
    <VerifierAppLayout userName={userName} unreadCount={unreadCount}>
      {children}
    </VerifierAppLayout>
  );
}
