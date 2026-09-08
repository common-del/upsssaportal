import { getDeEmpanelmentCases } from '@/lib/actions/supervisor';
import { DeEmpanelmentBoard } from '@/components/supervisor/DeEmpanelmentBoard';

export default async function DeEmpanelmentPage() {
  const items = await getDeEmpanelmentCases();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          De-empanelment cases
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          Every empanelled verifier&apos;s audited record against both rules: the contradiction
          rate with its minimum-cases floor, and the absolute count in a rolling 12 months. Only
          reconciled audits count, and only a person confirms a removal.
        </p>
      </div>
      <DeEmpanelmentBoard items={items} />
    </div>
  );
}
