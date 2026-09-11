import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getVerifierAssignments } from '@/lib/actions/verification';
import { getAppealsOnMyInspections, type InspectionAppeal } from '@/lib/verification/inspectionAppeals';
import { brandHrefForRole } from '@/lib/appNavConfig';

const VERIFIER_PORTAL_ROLES = new Set(['VERIFIER', 'ONLINE_VERIFIER', 'ONGROUND_VERIFIER']);

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GOLD_DARK = '#7A5209';
const RED = '#96271E';
const GREEN = '#14603A';

/**
 * The portal's front door, by role.
 *
 * The old page served every verifier the legacy assignment table, which the new workforce
 * roles will never have rows in, so an online verifier with a full desk queue was greeted
 * with "No schools have been assigned to you". The first screen after login now reads the
 * queues that role actually works from and says where to start.
 */
export default async function VerifierHomePage() {
  const session = await auth();
  if (!session) redirect('/login?tab=verifier');
  const role = session.user.role as string;
  if (!VERIFIER_PORTAL_ROLES.has(role)) redirect(brandHrefForRole(role));

  if (role === 'VERIFIER') {
    return <LegacyVerifierDashboard userId={session.user.id!} userName={session.user.name ?? ''} />;
  }

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: session.user.id! },
    select: { id: true, cell: true, certification: true, deEmpanelledAt: true },
  });

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Welcome, {session.user.name}
        </h1>
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm text-gray-700">
          Your account has no verifier profile yet, so nothing can be assigned to you. Ask the
          SSSA PMU to provision it.
        </p>
      </div>
    );
  }

  return profile.cell === 'ONLINE' ? (
    <OnlineOverview profileId={profile.id} userName={session.user.name ?? ''} blocked={profile.certification !== 'CERTIFIED' || !!profile.deEmpanelledAt} />
  ) : (
    <FieldOverview profileId={profile.id} userName={session.user.name ?? ''} blocked={profile.certification !== 'CERTIFIED' || !!profile.deEmpanelledAt} />
  );
}

function Tile({
  value,
  label,
  detail,
  href,
  colour,
  wash = false,
}: {
  value: number | string;
  label: string;
  detail: string;
  href: string;
  colour: string;
  /** The gold-washed variant, for the one tile that is a moment rather than a count. */
  wash?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border-2 p-5 hover:border-gray-300"
      style={{
        borderColor: wash ? '#D0AD42' : '#E5E7EB',
        backgroundColor: wash ? '#FDF8EC' : 'white',
      }}
    >
      <p className="text-3xl font-bold" style={{ color: colour }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: NAVY_DEEP }}>
        {label}
      </p>
      <p className="mt-0.5 text-xs" style={{ color: INK_MUTED }}>
        {detail}
      </p>
    </Link>
  );
}

function BlockedBanner() {
  return (
    <p className="rounded-xl border-2 p-4 text-sm font-semibold" style={{ borderColor: RED, backgroundColor: '#FBE9E7', color: RED }}>
      Your certification is not active, so nothing new can be assigned to you. Existing work
      stays visible below.
    </p>
  );
}

