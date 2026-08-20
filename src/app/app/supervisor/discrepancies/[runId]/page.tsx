import { notFound } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { getDiscrepancyCase } from '@/lib/actions/supervisor';
import { DiscrepancyRuling } from '@/components/supervisor/DiscrepancyRuling';

const NAVY = '#1F3864';

export default async function DiscrepancyCasePage(props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  const detail = await getDiscrepancyCase(runId);
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <BackButton
        fallbackHref="/app/supervisor/discrepancies"
        label="Back to the review queue"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: NAVY }}
      />
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          {detail.schoolName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          {detail.districtName} · <span className="font-mono text-xs">{detail.schoolUdise}</span> ·{' '}
          {detail.items.length} discrepanc{detail.items.length === 1 ? 'y' : 'ies'} raised at the
          field visit
        </p>
      </div>
      <DiscrepancyRuling detail={detail} />
    </div>
  );
}
