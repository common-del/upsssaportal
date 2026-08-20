import { notFound, redirect } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { requireVerifier } from '@/lib/authz';
import { getDeskCase } from '@/lib/actions/deskScreening';
import { DeskCaseWorkspace } from '@/components/verifier/DeskCaseWorkspace';

const NAVY = '#1F3864';
const INK_MUTED = '#5F7190';

export default async function DeskCasePage(props: { params: Promise<{ runId: string }> }) {
  const actor = await requireVerifier();
  if (!actor) redirect('/login?tab=verifier');

  const { runId } = await props.params;
  const deskCase = await getDeskCase(runId);

  // Not found rather than forbidden. getDeskCase scopes to the caller's own batch, so a case
  // belonging to another verifier is indistinguishable from one that does not exist, and the
  // queue cannot be enumerated by trying ids.
  if (!deskCase) notFound();

  return (
    <div className="space-y-5">
      <BackButton
        fallbackHref="/app/verifier/desk"
        label="Back to your queue"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: NAVY }}
      />

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Indicator review
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          You are not told which school this is. Record a decision against every indicator the
          system could not check, with a reason wherever you do not accept the claim.
        </p>
      </div>

      <DeskCaseWorkspace deskCase={deskCase} />
    </div>
  );
}
