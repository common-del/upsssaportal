import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { VerifierAppLayout } from '@/components/verifier/VerifierLayout';
import { brandHrefForRole } from '@/lib/appNavConfig';
import { unreadNotificationCount } from '@/lib/unreadNotifications';
import { countWaitingAppealsOnMyInspections } from '@/lib/verification/inspectionAppeals';
import { prisma } from '@/lib/db';

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

  // The Appeals badge, on-ground only: like the admin's Decisions badge, a live count injected
  // per-request so the sidebar says whether anything on your record is still being contested.
  let appealsBadge = 0;
  if (role === 'ONGROUND_VERIFIER') {
    const profile = await prisma.verifierProfile.findUnique({
      where: { userId: session.user.id! },
      select: { id: true },
    });
    if (profile) appealsBadge = await countWaitingAppealsOnMyInspections(profile.id);
  }

  return (
    <VerifierAppLayout role={role} userName={userName} unreadCount={unreadCount} appealsBadge={appealsBadge}>
      {children}
    </VerifierAppLayout>
  );
}