async function OnlineOverview({
  profileId,
  userName,
  blocked,
}: {
  profileId: string;
  userName: string;
  blocked: boolean;
}) {
  const [deskOpen, escalated, walkthroughRuns, config] = await Promise.all([
    prisma.assessmentCycleRun.count({ where: { deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' } }),
    prisma.deskScreeningDecision.count({ where: { profileId, escalated: true } }),
    prisma.assessmentCycleRun.findMany({
      where: { deskAssigneeProfileId: profileId, state: 'VIDEO_WALKTHROUGH' },
      select: { enteredStateAt: true },
    }),
    prisma.programmeConfig.findUnique({ where: { id: 'current' }, select: { videoWalkthroughTurnaroundDays: true } }),
  ]);
  const turnaroundMs = (config?.videoWalkthroughTurnaroundDays ?? 7) * 86_400_000;
  const overdue = walkthroughRuns.filter((r) => r.enteredStateAt.getTime() + turnaroundMs < Date.now()).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Welcome, {userName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Online cell. Your batch is anonymous: you screen schools as masked codes, and identity
          is disclosed only inside a walkthrough, on the record.
        </p>
      </div>

      {blocked && <BlockedBanner />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          value={deskOpen}
          label="Desk screening queue"
          detail="Cases in your batch waiting for indicator decisions."
          href="/app/verifier/desk"
          colour={NAVY}
        />
        <Tile
          value={walkthroughRuns.length}
          label="Video walkthroughs"
          detail={overdue > 0 ? `${overdue} past the turnaround. Start with those.` : 'Flagged cases needing a live look.'}
          href="/app/verifier/walkthroughs"
          colour={overdue > 0 ? RED : NAVY}
        />
        <Tile
          value={escalated}
          label="Frozen by escalation"
          detail="Indicators you sent up. A supervisor rules and unfreezes them."
          href="/app/verifier/desk"
          colour={escalated > 0 ? GOLD_DARK : GREEN}
        />
      </div>

      <p className="text-sm" style={{ color: INK_MUTED }}>
        Start in{' '}
        <Link href="/app/verifier/desk" className="font-bold underline" style={{ color: NAVY }}>
          Desk Screening
        </Link>
        {overdue > 0 && (
          <>
            {' '}
            or clear the overdue{' '}
            <Link href="/app/verifier/walkthroughs" className="font-bold underline" style={{ color: RED }}>
              walkthroughs
            </Link>
          </>
        )}
        .
      </p>
    </div>
  );
}

async function FieldOverview({
  profileId,
  userName,
  blocked,
}: {
  profileId: string;
  userName: string;
  blocked: boolean;
}) {
  const [visits, appeals, activeCycle, districtRows] = await Promise.all([
    prisma.fieldVisit.findMany({
      where: { profileId, recusedAt: null },
      select: { id: true, districtCode: true, revealAt: true, arrivedAt: true, signedOffAt: true },
    }),
    getAppealsOnMyInspections(profileId),
    prisma.cycle.findFirst({ where: { isActive: true }, select: { name: true } }),
    prisma.district.findMany({ select: { code: true, nameEn: true } }),
  ]);
  const districtNameBy = new Map(districtRows.map((d) => [d.code, d.nameEn]));
  const now = Date.now();

  // The four working states, mutually exclusive; "pending" groups the two not-begun ones.
  const doneCount = visits.filter((v) => v.signedOffAt !== null).length;
  const inProgress = visits.filter((v) => !v.signedOffAt && v.arrivedAt !== null);
  const ready = visits.filter(
    (v) => !v.signedOffAt && !v.arrivedAt && v.revealAt.getTime() <= now,
  );
  const sealed = visits.filter(
    (v) => !v.signedOffAt && !v.arrivedAt && v.revealAt.getTime() > now,
  );
  const pendingCount = ready.length + sealed.length;

  const nextSealed = sealed.length
    ? sealed.reduce((min, v) => (v.revealAt < min.revealAt ? v : min))
    : null;
  const waitingAppeals = appeals.filter((a) => a.status === 'SUBMITTED').length;

  // Per-district tallies for the ledger. A district row says what is left there, not just a count.
  const byDistrict = new Map<string, DistrictTally>();
  for (const v of visits) {
    const tally =
      byDistrict.get(v.districtCode) ??
      ({
        name: districtNameBy.get(v.districtCode) ?? v.districtCode,
        total: 0,
        done: 0,
        inProgress: 0,
        ready: 0,
        sealedAt: [],
      } satisfies DistrictTally);
    tally.total += 1;
    if (v.signedOffAt) tally.done += 1;
    else if (v.arrivedAt) tally.inProgress += 1;
    else if (v.revealAt.getTime() <= now) tally.ready += 1;
    else tally.sealedAt.push(v.revealAt);
    byDistrict.set(v.districtCode, tally);
  }
  // Districts with live work first: mid-visit, then ready, then sealed, then finished.
  const tallyWeight = (t: DistrictTally) =>
    t.inProgress > 0 ? 0 : t.ready > 0 ? 1 : t.sealedAt.length > 0 ? 2 : 3;
  const ledger = [...byDistrict.values()].sort(
    (a, b) => tallyWeight(a) - tallyWeight(b) || b.total - a.total || a.name.localeCompare(b.name),
  );

  // The one case where a tile can be a door to the exact room: a single visit under way.
  const inProgressHref =
    inProgress.length === 1 ? `/app/verifier/visit/${inProgress[0]!.id}` : '/app/verifier/assignments';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Welcome, {userName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Field cell
          {activeCycle ? ` · ${activeCycle.name} cycle` : ''}
          {ledger.length > 0
            ? ` · ${ledger.length} ${ledger.length === 1 ? 'district' : 'districts'}`
            : ''}
        </p>
      </div>

      {blocked && <BlockedBanner />}

      {/* Six tiles, each a door: the five numbers SSSA asked to track, plus the next unlock. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          value={visits.length}
          label="Assigned"
          detail={`This cycle, ${ledger.length} ${ledger.length === 1 ? 'district' : 'districts'}`}
          href="/app/verifier/assignments"
          colour={NAVY_DEEP}
        />
        <Tile
          value={pendingCount}
          label="Pending"
          detail="Sealed or not begun"
          href="/app/verifier/assignments"
          colour={pendingCount > 0 ? GOLD_DARK : INK_MUTED}
        />
        <Tile
          value={inProgress.length}
          label="In progress"
          detail="Arrived, not signed off"
          href={inProgressHref}
          colour={inProgress.length > 0 ? GOLD : INK_MUTED}
        />
        <Tile
          value={doneCount}
          label="Done"
          detail="Signed off"
          href="/app/verifier/assignments"
          colour={GREEN}
        />
        <Tile
          value={appeals.length}
          label="Appeals"
          detail={
            waitingAppeals > 0
              ? `${waitingAppeals} waiting on SSSA`
              : appeals.length > 0
                ? 'All decided'
                : 'None on your inspections'
          }
          href="#appeals"
          colour={waitingAppeals > 0 ? RED : INK_MUTED}
        />
        <Tile
          value={nextSealed ? istTime(nextSealed.revealAt) : 'None'}
          label="Next unlock"
          detail={
            nextSealed
              ? `${capitalise(unlockDayPhrase(nextSealed.revealAt))}, ${districtNameBy.get(nextSealed.districtCode) ?? nextSealed.districtCode}`
              : 'No sealed assignments right now'
          }
          href="/app/verifier/assignments"
          colour={GOLD_DARK}
          wash
        />
      </div>

      {ledger.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
            Your districts
          </h2>
          {ledger.map((district) => (
            <Link
              key={district.name}
              href="/app/verifier/assignments"
              className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 hover:border-gray-300"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold" style={{ color: NAVY_DEEP }}>
                  {district.name}
                </span>
                <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
                  {districtLine(district)}
                </span>
              </span>
              <span className="flex-none text-sm font-bold" style={{ color: NAVY_DEEP }}>
                {district.total.toLocaleString('en-IN')} {district.total === 1 ? 'school' : 'schools'}
              </span>
              <span aria-hidden className="flex-none text-lg font-bold" style={{ color: INK_MUTED }}>
                ›
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Appeals exist only after a visit: a school contests a published result, never an
          inspection in progress and never the desk screening it has not seen. Read-only here,
          because appeals are the SSSA's to decide; the verifier is shown the outcome for the
          record. Rendered only when there is something to show. */}
      {appeals.length > 0 && (
        <section id="appeals" className="space-y-3">
          <div>
            <h2 className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
              Appeals on your inspections
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: INK_MUTED }}>
              Schools can contest a published result after your visit. The SSSA decides these, not
              you; they are shown here so you know how your calls stood up.
            </p>
          </div>
          {appeals.map((appeal) => (
            <InspectionAppealCard key={`${appeal.schoolUdise}:${appeal.filedOn}`} appeal={appeal} />
          ))}
        </section>
      )}

    </div>
  );
}

const IST = 'Asia/Kolkata';

const istTime = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST });

