import { notFound } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { getWalkthroughConsole } from '@/lib/actions/walkthrough';
import { WalkthroughConsole } from '@/components/verifier/WalkthroughConsole';

const NAVY = '#1F3864';

export default async function WalkthroughConsolePage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  const data = await getWalkthroughConsole(runId);
  // A case assigned to someone else is indistinguishable from one that does not exist.
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <BackButton
        fallbackHref="/app/verifier/walkthroughs"
        label="Back to the walkthrough queue"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: NAVY }}
      />
      {!data.needsDeclaration && (
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
            {data.schoolName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
            {data.districtName} · <span className="font-mono text-xs">{data.schoolUdise}</span> ·
            identity disclosed for this session and recorded
          </p>
        </div>
      )}
      <WalkthroughConsole data={data} />
    </div>
  );
}
