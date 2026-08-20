import { redirect } from 'next/navigation';
import { requireVerifier } from '@/lib/authz';
import { getMyAssignments } from '@/lib/actions/cohort';
import { AssignmentCard } from '@/components/verifier/AssignmentCard';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

/**
 * The On-Ground Verifier's assignments.
 *
 * Field screens must work on a low-end Android tablet in bright sunlight, per the brief: high
 * contrast, large tap targets, no thin type. That is why the cards are bordered rather than
 * shadowed, the declaration buttons are full-height, and nothing here is set below 12px.
 */
export default async function AssignmentsPage() {
  const actor = await requireVerifier();
  if (!actor) redirect('/login?tab=verifier');

  const assignments = await getMyAssignments();
  const sealed = assignments.filter((a) => a.state === 'SEALED').length;
  const revealed = assignments.length - sealed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Your assignments
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          You are given the district and the travel window in advance. The school itself unlocks on
          the morning of the inspection.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">You have no open assignments.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            Assignments appear once SSSA builds this year&apos;s field cohort. If you expect work
            here, your certification may not be active yet, in which case nothing is allocated to
            you.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {revealed > 0 && (
              <span className="font-semibold" style={{ color: '#BF9000' }}>
                {revealed} to visit today.{' '}
              </span>
            )}
            {sealed} still sealed.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {assignments.map((a) => (
              <AssignmentCard key={a.visitId} assignment={a} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
