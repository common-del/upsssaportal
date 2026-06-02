'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Building2,
  Users,
  User,
  TrendingUp,
  LayoutGrid,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  Clock,
  Circle,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  UP_NAVY,
  SUBMISSION_STATUS,
  MANAGEMENT_SCORES,
  DISTRICT_MONITORING,
  DISTRICT_RANKINGS,
  DISTRICTS,
  SCHOOL_TYPES,
  SQAAF_DOMAINS,
  HEATMAP_DATA,
  heatmapCellColor,
  getBlocksForDistrict,
  getBlockChartData,
  getClustersForBlock,
  getClusterChartData,
  getSchoolsInCluster,
  SCHOOL_SEARCH_LIST,
} from '@/lib/sssa/dashboardDummyData';
import type { District } from '@/lib/public/constants';

const ANALYTICS_TABS = ['State', 'District', 'Block', 'Cluster', 'School'] as const;
type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

interface SssaAdminDashboardProps {
  ticketCount?: number;
}

export function SssaAdminDashboard({ ticketCount = 4 }: SssaAdminDashboardProps) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardHeader />
        <StatCards />
        <SubmissionProgress />
        <ChartsRow />
        <QuickActions ticketCount={ticketCount} />
        <SelfAssessmentMonitoring />
        <FinalizationPipeline />
        <AnalyticsSection />
      </div>
    </div>
  );
}

function DashboardHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">
        State Dashboard: Uttar Pradesh
      </h1>
      <p className="mt-1 text-gray-600">
        Active Cycle: UP-SQAAF Cycle 2025-26 (Annual)
      </p>
    </div>
  );
}

function StatCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl bg-[#1B2A6B] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-90">
              Total Schools
            </p>
            <p className="mt-1 text-2xl font-bold">1,50,540</p>
          </div>
          <Building2 className="text-[#F5B731]" size={28} />
        </div>
      </div>
      <div className="rounded-xl bg-[#F5B731] p-5 shadow-sm">
        <div className="flex items-start justify-between text-[#1B2A6B]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-90">
              Total Enrolment
            </p>
            <p className="mt-1 text-2xl font-bold">2,45,67,890</p>
          </div>
          <Users size={28} />
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total Teachers (PTR 31:1)
            </p>
            <p className="mt-1 text-2xl font-bold text-[#1B2A6B]">7,92,540</p>
          </div>
          <User className="text-[#1B2A6B]" size={28} />
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Average Score
            </p>
            <p className="mt-0.5 text-xs font-medium text-green-600">▲ 2.3% from last cycle</p>
            <p className="mt-1 text-2xl font-bold text-[#1B2A6B]">54.2%</p>
          </div>
          <TrendingUp className="text-green-600" size={28} />
        </div>
      </div>
    </div>
  );
}

