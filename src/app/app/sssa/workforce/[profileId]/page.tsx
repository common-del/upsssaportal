import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/authz';
import { buildWorkforceProfile, type ProfileSample } from '@/lib/sssa/workforceProfile';
import { getQualitySample } from '@/lib/actions/supervisor';
import { RemovalCaseForm } from '@/components/sssa/RemovalCaseForm';
import { QualitySampler } from '@/components/supervisor/QualitySampler';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GOLD_INK = '#7A5209';
const GREEN = '#1E6344';
const RED = '#96271E';

/**
 * One verifier.
 *
 * The page Quality Sample and De-empanelment folded into. Both used to be whole-roster tabs
 * answering a question about one person, which meant arriving already knowing whose record you
 * wanted and then hunting for them. Here the sampled work and the removal record sit under the
 * caseload they are judgements about, and the removal button sits under the numbers that
 * justify it, which is the one thing the old board got exactly right.
 */

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

function formatDate(iso: string | null) {
  if (!iso) return 'not set';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-[13.5px] font-semibold text-gray-900">{value}</span>
    </span>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ backgroundColor: NAVY }}>
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {note && <span className="text-xs text-white/80">{note}</span>}
    </div>
  );
}

const TONE: Record<string, string> = {
  CLEAN: GREEN,
  CORRECTED: GOLD_INK,
  STOOD_DOWN: RED,
  OPEN: '#8A97AC',
};

/** All three verdicts a reviewer can give. Coaching is its own colour because it is neither a
 *  clean record nor a mark against somebody, and showing it as either would misreport it. */
const VERDICT_LABEL: Record<ProfileSample['verdict'], string> = {
  SATISFACTORY: 'Satisfactory',
  COACHING_NEEDED: 'Coaching needed',
  FLAGGED: 'Flagged',
};

const VERDICT_STYLE: Record<ProfileSample['verdict'], { backgroundColor: string; color: string }> = {
  SATISFACTORY: { backgroundColor: '#E3F0E8', color: GREEN },
  COACHING_NEEDED: { backgroundColor: '#FDF8EC', color: GOLD_INK },
  FLAGGED: { backgroundColor: '#FBE9E7', color: RED },
};

