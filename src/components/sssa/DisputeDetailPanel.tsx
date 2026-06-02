'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, ChevronRight, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logDisputeAction } from '@/lib/actions/disputes';

const NAVY = '#1B2A6B';

type HistoryEntry = {
  id: string;
  actionType: string;
  notes: string | null;
  actorUserId: string | null;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  status: string;
  createdAt: string;
  filedBy: string;
  school: string;
  udise: string;
  district: string;
  block: string;
  domain: string;
  subDomain: string;
  parameter: string;
  saScore: number | null;
  verifierScore: number | null;
  schoolArgument: string | null;
  verifierResponse: string | null;
  closedReason: string | null;
  history: HistoryEntry[];
};

function statusPill(status: string) {
  if (status === 'RESOLVED') return 'bg-green-100 text-green-800';
  if (status.includes('CLARIF')) return 'bg-orange-100 text-orange-800';
  if (status.includes('REVIEW') || status.includes('ASSIGNED')) return 'bg-yellow-100 text-yellow-800';
  if (status.includes('ESCALAT')) return 'bg-purple-100 text-purple-800';
  return 'bg-red-100 text-red-800';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    RESOLVED: 'Resolved',
    ESCALATED_DISTRICT: 'Escalated: District',
    ESCALATED_STATE: 'Escalated: State',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

function actionLabel(a: string) {
  const map: Record<string, string> = {
    FILED: 'Dispute Filed',
    NUDGE_SCHOOL: 'Nudge sent to school',
    NUDGE_VERIFIER: 'Verifier Nudged',
    ESCALATE_DISTRICT: 'Escalated to District',
    ESCALATE_STATE: 'Escalated to State',
    RESOLVED: 'Marked Resolved',
    STATUS_CHANGED: 'Status Changed',
  };
  return map[a] ?? a;
}

function actionDotColor(a: string) {
  if (a === 'FILED') return '#3B82F6';
  return NAVY;
}

type TimelineEntry = HistoryEntry & { isSynthetic?: boolean };

function buildTimeline(ticket: TicketDetail): TimelineEntry[] {
  const filedEntry = ticket.history.find((h) => h.actionType === 'FILED');
  const otherHistory = ticket.history.filter((h) => h.actionType !== 'FILED');

  const first: TimelineEntry = filedEntry ?? {
    id: 'synthetic-filed',
    actionType: 'FILED',
    notes: `Filed by: ${ticket.filedBy}`,
    actorUserId: null,
    createdAt: ticket.createdAt,
    isSynthetic: true,
  };

  return [first, ...otherHistory];
}

export function DisputeDetailPanel({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showResolveInput, setShowResolveInput] = useState(false);

  const delta =
    ticket.saScore !== null && ticket.verifierScore !== null
      ? ticket.saScore - ticket.verifierScore
      : null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function doAction(
    actionType: Parameters<typeof logDisputeAction>[1],
    notes?: string,
  ) {
    startTransition(async () => {
      const res = await logDisputeAction(ticket.id, actionType, notes);
      if (res.error) {
        showToast(`Error: ${res.error}`);
      } else {
        showToast(`${actionLabel(actionType)} — logged successfully.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#1B2A6B] px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Dispute #{ticket.id.slice(0, 10)}…</h1>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusPill(ticket.status)}`}>
              {statusLabel(ticket.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Filed {ticket.createdAt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => doAction('NUDGE_SCHOOL')}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
          >
            <Bell className="h-4 w-4 text-blue-500" /> Nudge School
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => doAction('ESCALATE_DISTRICT')}
            className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" /> Escalate to District
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowResolveInput(true)}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Mark Resolved
          </button>
        </div>
      </div>

      {/* Resolve input */}
      {showResolveInput && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-900">Resolution Note</p>
          <textarea
            className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm"
            rows={3}
            placeholder="Describe how this dispute was resolved…"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                doAction('RESOLVED', resolutionNote || undefined);
                setShowResolveInput(false);
              }}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Confirm Resolution
            </button>
            <button
              type="button"
              onClick={() => setShowResolveInput(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="space-y-6 lg:col-span-2">
          {/* School info */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">School Information</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'School Name', value: ticket.school },
                { label: 'UDISE', value: ticket.udise },
                { label: 'District', value: ticket.district },
                { label: 'Block', value: ticket.block },
              ].map((r) => (
                <div key={r.label}>
                  <dt className="text-xs font-medium uppercase text-gray-500">{r.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Dispute details */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Dispute Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Domain', value: ticket.domain },
                { label: 'Sub-Domain', value: ticket.subDomain },
                { label: 'Disputed Parameter', value: ticket.parameter },
                { label: 'SA Score', value: ticket.saScore !== null ? `${ticket.saScore}%` : '—' },
                { label: 'Verifier Score', value: ticket.verifierScore !== null ? `${ticket.verifierScore}%` : '—' },
                {
                  label: 'Delta',
                  value: delta !== null ? (
                    <span className={delta < 0 ? 'text-red-600' : 'text-green-600'}>
                      {delta > 0 ? '+' : ''}{delta}%
                    </span>
                  ) : '—',
                },
              ].map((r) => (
                <div key={r.label}>
                  <dt className="text-xs font-medium uppercase text-gray-500">{r.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Arguments */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Arguments</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">School&apos;s Argument</p>
                <p className="mt-1 text-sm text-gray-800">
                  {ticket.schoolArgument ?? 'No argument provided.'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Verifier&apos;s Response</p>
                <p className="mt-1 text-sm text-gray-800">
                  {ticket.verifierResponse ?? 'No response yet.'}
                </p>
              </div>
              {ticket.closedReason && (
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Resolution Note</p>
                  <p className="mt-1 text-sm text-gray-800">{ticket.closedReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Resolution History</h2>
          <ol className="space-y-4">
            {buildTimeline(ticket).map((h, i, timeline) => (
              <li key={h.id} className="relative pl-5">
                {i < timeline.length - 1 && (
                  <div className="absolute left-[7px] top-5 h-full w-px bg-gray-200" />
                )}
                <div
                  className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: actionDotColor(h.actionType) }}
                />
                <p className="text-sm font-medium text-gray-900">{actionLabel(h.actionType)}</p>
                {h.notes && <p className="mt-0.5 text-xs text-gray-500">{h.notes}</p>}
                <p className="mt-0.5 text-[11px] text-gray-400">{h.createdAt}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
