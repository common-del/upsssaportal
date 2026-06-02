import Link from 'next/link';
import {
  ClipboardList,
  FileText,
  FolderOpen,
  IndianRupee,
  Bell,
  Settings,
  MapPin,
  Award,
} from 'lucide-react';
import {
  assessmentStatusColor,
  assessmentStatusLabel,
  type AssessmentStatus,
} from '@/lib/school/helpers';
import type { DashboardData } from '@/lib/school/dashboardData';

const NAVY = '#1B2A6B';

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  hideForGovt?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/app/school/sqaaf',
    title: 'SQAAF Update',
    description: 'Submit or update your SQAAF self-assessment',
    icon: <ClipboardList className="h-6 w-6 text-[#1B2A6B]" />,
  },
  {
    href: '/app/school/evidence',
    title: 'Evidence Manager',
    description: 'Manage evidence files for SQAAF sections',
    icon: <FolderOpen className="h-6 w-6 text-[#1B2A6B]" />,
  },
  {
    href: '/app/school/documents',
    title: 'Mandatory Required Documents',
    description: 'Statutory and compliance documents',
    icon: <FileText className="h-6 w-6 text-[#1B2A6B]" />,
  },
  {
    href: '/app/school/fee-disclosure',
    title: 'Fee Disclosure',
    description: 'Publish and update fee structure',
    icon: <IndianRupee className="h-6 w-6 text-[#1B2A6B]" />,
    hideForGovt: true,
  },
  {
    href: '/app/school/report-card',
    title: 'School Report Card',
    description: 'View your public-facing school report card',
    icon: <Award className="h-6 w-6 text-[#1B2A6B]" />,
  },
  {
    href: '/app/school/notifications',
    title: 'Notifications',
    description: 'Cycle updates, review comments and deadlines',
    icon: <Bell className="h-6 w-6 text-[#1B2A6B]" />,
  },
  {
    href: '/app/school/settings',
    title: 'Settings',
    description: 'Profile, language and notification preferences',
    icon: <Settings className="h-6 w-6 text-[#1B2A6B]" />,
  },
];

function ProgressBar({ pct, color = NAVY }: { pct: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

export function SchoolDashboard({ data }: { data: DashboardData }) {
  const actions = QUICK_ACTIONS.filter((a) => !a.hideForGovt || data.showFeeDisclosure);
  const status = data.assessmentStatus as AssessmentStatus;

  return (
    <div className="space-y-6">
      {/* Section A: School info card */}
      <section className="relative rounded-2xl bg-white p-6 shadow-sm">
        <span
          className={`absolute right-6 top-6 rounded-full px-3 py-0.5 text-xs font-semibold ${assessmentStatusColor(status)}`}
        >
          {assessmentStatusLabel(status)}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">School Dashboard</p>
        <h1 className="mt-2 pr-32 text-2xl font-bold text-gray-900 sm:text-3xl">{data.school.nameEn}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-4 w-4 shrink-0" />
          UDISE {data.school.udise}
          {data.school.location ? ` · ${data.school.location}` : ''}
        </p>

        {data.cycle && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Active Assessment Cycle</p>
                <p className="mt-1 font-semibold text-gray-900">{data.cycle.name}</p>
                {data.cycle.deadline && (
                  <p className="text-sm text-gray-500">Deadline: {data.cycle.deadline}</p>
                )}
              </div>
              <p className="text-2xl font-bold" style={{ color: NAVY }}>
                {data.cycle.completionPct}%
              </p>
            </div>
            <div className="mt-3">
              <ProgressBar pct={data.cycle.completionPct} />
            </div>
          </div>
        )}
      </section>

      {/* Section B: Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]">
                {action.icon}
              </div>
              <p className="font-bold text-gray-900">{action.title}</p>
              <p className="mt-1 text-sm text-gray-500">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Section C: Summary cards */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Pending Tasks */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">Pending Tasks</h3>
          <ul className="space-y-3">
            {data.pendingTasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${task.dotColor}`} />
                {task.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Upload Summary */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">Upload Summary</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Mandatory documents uploaded: {data.docsUploaded} / {data.docsTotal}</span>
              </div>
              <div className="mt-2">
                <ProgressBar pct={data.docsTotal > 0 ? (data.docsUploaded / data.docsTotal) * 100 : 0} />
              </div>
              <Link href="/app/school/documents" className="mt-2 inline-block text-sm font-medium text-[#1B2A6B] hover:underline">
                View documents →
              </Link>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Evidence files linked: {data.evidenceLinked} / {data.evidenceRequired}</span>
              </div>
              <div className="mt-2">
                <ProgressBar pct={data.evidenceRequired > 0 ? (data.evidenceLinked / data.evidenceRequired) * 100 : 0} />
              </div>
              <Link href="/app/school/evidence" className="mt-2 inline-block text-sm font-medium text-[#1B2A6B] hover:underline">
                Manage evidence →
              </Link>
            </div>
          </div>
        </div>

        {/* Notifications Summary */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
            {data.unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {data.unreadCount} new
              </span>
            )}
          </div>
          <ul className="space-y-3">
            {data.notifications.length === 0 ? (
              <li className="text-sm text-gray-500">No notifications yet.</li>
            ) : (
              data.notifications.map((n) => (
                <li key={n.id} className="border-b border-gray-50 pb-3 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{n.body}</p>
                </li>
              ))
            )}
          </ul>
          <Link href="/app/school/notifications" className="mt-3 inline-block text-sm font-medium text-[#1B2A6B] hover:underline">
            View all →
          </Link>
        </div>
      </section>
    </div>
  );
}
