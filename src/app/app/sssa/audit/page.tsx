import { getAuditOverview } from '@/lib/actions/audit';
import { AuditQueueClient } from '@/components/audit/AuditQueueClient';

export default async function AuditHomePage() {
  const overview = await getAuditOverview();
  if (!overview) return <p className="text-sm text-gray-600">Not authorised.</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Audit queue
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          A random sample of already-published verifications, re-checked blind. The primary
          verifier&apos;s findings stay hidden until you submit your own.
        </p>
      </div>
      <AuditQueueClient overview={overview} />
    </div>
  );
}