/** Calendar-day difference in IST, so "tomorrow" flips at midnight in India, not in UTC. */
function istDaysUntil(d: Date) {
  const istDay = (t: number) => Math.floor((t + 5.5 * 3_600_000) / 86_400_000);
  return istDay(d.getTime()) - istDay(Date.now());
}

function unlockDayPhrase(d: Date): string {
  const days = istDaysUntil(d);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type DistrictTally = {
  name: string;
  total: number;
  done: number;
  inProgress: number;
  ready: number;
  sealedAt: Date[];
};

/** The ledger row's second line: what is left in this district, in working order. */
function districtLine(t: DistrictTally): string {
  if (t.done === t.total) return t.total === 1 ? 'Done' : `All ${t.total} done`;
  const parts: string[] = [];
  if (t.done > 0) parts.push(`${t.done} done`);
  if (t.inProgress > 0) parts.push(`${t.inProgress} mid-visit`);
  if (t.ready > 0) parts.push(`${t.ready} ready to begin`);
  if (t.sealedAt.length > 0) {
    const earliest = t.sealedAt.reduce((min, d) => (d < min ? d : min));
    parts.push(
      `${t.sealedAt.length} sealed, information unlocks ${unlockDayPhrase(earliest)}`,
    );
  }
  return parts.join(' · ');
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function InspectionAppealCard({ appeal }: { appeal: InspectionAppeal }) {
  const pending = appeal.status === 'SUBMITTED';
  const chip = pending
    ? { label: 'Waiting on SSSA', colour: RED }
    : appeal.revisedCount === 0
      ? { label: 'Upheld as you found it', colour: GREEN }
      : appeal.keptCount === 0
        ? { label: 'Revised to the school’s levels', colour: RED }
        : { label: 'Partly revised', colour: GOLD_DARK };

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4" style={{ borderLeft: `4px solid ${chip.colour}` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            {appeal.schoolName}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: INK_MUTED }}>
            Inspected {shortDate(appeal.inspectedOn)} · appeal filed {shortDate(appeal.filedOn)}
            {appeal.decidedOn && <> · decided {shortDate(appeal.decidedOn)}</>}
            {' · '}
            {appeal.items.length} {appeal.items.length === 1 ? 'indicator' : 'indicators'} contested
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: chip.colour }}>
          {chip.label}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {appeal.items.map((item) => (
          <li key={item.code} className="text-sm">
            <span className="font-mono text-xs font-bold" style={{ color: GOLD_DARK }}>
              {item.code}
            </span>{' '}
            <span className="text-gray-800">{item.titleEn}</span>
            {!pending && (
              <span
                className="ml-1 font-semibold"
                style={{ color: item.decision === 'KEEP_VERIFIER' ? GREEN : item.decision === 'ACCEPT_SCHOOL' ? RED : INK_MUTED }}
              >
                {item.decision === 'KEEP_VERIFIER'
                  ? '· upheld as you found it'
                  : item.decision === 'ACCEPT_SCHOOL'
                    ? '· revised to the school’s level'
                    : '· not yet ruled'}
              </span>
            )}
          </li>
        ))}
      </ul>

      {pending && (
        <p className="mt-2 text-xs" style={{ color: INK_MUTED }}>
          Nothing is needed from you. The SSSA rules on the school&apos;s justification and your
          recorded findings, including your notes and photographs.
        </p>
      )}
    </div>
  );
}

