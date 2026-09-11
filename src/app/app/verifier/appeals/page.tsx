import { redirect } from 'next/navigation';
import { currentActor, requireOngroundVerifier } from '@/lib/authz';
import { prisma } from '@/lib/db';
import { getAppealsOnMyInspections } from '@/lib/verification/inspectionAppeals';
import { InspectionAppealsList } from '@/components/verifier/InspectionAppealsList';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

/**
 * Appeals against this verifier's inspections, on a page of their own.
 *
 * Moved off the Overview at SSSA's direction: the Overview keeps only the number, and this page
 * carries the record. Read-only throughout, because deciding appeals is the SSSA's Decisions
 * page; the verifier is shown how their calls stood up, and can change none of it.
 */
export default async function VerifierAppealsPage() {
  const actor = await requireOngroundVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  const appeals = profile ? await getAppealsOnMyInspections(profile.id) : [];

  // The header's quiet answer to the question this page exists for.
  const kept = appeals.reduce((n, a) => n + a.keptCount, 0);
  const decidedIndicators = appeals.reduce((n, a) => n + a.keptCount + a.revisedCount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Appeals on your inspections
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Schools can contest a published result after your visit. The SSSA decides these, not
          you.
          {decidedIndicators > 0 && (
            <>
              {' '}
              Across this cycle, {kept.toLocaleString('en-IN')} of{' '}
              {decidedIndicators.toLocaleString('en-IN')} decided indicators were upheld as you
              found them.
            </>
          )}
        </p>
      </div>

      {appeals.length === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
          <p className="text-base font-bold" style={{ color: INK_MUTED }}>
            No school has appealed any of your inspections
          </p>
          <p className="mt-1.5 text-sm text-gray-700">
            An appeal can only be filed in the five days after a result you inspected is
            published. If one is filed, it appears here and on your Overview&apos;s Appeals tile.
          </p>
        </div>
      ) : (
        <InspectionAppealsList appeals={appeals} />
      )}
    </div>
  );
}
