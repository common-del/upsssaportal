import { getEscalationInbox } from '@/lib/actions/supervisor';
import { EscalationInbox } from '@/components/supervisor/EscalationInbox';

export default async function EscalationsPage() {
  const rows = await getEscalationInbox();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#073763' }}>
          Escalation inbox
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#5F7190' }}>
          Indicators a verifier could not cleanly judge against the rubric. Each one freezes its
          case until you rule.
        </p>
      </div>
      <EscalationInbox rows={rows} />
    </div>
  );
}
