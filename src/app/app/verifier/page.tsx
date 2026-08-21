import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getVerifierAssignments } from '@/lib/actions/verification';
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
}: {
  value: number;
  label: string;
  detail: string;
  href: string;
  colour: string;
}) {
  return (
    <Link href={href} className="block rounded-xl border-2 bg-white p-5 hover:border-gray-300" style={{ borderColor: '#E5E7EB' }}>
      <p className="text-3xl font-bold" style={{ color: colour }}>
        {value.toLocaleString('en-IN')}
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
  const visits = await prisma.fieldVisit.findMany({
    where: { profileId, recusedAt: null },
    select: { revealAt: true, signedOffAt: true },
  });
  const now = Date.now();
  const open = visits.filter((v) => !v.signedOffAt);
  const revealed = open.filter((v) => v.revealAt.getTime() <= now).length;
  const sealed = open.filter((v) => v.revealAt.getTime() > now);
  const nextReveal = sealed.length
    ? sealed.reduce((min, v) => (v.revealAt < min ? v.revealAt : min), sealed[0]!.revealAt)
    : null;
  const signedOff = visits.length - open.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Welcome, {userName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Field cell. You are told the district and travel window in advance; the school itself
          unlocks at 7 in the morning on the day of the inspection.
        </p>
      </div>

      {blocked && <BlockedBanner />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          value={revealed}
          label="Ready to visit"
          detail="Revealed and waiting. Open the card, declare conflicts, and begin."
          href="/app/verifier/assignments"
          colour={revealed > 0 ? GOLD : INK_MUTED}
        />
        <Tile
          value={sealed.length}
          label="Sealed assignments"
          detail={
            nextReveal
              ? `Next unlocks ${nextReveal.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at 07:00.`
              : 'District and travel window only, until reveal day.'
          }
          href="/app/verifier/assignments"
          colour={NAVY}
        />
        <Tile
          value={signedOff}
          label="Signed off"
          detail="Completed visits on your record."
          href="/app/verifier/assignments"
          colour={GREEN}
        />
      </div>

      <p className="text-sm" style={{ color: INK_MUTED }}>
        Everything happens in{' '}
        <Link href="/app/verifier/assignments" className="font-bold underline" style={{ color: GOLD_DARK }}>
          Field Assignments
        </Link>
        . The visit workspace works offline once a visit is open; photographs need signal.
      </p>
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
