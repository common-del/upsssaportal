'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Hourglass,
  MessageSquare,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DisputesQueue, type DisputeQueueRow } from '@/components/sssa/DisputesQueue';

const NAVY = '#1B2A6B';

type DashboardProps = {
  stats: { total: number; open: number; underReview: number; clarification: number; resolved: number };
  categoryCounts: { name: string; count: number }[];
  tableRows: {
    id: string;
    school: string;
    district: string;
    domain: string;
    category: string;
    raisedBy: string;
    raisedAt: string;
    status: string;
    statusColor: string;
  }[];
  clarifications: {
    id: string;
    school: string;
    issue: string;
    domain: string;
    raisedAt: string;
    status: string;
    statusColor: string;
  }[];
  hasData: boolean;
  queueRows: DisputeQueueRow[];
};

export function DisputesManagement(props: DashboardProps) {
  const [queueOpen, setQueueOpen] = useState(false);
  const { stats, categoryCounts, tableRows, clarifications, hasData, queueRows } = props;

  if (queueOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dispute Queue</h1>
          <button
            type="button"
            onClick={() => setQueueOpen(false)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>
        <DisputesQueue rows={queueRows} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Dispute Resolution Management</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Monitor inconsistencies found in external evaluation, dispute reviews, clarification
            tracking, and resolution status statewide
          </p>
        </header>
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: NAVY }}
        >
          Open Queue View
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Disputes" value={stats.total} icon={FileText} className="border-gray-200" />
        <StatCard label="Open" value={stats.open} icon={AlertCircle} className="border-red-200 text-red-700" />
        <StatCard label="Under Review" value={stats.underReview} icon={Hourglass} className="border-yellow-200 text-yellow-800" />
        <StatCard label="Clarification Pending" value={stats.clarification} icon={MessageSquare} className="border-orange-200 text-orange-800" />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} className="border-green-200 text-green-800" />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Dispute Category Monitoring</h2>
        {!hasData ? (
          <p className="mt-8 text-center text-sm text-gray-500">Not enough data yet</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryCounts} margin={{ bottom: 60 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Inconsistencies Found in External Evaluation
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 pr-4">Dispute ID</th>
                <th className="py-2 pr-4">School</th>
                <th className="py-2 pr-4">District</th>
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Raised By</th>
                <th className="py-2 pr-4">Raised</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Not enough data yet
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
                    onClick={() => { window.location.href = `/app/sssa/disputes/${r.id}`; }}
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/app/sssa/disputes/${r.id}`}
                        className="font-medium text-[#1B2A6B] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.school}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{r.district}</td>
                    <td className="py-2 pr-4">{r.domain}</td>
                    <td className="py-2 pr-4">{r.category}</td>
                    <td className="py-2 pr-4">{r.raisedBy}</td>
                    <td className="py-2 pr-4">{r.raisedAt}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.statusColor}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Clarification Tracking</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {clarifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Not enough data yet</p>
          ) : (
            clarifications.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {c.id.slice(0, 10)}… · {c.school}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {c.issue} · {c.domain} · Raised {c.raisedAt}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${c.statusColor}`}>
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border bg-white p-4 shadow-sm', className)}>
      <Icon className="mb-2 h-6 w-6 opacity-70" />
      <p className="text-xs font-medium uppercase opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