function SubmissionProgress() {
  const pct = 59;
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1B2A6B]">Submission Progress</h2>
      <p className="mt-1 text-sm text-gray-600">89,240 of 1,50,540 schools submitted</p>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-[#1B2A6B] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-sm font-semibold text-[#1B2A6B]">{pct}%</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SUBMISSION_STATUS.map((s) => (
          <div key={s.name} className="text-center sm:text-left">
            <p className="text-lg font-bold" style={{ color: s.fill }}>
              {s.value.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-600">{s.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartsRow() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-[#1B2A6B]">Assessment Status Distribution</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...SUBMISSION_STATUS]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {SUBMISSION_STATUS.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) =>
                  typeof v === 'number' ? v.toLocaleString('en-IN') : String(v ?? '')
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-[#1B2A6B]">Performance by Management Type</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={MANAGEMENT_SCORES} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="type" width={80} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="score" fill={UP_NAVY} radius={[0, 4, 4, 0]} name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function QuickActions({ ticketCount }: { ticketCount: number }) {
  const actions = [
    {
      href: '/app/sssa/frameworks',
      icon: LayoutGrid,
      iconBg: 'bg-[#1B2A6B]',
      title: 'SQAAF Framework Builder',
      desc: 'Build and manage the assessment framework',
    },
    {
      href: '/app/sssa/verification/assign',
      icon: UserCheck,
      iconBg: 'bg-purple-600',
      title: 'Verifier Assignments',
      desc: 'Assign verifiers to schools',
    },
    {
      href: '/app/sssa/users',
      icon: User,
      iconBg: 'bg-orange-500',
      title: 'User Management',
      desc: 'Create and manage users',
    },
    {
      href: '/app/sssa/tickets',
      icon: MessageSquare,
      iconBg: 'bg-red-500',
      title: 'Dispute Tickets',
      desc: 'Review and resolve disputes',
      badge: `${ticketCount} tickets`,
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-[#1B2A6B]">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white',
                  a.iconBg,
                )}
              >
                <a.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#1B2A6B]">{a.title}</p>
                  {a.badge && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {a.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">{a.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SelfAssessmentMonitoring() {
  const rows = [
    { label: 'Schools Submitted', current: 89240, total: 150540, pct: 59, color: UP_NAVY },
    { label: 'Under Verification', current: 18320, total: 89240, pct: 21, color: '#3B82F6' },
    { label: 'Approved', current: 32450, total: 89240, pct: 36, color: '#22C55E' },
  ];

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1B2A6B]">Self Assessment Monitoring</h2>
      <div className="mt-6 space-y-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-gray-700">{r.label}</span>
              <span className="text-gray-600">
                {r.current.toLocaleString('en-IN')} / {r.total.toLocaleString('en-IN')} —{' '}
                <span className="font-semibold text-[#1B2A6B]">{r.pct}%</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full"
                style={{ width: `${r.pct}%`, backgroundColor: r.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">District</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Under Review</th>
              <th className="px-3 py-2">Approved</th>
              <th className="px-3 py-2">Sent Back</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {DISTRICT_MONITORING.map((row) => (
              <tr key={row.district} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.district}</td>
                <td className="px-3 py-2">{row.submitted.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.underReview.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.approved.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.sentBack.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinalizationPipeline() {
  const stages = [
    { name: 'Verification', count: '32,450 schools', status: 'complete' as const },
    { name: 'Appeals', count: '847 appeals filed', status: 'progress' as const },
    { name: 'Grade Assignment', count: 'pending', status: 'pending' as const },
    { name: 'Publication', count: 'pending', status: 'pending' as const },
  ];

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1B2A6B]">Finalization & Results</h2>
      <div className="mt-6 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:justify-between">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex flex-1 items-center gap-2">
            <StageNode stage={stage} index={i + 1} />
            {i < stages.length - 1 && (
              <ChevronRight className="hidden shrink-0 text-gray-300 lg:block" size={24} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageNode({
  stage,
  index,
}: {
  stage: { name: string; count: string; status: 'complete' | 'progress' | 'pending' };
  index: number;
}) {
  const styles = {
    complete: { ring: 'border-green-500 bg-green-50', icon: CheckCircle2, iconColor: 'text-green-600' },
    progress: { ring: 'border-[#F5B731] bg-amber-50', icon: Clock, iconColor: 'text-[#F5B731]' },
    pending: { ring: 'border-gray-300 bg-gray-50', icon: Circle, iconColor: 'text-gray-400' },
  }[stage.status];
  const Icon = styles.icon;

  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full border-2',
          styles.ring,
        )}
      >
        {stage.status === 'pending' ? (
          <span className="text-sm font-bold text-gray-500">{index}</span>
        ) : (
          <Icon className={styles.iconColor} size={24} />
        )}
      </div>
      <p className="mt-2 font-semibold text-[#1B2A6B]">{stage.name}</p>
      <p className="mt-0.5 text-xs text-gray-500">{stage.count}</p>
    </div>
  );
}

function AnalyticsSection() {
  const [tab, setTab] = useState<AnalyticsTab>('State');

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1B2A6B]">Analytics</h2>
      <p className="mt-1 text-sm text-gray-600">Drill down from state to school level</p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {ANALYTICS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-[#1B2A6B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'State' && <StateAnalytics />}
        {tab === 'District' && <DistrictAnalytics />}
        {tab === 'Block' && <BlockAnalytics />}
        {tab === 'Cluster' && <ClusterAnalytics />}
        {tab === 'School' && <SchoolAnalytics />}
      </div>
    </div>
  );
}

function StateAnalytics() {
  return (
    <>
      <h3 className="mb-3 font-medium text-gray-700">District Rankings</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={DISTRICT_RANKINGS} margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="district" width={90} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="score" fill={UP_NAVY} name="Avg SQAAF" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h3 className="mb-2 mt-8 font-medium text-gray-700">District × Management Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-center text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left">District</th>
              {SCHOOL_TYPES.map((t) => (
                <th key={t} className="px-2 py-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_DATA.map((row) => (
              <tr key={row.district} className="border-b border-gray-100">
                <td className="px-2 py-2 text-left font-medium">{row.district}</td>
                {SCHOOL_TYPES.map((type) => {
                  const score = row.scores[type];
                  return (
                    <td key={type} className="px-1 py-1">
                      <div
                        className="flex min-h-[44px] items-center justify-center rounded-md font-semibold"
                        style={{ backgroundColor: heatmapCellColor(score) }}
                      >
                        {score}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DistrictAnalytics() {
  const [district, setDistrict] = useState<District>(DISTRICTS[0]);
  const blocks = getBlocksForDistrict(district);
  const chartData = getBlockChartData(district);

  return (
    <>
      <label className="text-sm font-medium text-gray-700">Select District</label>
      <select
        value={district}
        onChange={(e) => setDistrict(e.target.value as District)}
        className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" fill={UP_NAVY} name="Avg Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Block</th>
              <th className="px-3 py-2">Total Schools</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Avg Score</th>
              <th className="px-3 py-2">Top Performer</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {blocks.map((b) => (
              <tr key={b.block}>
                <td className="px-3 py-2 font-medium">{b.block}</td>
                <td className="px-3 py-2">{b.totalSchools.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{b.submitted.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{b.avgScore}%</td>
                <td className="px-3 py-2">{b.topPerformer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BlockAnalytics() {
  const [district, setDistrict] = useState<District>(DISTRICTS[0]);
  const blocks = getBlocksForDistrict(district);
  const [block, setBlock] = useState(blocks[0].block);
  const clusters = getClustersForBlock(district, block);
  const chartData = getClusterChartData(district, block);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Select District</label>
          <select
            value={district}
            onChange={(e) => {
              const d = e.target.value as District;
              setDistrict(d);
              setBlock(getBlocksForDistrict(d)[0].block);
            }}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Select Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {blocks.map((b) => (
              <option key={b.block} value={b.block}>
                {b.block}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" fill={UP_NAVY} name="Avg Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Cluster</th>
              <th className="px-3 py-2">Schools</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Avg Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clusters.map((c) => (
              <tr key={c.cluster}>
                <td className="px-3 py-2 font-medium">{c.cluster}</td>
                <td className="px-3 py-2">{c.schools}</td>
                <td className="px-3 py-2">{c.submitted}</td>
                <td className="px-3 py-2">{c.avgScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ClusterAnalytics() {
  const [district, setDistrict] = useState<District>(DISTRICTS[0]);
  const blocks = getBlocksForDistrict(district);
  const [block, setBlock] = useState(blocks[0].block);
  const clusters = getClustersForBlock(district, block);
  const [cluster, setCluster] = useState(clusters[0].cluster);
  const schools = getSchoolsInCluster(district, block, cluster);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        <SelectField
          label="Select District"
          value={district}
          options={DISTRICTS.map((d) => ({ value: d, label: d }))}
          onChange={(v) => {
            setDistrict(v as District);
            const b = getBlocksForDistrict(v as District)[0].block;
            setBlock(b);
            setCluster(getClustersForBlock(v as District, b)[0].cluster);
          }}
        />
        <SelectField
          label="Select Block"
          value={block}
          options={blocks.map((b) => ({ value: b.block, label: b.block }))}
          onChange={(v) => {
            setBlock(v);
            setCluster(getClustersForBlock(district, v)[0].cluster);
          }}
        />
        <SelectField
          label="Select Cluster"
          value={cluster}
          options={clusters.map((c) => ({ value: c.cluster, label: c.cluster }))}
          onChange={setCluster}
        />
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">School Name</th>
              <th className="px-3 py-2">UDISE</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {schools.map((s) => (
              <tr key={s.udise}>
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{s.udise}</td>
                <td className="px-3 py-2">{s.submitted ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">{s.score}%</td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SchoolAnalytics() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return SCHOOL_SEARCH_LIST.slice(0, 8);
    return SCHOOL_SEARCH_LIST.filter(
      (s) => s.name.toLowerCase().includes(q) || s.udise.includes(q),
    );
  }, [query]);

  const school = SCHOOL_SEARCH_LIST.find((s) => s.id === selectedId);

  return (
    <>
      <label className="text-sm font-medium text-gray-700">
        Search by school name or UDISE
      </label>
      <div className="relative mt-1 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId('');
          }}
          placeholder="Search by school name or UDISE"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm"
        />
      </div>
      {filtered.length > 0 && !school && (
        <ul className="mt-2 max-w-md rounded-lg border border-gray-200 bg-white shadow-sm">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(s.id);
                  setQuery(s.name);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-gray-500">{s.udise}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {school && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1B2A6B]">{school.name}</h3>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">UDISE</dt>
                  <dd className="font-medium">{school.udise}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">District</dt>
                  <dd className="font-medium">{school.district}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Block</dt>
                  <dd className="font-medium">{school.block}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium">{school.type}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <StatusBadge status={school.status} />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <CircularScore score={school.overallScore} />
              <p className="mt-2 text-sm font-medium text-gray-600">Overall Score</p>
            </div>
          </div>
          <div className="mt-6">
            <h4 className="font-semibold text-[#1B2A6B]">Domain-wise Scores</h4>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {SQAAF_DOMAINS.map((domain) => (
                  <tr key={domain} className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-700">{domain}</td>
                    <td className="py-2 w-16 text-right font-semibold">
                      {school.domainScores[domain]}%
                    </td>
                    <td className="py-2 pl-4">
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-[#1B2A6B]"
                          style={{ width: `${school.domainScores[domain]}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function CircularScore({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="relative h-32 w-32">
      <svg className="-rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={UP_NAVY}
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#1B2A6B]">
        {score}%
      </span>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Approved: 'bg-green-100 text-green-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    'Sent Back': 'bg-orange-100 text-orange-800',
  };
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status] ?? 'bg-gray-100 text-gray-800',
      )}
    >
      {status}
    </span>
  );
}
