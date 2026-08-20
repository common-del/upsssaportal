import { getIntegrityReports } from '@/lib/actions/audit';
import { IntegrityInbox } from '@/components/audit/IntegrityInbox';

export default async function IntegrityPage() {
  const rows = await getIntegrityReports();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Integrity reports
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          Reports of inducement or pressure, filed by anyone in the verification workforce. They
          come here as well as to the supervisor, because the supervisor may be the subject.
          Acknowledgement is yours alone to record.
        </p>
      </div>
      <IntegrityInbox rows={rows} />
    </div>
  );
}