export default async function VerifierProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const actor = await requireRole('SUPERVISOR', 'SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const { profileId } = await params;
  const p = await buildWorkforceProfile(profileId);
  if (!p) notFound();

  // The weekly draw is unchanged and still made across everybody; this page shows the part of it
  // that belongs to the person you are reading, which is usually none of it.
  const thisWeek = (await getQualitySample()).filter((c) => c.subjectProfileId === profileId);

  const removed = p.deEmpanelledAt !== null;
  const certified = p.certification === 'CERTIFIED';

  return (
    <div className="space-y-5">
      <Link href="/app/sssa/workforce" className="text-[13px] font-semibold underline" style={{ color: NAVY }}>
        ‹ All verifiers
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={
                p.cell === 'FIELD'
                  ? { backgroundColor: '#FDF3DC', color: GOLD_INK }
                  : { backgroundColor: '#E9EDF4', color: '#3C4A61' }
              }
            >
              {p.cell === 'FIELD' ? 'Field' : 'Desk'}
            </span>
            {removed ? (
              <span className="rounded-full bg-[#FBE9E7] px-2.5 py-1 text-[11px] font-bold" style={{ color: RED }}>
                Removed {formatDate(p.deEmpanelledAt)}
              </span>
            ) : certified ? (
              <span className="rounded-full bg-[#E3F0E8] px-2.5 py-1 text-[11px] font-bold" style={{ color: GREEN }}>
                Certified to {formatDate(p.certificationExpiresAt)}
              </span>
            ) : (
              <span className="rounded-full bg-[#FDF8EC] px-2.5 py-1 text-[11px] font-bold" style={{ color: GOLD_INK }}>
                {p.certification.replaceAll('_', ' ').toLowerCase()}
              </span>
            )}
            <span className="text-[12.5px]" style={{ color: '#8A97AC' }}>
              Shown to schools as {p.pseudonym}
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
            {p.name}
          </h1>
        </div>

        {/* Only offered for empanelled staff. Salaried VSK analysts are not empanelled, so there
            is no empanelment to end and the rules do not apply to them. */}
        {!removed && p.removal !== null && (
          <RemovalCaseForm profileId={p.profileId} name={p.name} recommended={p.removal.recommended} />
        )}
      </div>

      {removed && p.deEmpanelledReason && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#F3CFCB', backgroundColor: '#FBE9E7' }}>
          <p className="text-sm font-bold" style={{ color: RED }}>
            Grounds recorded at removal
          </p>
          <p className="mt-1 text-sm" style={{ color: '#7A2F27' }}>
            {p.deEmpanelledReason}
          </p>
        </div>
      )}

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Username" value={p.username} />
        <Detail label="Source" value={p.workforceSource === 'EMPANELLED' ? 'Empanelled' : 'VSK staff'} />
        <Detail label="Supervisor" value={p.supervisorName ?? 'none set'} />
        <Detail label="Districts" value={p.districts.length === 0 ? 'Statewide' : p.districts.join(', ')} />
        <Detail label="Certified on" value={formatDate(p.certifiedAt)} />
        <Detail label="Certification expires" value={formatDate(p.certificationExpiresAt)} />
        <Detail
          label="Standing exclusions"
          value={p.exclusionCount === 0 ? 'none' : `${p.exclusionCount}`}
        />
        <Detail label="On the roster since" value={formatDate(p.onRosterSince)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <SectionHead title="Their work" />
        <div className="flex flex-wrap gap-8 border-b border-gray-100 px-5 py-4">
          {[
            { v: formatIN(p.work.open), l: p.cell === 'FIELD' ? 'Visits assigned and open' : 'Desk cases open' },
            { v: formatIN(p.work.completed), l: p.cell === 'FIELD' ? 'Visits signed off' : 'Desk cases routed on' },
            {
              v: p.work.avgDays === null ? 'n/a' : p.work.avgDays.toFixed(1),
              l: p.cell === 'FIELD' ? 'Average days to sign off' : 'Average days, on the roster',
            },
            { v: formatIN(p.work.qualityFlags), l: 'Quality flags' },
          ].map((s) => (
            <span key={s.l} className="flex flex-col gap-0.5">
              <span className="text-[23px] font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                {s.v}
              </span>
              <span className="text-[12.5px]" style={{ color: INK_MUTED }}>
                {s.l}
              </span>
            </span>
          ))}
        </div>
        {p.recent.length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: INK_MUTED }}>
            {p.cell === 'FIELD'
              ? 'No visits on the record yet.'
              : 'Desk cases are counted above. The case list belongs to the desk queue rather than to this page.'}
          </p>
        ) : (
          <div className="px-5 pb-2 pt-1">
            {p.recent.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-4 border-b border-gray-100 py-2.5 last:border-b-0">
                <span className="w-20 shrink-0 text-[12.5px]" style={{ color: '#8A97AC' }}>
                  {c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <span className="min-w-0 grow text-[13.5px] font-semibold text-gray-900">{c.schoolName}</span>
                <span className="w-44 shrink-0 text-[12.5px]" style={{ color: INK_MUTED }}>
                  {c.place}
                </span>
                <span className="w-48 shrink-0 text-right text-[12.5px] font-semibold" style={{ color: TONE[c.tone] }}>
                  {c.outcome}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <SectionHead title="Sampled for review" note="Drawn on the server, redrawn every Monday" />

        {/* This week's draw, if any of it is theirs. The whole loop lives here now: read the
            reasoning, leave a note, record a verdict. Without it the section below could never
            fill and the flag count could never move. */}
        {thisWeek.length > 0 && (
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-3 text-[12.5px] font-semibold" style={{ color: NAVY_DEEP }}>
              In this week&apos;s sample, waiting to be read
            </p>
            <QualitySampler items={thisWeek} />
          </div>
        )}

        {p.samples.length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: INK_MUTED }}>
            {thisWeek.length > 0
              ? 'Nothing of theirs has been read before this week.'
              : 'None of their work has been read, and none of it is in this week’s draw. The sample is fixed on the server, so a verifier cannot predict which of their cases will come up.'}
          </p>
        ) : (
          <div className="px-5 pb-2 pt-1">
            {p.samples.map((s) => (
              <div key={s.runId} className="flex flex-wrap items-center gap-4 border-b border-gray-100 py-3 last:border-b-0">
                <span className="w-20 shrink-0 text-[12.5px]" style={{ color: '#8A97AC' }}>
                  {s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <span className="min-w-0 grow space-y-0.5">
                  <span className="block text-[13.5px] font-semibold text-gray-900">{s.schoolName}</span>
                  <span className="block text-[12.5px] leading-snug" style={{ color: INK_MUTED }}>
                    {s.note}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                  style={VERDICT_STYLE[s.verdict]}
                >
                  {VERDICT_LABEL[s.verdict]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {p.removal === null ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">The removal rules do not apply here</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK_MUTED }}>
            They govern empanelled verifiers. {p.name} is VSK staff, so there is no empanelment to
            end, and their conduct is an employment matter rather than one for this screen.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <SectionHead title="Standing against the removal rules" />
          <div className="px-5 pt-3">
            {[
              {
                name: 'Contradiction rate',
                reading:
                  p.removal.contradictionRatePct === null
                    ? `nothing audited yet, of ${p.removal.rateRule.thresholdPct}%`
                    : `${p.removal.contradictionRatePct.toFixed(1)}% of ${p.removal.rateRule.thresholdPct}%`,
                pct:
                  p.removal.contradictionRatePct === null
                    ? 0
                    : Math.min(100, (p.removal.contradictionRatePct / p.removal.rateRule.thresholdPct) * 100),
                triggered: p.removal.rateRule.triggered,
                detail: p.removal.floorMet
                  ? `${formatIN(p.removal.contradictedCount)} contradicted findings across ${formatIN(p.removal.auditedCount)} reconciled audits. The rate counts once ${formatIN(p.removal.rateRule.minimumCases)} audits are on the record, and ${formatIN(p.removal.auditedCount)} are.`
                  : `${formatIN(p.removal.auditedCount)} reconciled audits, below the floor of ${formatIN(p.removal.rateRule.minimumCases)}. The rate is not read until the floor is met, because a small sample makes any rate look extreme.`,
              },
              {
                name: 'Contradictions in a rolling 12 months',
                reading: `${formatIN(p.removal.rolling12MonthCount)} of ${formatIN(p.removal.countRule.threshold)}`,
                pct: Math.min(100, (p.removal.rolling12MonthCount / p.removal.countRule.threshold) * 100),
                triggered: p.removal.countRule.triggered,
                detail:
                  'Counted outright rather than as a share, so a small caseload cannot hide a pattern.',
              },
            ].map((rule) => (
              <div key={rule.name} className="border-b border-gray-100 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-gray-900">{rule.name}</span>
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: rule.triggered ? RED : rule.pct > 60 ? GOLD : NAVY }}
                  >
                    {rule.reading}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: '#EDF1F7' }}>
                  <span
                    className="block h-2.5 rounded-full"
                    style={{
                      backgroundColor: rule.triggered ? RED : rule.pct > 60 ? GOLD : NAVY,
                      width: `${Math.max(2, Math.round(rule.pct))}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: INK_MUTED }}>
                  {rule.detail}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-gray-100 bg-[#F7F9FC] px-5 py-3 text-[12.5px] leading-relaxed" style={{ color: INK_MUTED }}>
            Only reconciled audits count towards either rule, and no removal happens automatically:
            crossing a line puts the case in front of a person, and a person confirms it.
          </p>
        </section>
      )}
    </div>
  );
}