async function LegacyVerifierDashboard({ userId, userName }: { userId: string; userName: string }) {
  const t = await getTranslations('verifierDashboard');
  const { assignments, cycleName } = await getVerifierAssignments(userId);

  const submitted = assignments.filter((a) => a.submission?.status === 'SUBMITTED').length;
  const inProgress = assignments.filter((a) => a.submission?.startedAt && a.submission.status !== 'SUBMITTED').length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-text-secondary">{t('welcome', { username: userName })}</p>

      {!cycleName ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{t('noCycle')}</div>
      ) : (
        <>
          <p className="mt-4 text-sm text-text-secondary">
            {t('cycle')}: <span className="font-semibold text-navy-900">{cycleName}</span>
            {' · '}
            {t('assignedCount', { count: assignments.length })}
            {' · '}
            <span className="text-green-600">{submitted} {t('submitted')}</span>
            {inProgress > 0 && <>{' · '}<span className="text-amber-600">{inProgress} {t('inProgress')}</span></>}
          </p>

          {assignments.length === 0 ? (
            <div className="mt-6 rounded-lg border border-border bg-white p-6 text-center text-text-secondary">
              {t('noAssignments')}
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-text-secondary">
                    <th className="px-3 py-2.5">{t('colSchool')}</th>
                    <th className="px-3 py-2.5">{t('colUdise')}</th>
                    <th className="px-3 py-2.5">{t('colDistrict')}</th>
                    <th className="px-3 py-2.5">{t('colCategory')}</th>
                    <th className="px-3 py-2.5">{t('colDeadline')}</th>
                    <th className="px-3 py-2.5">{t('colStatus')}</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const status = a.submission?.status === 'SUBMITTED' ? 'submitted'
                      : a.submission?.startedAt ? 'draft' : 'not_started';
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                        <td className="px-3 py-2.5">
                          <div className="text-xs font-medium text-navy-900">{a.school.nameHi}</div>
                          <div className="text-[11px] text-text-secondary">{a.school.nameEn}</div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{a.school.udise}</td>
                        <td className="px-3 py-2.5 text-xs">{a.school.districtCode}</td>
                        <td className="px-3 py-2.5 text-xs">{a.school.category}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {a.deadlineAt ? new Date(a.deadlineAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            status === 'submitted' ? 'bg-green-100 text-green-700'
                            : status === 'draft' ? 'bg-amber-100 text-amber-700'
                            : 'bg-surface text-text-secondary'
                          }`}>
                            {status === 'submitted' ? <CheckCircle2 size={12} />
                              : status === 'draft' ? <Clock size={12} /> : <Circle size={12} />}
                            {status === 'submitted' ? t('statusSubmitted')
                              : status === 'draft' ? t('statusDraft') : t('statusNotStarted')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/app/verifier/assessments/${a.school.udise}`}
                            className="rounded-md bg-navy-700 px-3 py-1 text-xs font-medium text-white hover:bg-navy-800"
                          >
                            {status === 'submitted' ? t('view') : t('assess')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
