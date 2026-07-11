'use client';

import { ClipboardEdit, Gavel, ShieldCheck } from 'lucide-react';
import type { ActivityCategory } from '@/lib/sssa/activityLog';

type ActivityRow = {
  id: string;
  category: ActivityCategory;
  title: string;
  actor: string;
  context: string;
  description: string;
  createdAt: string;
};

const CATEGORY_ICON: Record<ActivityCategory, typeof ClipboardEdit> = {
  'Self Evaluation': ClipboardEdit,
  'External Evaluation': ShieldCheck,
  'Dispute Resolution': Gavel,
};

const CATEGORY_BADGE: Record<ActivityCategory, string> = {
  'Self Evaluation': 'bg-blue-100 text-blue-800',
  'External Evaluation': 'bg-amber-100 text-amber-800',
  'Dispute Resolution': 'bg-purple-100 text-purple-800',
};

export function ActivityLog({
  counts,
  items,
}: {
  counts: { selfEvaluation: number; externalEvaluation: number; disputeResolution: number };
  items: ActivityRow[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="mt-1 text-sm text-gray-600">Track system actions and changes</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={ClipboardEdit} label="Self Evaluation Activity" value={counts.selfEvaluation} />
        <SummaryCard icon={ShieldCheck} label="External Evaluation Activity" value={counts.externalEvaluation} />
        <SummaryCard icon={Gavel} label="Dispute Resolution Activity" value={counts.disputeResolution} />
      </div>

      <div className="divide-y divide-gray-100 rounded-2xl bg-white p-6 shadow-sm">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No activity recorded yet</p>
        ) : (
          items.map((item) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <div key={item.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                <div className="mt-0.5 rounded-lg bg-gray-100 p-2">
                  <Icon className="h-4 w-4 text-gray-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[item.category]}`}>
                      {item.category}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {item.actor}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700">{item.context}</p>
                  <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                  <p className="mt-1 text-xs text-gray-400">{item.createdAt}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardEdit;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="inline-flex rounded-lg bg-gray-100 p-2">
        <Icon className="h-5 w-5 text-[#1B2A6B]" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
