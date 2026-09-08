import { notFound } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { getAuditCaseDetail } from '@/lib/actions/audit';
import { AuditCaseWorkspace } from '@/components/audit/AuditCaseWorkspace';

const NAVY = '#1F3864';

export default async function AuditCasePage(props: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await props.params;
  const detail = await getAuditCaseDetail(caseId);
  // A case belonging to another auditor is indistinguishable from one that does not exist.
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <BackButton
        fallbackHref="/app/audit"
        label="Back to the audit queue"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: NAVY }}
      />
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          {detail.schoolName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          {detail.blockName}, {detail.districtName} ·{' '}
          <span className="font-mono text-xs">{detail.schoolUdise}</span>
        </p>
      </div>
      <AuditCaseWorkspace detail={detail} />
    </div>
  );
}
