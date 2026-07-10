'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Building,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Droplets,
  FileText,
  FlaskConical,
  Flame,
  GraduationCap,
  Monitor,
  Scale,
  Shield,
  Stethoscope,
  Toilet,
  Trees,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { LevelBadge } from '@/components/public/LevelBadge';
import {
  levelDescription,
  scoreToLevel,
  type SchoolProfileData,
} from '@/lib/public/schoolProfile';
import type { PerformanceLevel } from '@/lib/public/constants';

const NAVY = '#1B2A6B';
const TABS = ['Overview', 'Performance (SQAAF)', 'Fee Disclosure', 'School Report Card'] as const;
type TabId = (typeof TABS)[number];

function ProgressBarRow({
  label,
  value,
  max = 100,
  color = NAVY,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function CompareBars({
  our,
  compare,
  top,
  compareLabel,
}: {
  our: number;
  compare: number;
  top: number;
  compareLabel: string;
}) {
  const rows = [
    { label: 'Our School', value: our, color: NAVY },
    { label: compareLabel, value: compare, color: '#6B7280' },
    { label: 'Top Score', value: top, color: '#F5B731' },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-gray-600">{r.label}</span>
            <span className="font-medium">{r.value}/100</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.value}%`, backgroundColor: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SchoolProfileContent({
  profile,
  backHref,
  backLabel,
}: {
  profile: SchoolProfileData;
  backHref: string;
  backLabel: string;
}) {
  const [tab, setTab] = useState<TabId>('Overview');
  const [compareMode, setCompareMode] = useState<'state' | 'district'>('state');
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});

  const compareAvg =
    compareMode === 'state'
      ? profile.performance.stateAverage
      : profile.performance.districtAverage;
  const diff = profile.overallScore - compareAvg;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#1B2A6B] hover:underline print:hidden"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </Link>

      <div
        className="relative rounded-xl px-6 py-6 text-white shadow-md"
        style={{ backgroundColor: NAVY }}
      >
        <span className="absolute right-4 top-4 rounded-full bg-[#F5B731] px-3 py-1 text-xs font-bold text-[#1B2A6B]">
          Self Evaluated
        </span>
        <h1 className="pr-32 text-2xl font-bold sm:text-3xl">{profile.name}</h1>
        <p className="mt-2 text-sm text-white/85">
          {profile.udise} · {profile.district} · {profile.block}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1 border-b border-gray-200 print:hidden">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-[#1B2A6B] text-[#1B2A6B]'
                : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <OverviewTab profile={profile} />}
        {tab === 'Performance (SQAAF)' && (
          <PerformanceTab
            profile={profile}
            compareMode={compareMode}
            setCompareMode={setCompareMode}
            compareAvg={compareAvg}
            diff={diff}
            expandedDomains={expandedDomains}
            setExpandedDomains={setExpandedDomains}
          />
        )}
        {tab === 'Fee Disclosure' && <FeeTab profile={profile} />}
        {tab === 'School Report Card' && <ReportCardTab profile={profile} />}
      </div>
    </div>
  );
}

const FACILITY_NAMES = ['Library', 'Science Lab', 'Computer Lab', 'Playground'] as const;

const FACILITY_ICONS: Record<(typeof FACILITY_NAMES)[number], LucideIcon> = {
  Library: BookOpen,
  'Science Lab': FlaskConical,
  'Computer Lab': Monitor,
  Playground: Trees,
};

function safetyCheckIcon(label: string): LucideIcon {
  if (label.includes('Toilets')) return Toilet;
  if (label.includes('Drinking Water')) return Droplets;
  if (label.includes('Medical')) return Stethoscope;
  if (label.includes('Secure') || label.includes('Premises')) return Shield;
  if (label.includes('Fire')) return Flame;
  if (label.includes('Building')) return Building;
  return Building2;
}

type AmenityItem = {
  id: string;
  name: string;
  available: boolean;
  icon: LucideIcon;
  validTill?: string | null;
};

function AmenityCard({ name, available, icon: Icon, validTill }: AmenityItem) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <Icon
        className={cn('h-5 w-5 shrink-0', available ? 'text-[#1B2A6B]' : 'text-gray-300')}
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm',
            available ? 'font-medium text-gray-800' : 'text-gray-300 line-through',
          )}
        >
          {name}
        </p>
        {validTill && available && (
          <p className="mt-0.5 text-xs text-gray-400">Valid till {validTill}</p>
        )}
      </div>
    </div>
  );
}

function validTillYear(date?: string): string | null {
  if (!date) return null;
  const match = date.match(/\d{4}/);
  return match ? match[0] : null;
}

function EnrolmentCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#F8F9FA] p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#1B2A6B]">{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

function EnrolmentRowDivider() {
  return <div className="my-3 border-t border-gray-200" />;
}

function OverviewMetricBar({
  label,
  value,
  max = 100,
  fillColor,
  showPercent = true,
}: {
  label: string;
  value: number;
  max?: number;
  fillColor: string;
  showPercent?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const display = showPercent ? `${value}%` : String(value);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-[#6B7280]">{label}</span>
        <span className="font-semibold text-[#111827]">{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}

function OutcomeMetricRow({
  name,
  pct,
  stateAvg,
}: {
  name: string;
  pct: number;
  stateAvg: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-700">{name}</span>
        <span className="font-semibold text-gray-900">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: NAVY }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>State Avg: {stateAvg}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-[#F5B731]" style={{ width: `${stateAvg}%` }} />
      </div>
    </div>
  );
}

function LearningOutcomeCard({
  lo,
}: {
  lo: SchoolProfileData['reportCard']['learningOutcomes'][number];
}) {
  const headerValue = lo.subjects[0]?.pct ?? 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-[#1B2A6B]">{lo.grade}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {lo.headerLabel}: <span className="font-semibold text-gray-900">{headerValue}%</span>
      </p>
      <div className="mt-4 space-y-4">
        {lo.subjects.map((s) => (
          <OutcomeMetricRow key={s.name} {...s} />
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ profile }: { profile: SchoolProfileData }) {
  const o = profile.overview;
  const level = profile.performanceLevel as PerformanceLevel;
  const waterAvailable = o.drinkingWater === 'Available';

  const infoBoxes = [
    { label: 'Accreditation', value: profile.accreditation, showLevel: true },
    { label: 'Recognition', value: profile.recognition, showLevel: false },
    { label: 'Board', value: profile.board, showLevel: false },
    { label: 'Classes', value: profile.classes, showLevel: false },
    { label: 'Type', value: profile.type, showLevel: false },
  ];

  const statCards = [
    { label: 'Total Students', value: o.totalStudents.toLocaleString('en-IN'), icon: Users },
    { label: 'Total Teachers', value: o.totalTeachers.toLocaleString('en-IN'), icon: GraduationCap },
    { label: 'Pupil-Teacher Ratio', value: o.pupilTeacherRatio, icon: Scale },
    { label: 'Total Classrooms', value: String(o.totalClassrooms), icon: Building2 },
    { label: 'Non-Teaching Staff', value: String(o.nonTeachingStaff), icon: UserCog },
    { label: 'Subject Teachers', value: String(o.subjectTeachers), icon: BookOpen },
    { label: 'Functional Toilets', value: String(o.functionalToilets), icon: Building2 },
    { label: 'Drinking Water', value: o.drinkingWater, icon: Droplets, isWater: true },
  ];

  return (
    <div className="space-y-10">
      {/* Header info row — boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {infoBoxes.map((b) => (
          <div key={b.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
              {b.label}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="font-bold text-[#111827]">{b.value}</p>
              {b.showLevel && <LevelBadge level={level} />}
            </div>
          </div>
        ))}
      </div>

      {/* Basic Information — 4×2 grid */}
      <section>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Basic Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((c) => {
            const Icon = c.icon;
            const isWater = c.isWater === true;
            if (isWater && waterAvailable) {
              return (
                <div
                  key={c.label}
                  className="relative rounded-xl bg-[#FEF9C3] p-5 shadow-sm"
                >
                  <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                    <Icon className="h-4 w-4 text-[#D97706]" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    {c.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#D97706]">Available</p>
                </div>
              );
            }
            return (
              <div
                key={c.label}
                className="relative rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <Icon className="h-4 w-4 text-gray-400" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {c.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#111827]">{c.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Enrolment and Attendance */}
      <section>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Enrolment and Attendance</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-[#1B2A6B]">Student Enrolment</h3>
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-3">
                <EnrolmentCell label="Primary" value={o.enrolment.primary} />
                <EnrolmentCell label="Upper Primary" value={o.enrolment.upperPrimary} />
              </div>
              <EnrolmentRowDivider />
              <div className="grid grid-cols-2 gap-3">
                <EnrolmentCell label="Secondary" value={o.enrolment.secondary} />
                <EnrolmentCell label="Higher Secondary" value={o.enrolment.higherSecondary} />
              </div>
              <EnrolmentRowDivider />
              <div className="grid grid-cols-2 gap-3">
                <EnrolmentCell label="Boys" value={o.enrolment.boys} />
                <EnrolmentCell label="Girls" value={o.enrolment.girls} />
              </div>
              <EnrolmentRowDivider />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <EnrolmentCell label="SC" value={o.enrolment.sc} />
                <EnrolmentCell label="ST" value={o.enrolment.st} />
                <EnrolmentCell label="OBC" value={o.enrolment.obc} />
                <EnrolmentCell label="General" value={o.enrolment.general} />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="pb-6">
              <h3 className="font-bold text-[#1B2A6B]">Dropout Rate by level</h3>
              <div className="mt-4 space-y-4">
                <OverviewMetricBar
                  label="Primary"
                  value={o.dropout.primary}
                  max={10}
                  fillColor="#F97316"
                />
                <OverviewMetricBar
                  label="Upper Primary"
                  value={o.dropout.upperPrimary}
                  max={10}
                  fillColor="#F97316"
                />
                <OverviewMetricBar
                  label="Secondary"
                  value={o.dropout.secondary}
                  max={10}
                  fillColor="#F97316"
                />
              </div>
            </div>
            <div className="py-6">
              <h3 className="font-bold text-[#1B2A6B]">Student Attendance Rate</h3>
              <div className="mt-4 space-y-4">
                <OverviewMetricBar
                  label="Primary"
                  value={o.studentAttendance.primary}
                  fillColor="#1B2A6B"
                />
                <OverviewMetricBar
                  label="Upper Primary"
                  value={o.studentAttendance.upperPrimary}
                  fillColor="#1B2A6B"
                />
                <OverviewMetricBar
                  label="Secondary"
                  value={o.studentAttendance.secondary}
                  fillColor="#1B2A6B"
                />
              </div>
            </div>
            <div className="pt-6">
              <h3 className="font-bold text-[#1B2A6B]">Teacher Attendance Rate</h3>
              <div className="mt-4 space-y-4">
                <OverviewMetricBar
                  label="Primary"
                  value={o.teacherAttendance.primary}
                  fillColor="#1B2A6B"
                />
                <OverviewMetricBar
                  label="Upper Primary"
                  value={o.teacherAttendance.upperPrimary}
                  fillColor="#1B2A6B"
                />
                <OverviewMetricBar
                  label="Secondary"
                  value={o.teacherAttendance.secondary}
                  fillColor="#1B2A6B"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure and Safety */}
      <section>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Infrastructure and Safety Measures</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(() => {
            const amenities: AmenityItem[] = [
              ...FACILITY_NAMES.map((name) => ({
                id: name,
                name,
                available: o.infrastructureTags.includes(name),
                icon: FACILITY_ICONS[name],
              })),
              {
                id: 'drinking-water',
                name: 'Drinking Water',
                available: o.drinkingWater === 'Available',
                icon: Droplets,
              },
              ...o.safetyChecks.map((item) => ({
                id: item.label,
                name: item.label,
                available: item.done,
                icon: safetyCheckIcon(item.label),
                validTill: validTillYear(item.date),
              })),
            ];
            return amenities.map((item) => <AmenityCard key={item.id} {...item} />);
          })()}
        </div>
      </section>

      {/* Learning Outcomes — only for grades this school actually has */}
      {profile.reportCard.learningOutcomes.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[#1B2A6B]">Learning Outcomes</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {profile.reportCard.learningOutcomes.map((lo) => (
              <LearningOutcomeCard key={lo.grade} lo={lo} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PerformanceTab({
  profile,
  compareMode,
  setCompareMode,
  compareAvg,
  diff,
  expandedDomains,
  setExpandedDomains,
}: {
  profile: SchoolProfileData;
  compareMode: 'state' | 'district';
  setCompareMode: (m: 'state' | 'district') => void;
  compareAvg: number;
  diff: number;
  expandedDomains: Record<string, boolean>;
  setExpandedDomains: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-5xl font-bold text-[#1B2A6B]">{profile.overallScore}</p>
            <p className="text-sm text-gray-500">out of 100</p>
          </div>
          <LevelBadge level={profile.performanceLevel} />
          <p className="max-w-xl text-sm text-gray-600">
            {levelDescription(profile.performanceLevel)}
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Score Comparison</h2>
        <div className="mt-3 flex gap-2">
          {(['state', 'district'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCompareMode(m)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium',
                compareMode === m
                  ? 'bg-[#1B2A6B] text-white'
                  : 'border border-gray-300 bg-white text-gray-700',
              )}
            >
              {m === 'state' ? 'vs State Average' : 'vs District Average'}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <CompareBars
            our={profile.overallScore}
            compare={compareAvg}
            top={profile.performance.topScore}
            compareLabel={compareMode === 'state' ? 'State Average' : 'District Average'}
          />
          <p className="mt-4 text-sm text-gray-600">
            Difference:{' '}
            <strong className={diff >= 0 ? 'text-green-700' : 'text-red-700'}>
              {diff >= 0 ? '+' : ''}
              {diff} points
            </strong>{' '}
            vs {compareMode === 'state' ? 'state' : 'district'} average
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Domain-wise Performance</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {profile.performance.domains.map((d) => {
            const open = expandedDomains[d.id];
            return (
              <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{d.name}</h3>
                    <p className="text-xs text-gray-500">Weightage {d.weightage}%</p>
                  </div>
                  <LevelBadge level={d.level} />
                </div>
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>Our School {d.ourScore}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${d.ourScore}%`, backgroundColor: NAVY }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>Top School {d.topScore}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#F5B731]"
                        style={{ width: `${d.topScore}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDomains((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                  }
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1B2A6B]"
                >
                  Show Sub-domains
                  {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {open && (
                  <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600">
                    {d.subDomains.map((s) => (
                      <li key={s.name} className="flex justify-between">
                        <span>{s.name}</span>
                        <span className="font-medium">{s.score}/100</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FeeTab({ profile }: { profile: SchoolProfileData }) {
  const f = profile.fees;
  const fields = [
    { label: 'Annual Tuition Fee', value: f.annualTuition },
    { label: 'Admission Fee', value: f.admissionFee },
    { label: 'Transport Fee', value: f.transportFee },
    { label: 'Other Charges', value: f.otherCharges },
    { label: 'Scholarships Available', value: f.scholarshipsAvailable },
    { label: 'Last Updated', value: f.lastUpdated },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Fee Disclosure</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{field.label}</p>
              <p className="mt-1 font-semibold text-gray-900">{field.value}</p>
            </div>
          ))}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-[#1B2A6B]">Scholarship Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {f.scholarships.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FEF3C7] px-4 py-2.5 text-sm font-medium text-[#92400E]"
            >
              <Check size={16} className="shrink-0" />
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportCardTab({ profile }: { profile: SchoolProfileData }) {
  const rc = profile.reportCard;
  const levelForDomain = (name: string): PerformanceLevel => {
    const match = rc.domainScores.find((s) => s.name === name);
    return match ? scoreToLevel(match.score) : profile.performanceLevel;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3 rounded-xl bg-[#FEF3C7] p-4">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" aria-hidden />
        <div>
          <p className="font-semibold text-[#92400E]">Self Evaluated</p>
          <p className="mt-0.5 text-sm text-[#92400E]/80">
            These results were submitted by the school and have not been independently verified
            by an external evaluator yet.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1B2A6B]">School Report Card</h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B2A6B] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 print:hidden"
        >
          <Download size={16} />
          Download PDF
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-4xl font-bold text-[#1B2A6B]">{profile.overallScore}/100</p>
        <div className="mt-2 flex justify-center">
          <LevelBadge level={profile.performanceLevel} />
        </div>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          {levelDescription(profile.performanceLevel)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-[#F5B731]">Top 3 Strengths</h3>
          <ul className="mt-3 space-y-3">
            {rc.strengths.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{name}</span>
                <LevelBadge level={levelForDomain(name)} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-[#1B2A6B]">3 Areas for Improvement</h3>
          <ul className="mt-3 space-y-3">
            {rc.improvements.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{name}</span>
                <LevelBadge level={levelForDomain(name)} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Domain Summary</h2>
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {rc.domainScores.map((d) => (
            <div key={d.name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-700">{d.name}</span>
                <span className="font-medium text-gray-900">{d.score}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#F5B731]"
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
