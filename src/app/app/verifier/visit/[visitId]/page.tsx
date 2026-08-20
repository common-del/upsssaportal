import { notFound, redirect } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { requireVerifier } from '@/lib/authz';
import { getFieldVisit } from '@/lib/actions/fieldVisit';
import { FieldVisitWorkspace } from '@/components/verifier/FieldVisitWorkspace';

const NAVY = '#1F3864';

export default async function FieldVisitPage(props: { params: Promise<{ visitId: string }> }) {
  const actor = await requireVerifier();
  if (!actor) redirect('/login?tab=verifier');

  const { visitId } = await props.params;
  const visit = await getFieldVisit(visitId);

  // Not found rather than forbidden, and for a sealed visit too. getFieldVisit scopes to the
  // caller's own visits and re-checks the reveal gate, so a visit belonging to someone else, one
  // not yet revealed, and one that does not exist all look identical from outside.
  if (!visit) notFound();

  return (
    <div className="space-y-5">
      <BackButton
        fallbackHref="/app/verifier/assignments"
        label="Back to your assignments"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: NAVY }}
      />
      <FieldVisitWorkspace visit={visit} />
    </div>
  );
}
