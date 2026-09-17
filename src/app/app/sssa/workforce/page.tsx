import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/authz';
import { getSupervisorOverview, getDeEmpanelmentCases } from '@/lib/actions/supervisor';
import { getStrandedSchools } from '@/lib/actions/reallocation';
import { previewCohort } from '@/lib/actions/cohort';
import {
  buildWorkforceKpis,
  districtsByProfile,
  filterWorkforce,
  sortWorkforce,
  statusOf,
  type WorkforceFilterValues,
  type WorkforceRow,
} from '@/lib/sssa/workforce';
import { WorkforceFilters } from '@/components/sssa/WorkforceFilters';
import { StrandedSchools } from '@/components/sssa/StrandedSchools';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD_INK = '#7A5209';
const RED = '#96271E';

/**
 * Workforce: how verification is going, and who is doing it.
 *
 * One screen where there were four. Quality Sample and De-empanelment were whole-roster tabs
 * answering a question about one person, so you arrived already knowing whose record you wanted;
 * both are sections of that person's page now, reached from this table, and what they gave the
 * roster view survives as two columns. The verification year went too, and the parts of it that
 * were doing work came here: the draw is the assign button, because assigning schools to field
 * verifiers is what the draw does, and the schools nobody is going to are the list below it,
 * because a school with no verifier is a staffing problem.
 */

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

function Kpi({ value, label, note, tone }: { value: string; label: string; note: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
      <p className="text-[27px] font-bold tabular-nums tracking-tight" style={{ color: tone ?? NAVY_DEEP }}>
        {value}
      </p>
      <p className="text-[12.5px] font-semibold text-gray-900">{label}</p>
      <p className="mt-0.5 text-xs leading-snug" style={{ color: '#7C8899' }}>
        {note}
      </p>
    </div>
  );
}

export default async function WorkforcePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole('SUPERVISOR', 'SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const isAdmin = actor.role === 'SSSA_ADMIN';

  const overview = await getSupervisorOverview();
  if (!overview) return <p className="text-sm text-gray-600">Not authorised.</p>;

  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const selected: WorkforceFilterValues = {
    q: one('q'),
    cell: one('cell'),
    district: one('district'),
    status: one('status'),
  };

  const profileIds = overview.roster.map((r) => r.profileId);
  const [kpis, { byProfile, rostered }, removalCases, stranded, cohort] = await Promise.all([
    buildWorkforceKpis(overview.roster),
    districtsByProfile(profileIds),
    getDeEmpanelmentCases(),
    getStrandedSchools(),
    previewCohort(),
  ]);

  const recommendedBy = new Map(removalCases.map((c) => [c.profileId, c.evaluation.recommended]));

  const rows: WorkforceRow[] = overview.roster.map((r) => ({
    ...r,
    districts: byProfile.get(r.profileId) ?? [],
    removalRecommended: recommendedBy.get(r.profileId) ?? null,
  }));
  const shown = sortWorkforce(filterWorkforce(rows, selected));

  const waiting = kpis.waitingDesk + kpis.waitingField;
  const turnaround =
    kpis.avgDeskDays === null && kpis.avgFieldDays === null
      ? null
      : ((kpis.avgDeskDays ?? 0) + (kpis.avgFieldDays ?? 0)) /
        [kpis.avgDeskDays, kpis.avgFieldDays].filter((d) => d !== null).length;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Workforce
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: '#3C4A61' }}>
          Who is doing the verification, how much each is carrying, and how the year is going.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          value={formatIN(kpis.verified)}
          label="Schools verified"
          note={kpis.intake === 0 ? 'no cycle is open' : `of ${formatIN(kpis.intake)} in this year's intake`}
        />
        <Kpi
          value={formatIN(waiting)}
          label="Waiting for a verifier"
          note={`${formatIN(kpis.waitingDesk)} at the desk, ${formatIN(kpis.waitingField)} in the field`}
          tone={waiting > 0 ? GOLD_INK : undefined}
        />
        <Kpi
          value={turnaround === null ? 'n/a' : turnaround.toFixed(1)}
          label="Average days to turn a case round"
          note={
            turnaround === null
              ? 'nothing finished yet'
              : `desk ${kpis.avgDeskDays === null ? 'n/a' : kpis.avgDeskDays.toFixed(1)}, field ${kpis.avgFieldDays === null ? 'n/a' : kpis.avgFieldDays.toFixed(1)}`
          }
        />
        <Kpi
          value={formatIN(kpis.working)}
          label="Verifiers working"
          note={`of ${formatIN(kpis.onRoster)}, the rest uncertified or removed`}
        />
      </section>

      {/* The draw, as the thing it actually is from here: putting schools on verifiers. Only the
          Authority may run it, and only the Authority is shown it: previewCohort returns nothing
          to a supervisor, and a panel reading "nothing is waiting" off that would be a lie about
          the queue rather than a statement about their permissions. */}
      {isAdmin && (
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="min-w-[320px] grow space-y-1">
            <p className="text-base font-bold" style={{ color: NAVY_DEEP }}>
              Assign schools to field verifiers
            </p>
            <p className="text-[13.5px] leading-relaxed" style={{ color: '#3C4A61' }}>
              {cohort && cohort.size > 0
                ? `${formatIN(cohort.candidateCount)} schools are waiting on a visit decision. Assigning draws this year's inspection list and hands each school to a certified field verifier who works that district. The school's name stays sealed until the morning of the visit.`
                : 'Every school in this year’s queue already has a visit or a published result. Nothing is waiting to be assigned.'}
            </p>
          </div>
          <Link
            href="/app/sssa/cohort"
            className="inline-flex min-h-[46px] shrink-0 items-center rounded-lg px-6 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Assign schools
          </Link>
        </div>
        {cohort?.drawn && (
          <p className="border-t border-gray-100 bg-[#F7F9FC] px-5 py-3 text-[12.5px]" style={{ color: INK_MUTED }}>
            Last run {new Date(cohort.drawn.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {cohort.drawn.byName ? ` by ${cohort.drawn.byName}` : ''}: {formatIN(cohort.drawn.selectedCount)} schools
            assigned
            {cohort.drawn.unassignedCount > 0
              ? `, ${formatIN(cohort.drawn.unassignedCount)} left unplaced.`
              : '.'}
          </p>
        )}
      </section>
      )}

      {/* Only present when there is something to do. An empty exception list on screen every day
          teaches people to stop looking at it. */}
      {stranded.length > 0 && <StrandedSchools rows={stranded} />}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <WorkforceFilters
          selected={selected}
          districts={rostered}
          total={rows.length}
          matched={shown.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[10px] uppercase tracking-wider" style={{ color: '#8A97AC' }}>
                <th className="px-5 py-2.5 font-bold">Verifier</th>
                <th className="px-3 py-2.5 font-bold">Type</th>
                <th className="px-3 py-2.5 font-bold">District</th>
                <th className="px-3 py-2.5 text-right font-bold">Assigned</th>
                <th className="px-3 py-2.5 text-right font-bold">Completed</th>
                <th className="px-3 py-2.5 text-right font-bold">Avg days</th>
                <th className="px-5 py-2.5 text-right font-bold">Flags</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-sm" style={{ color: INK_MUTED }}>
                    No verifier matches these filters.
                  </td>
                </tr>
              )}
              {shown.map((r) => {
                const status = statusOf(r);
                const field = r.cell === 'FIELD';
                return (
                  <tr key={r.profileId} className="border-t border-gray-100 hover:bg-[#FAFBFD]">
                    <td className="px-5 py-3">
                      <Link href={`/app/sssa/workforce/${r.profileId}`} className="block">
                        <span className="block text-sm font-semibold text-gray-900 underline">{r.name}</span>
                        <span
                          className="block text-[11.5px]"
                          style={{
                            color:
                              status === 'DE_EMPANELLED'
                                ? RED
                                : status === 'NOT_CERTIFIED'
                                  ? GOLD_INK
                                  : r.removalRecommended
                                    ? RED
                                    : '#8A97AC',
                          }}
                        >
                          {status === 'DE_EMPANELLED'
                            ? `Removed ${r.deEmpanelledAt ? new Date(r.deEmpanelledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}`
                            : status === 'NOT_CERTIFIED'
                              ? 'Awaiting certification'
                              : r.removalRecommended
                                ? 'Removal recommended'
                                : 'Certified'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={
                          field
                            ? { backgroundColor: '#FDF3DC', color: GOLD_INK }
                            : { backgroundColor: '#E9EDF4', color: '#3C4A61' }
                        }
                      >
                        {field ? 'Field' : 'Desk'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[13px]" style={{ color: INK_MUTED }}>
                      {r.districts.length === 0 ? 'Statewide' : r.districts.join(', ')}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold text-gray-900">
                      {formatIN(r.openCount)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]" style={{ color: INK_MUTED }}>
                      {formatIN(r.completedCount)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]" style={{ color: INK_MUTED }}>
                      {r.avgTurnaroundDays === null ? 'n/a' : r.avgTurnaroundDays.toFixed(1)}
                    </td>
                    <td
                      className="px-5 py-3 text-right font-mono text-[13px] font-bold"
                      style={{ color: r.qualityFlags >= 4 ? RED : r.qualityFlags > 0 ? GOLD_INK : '#B9C2D2' }}
                    >
                      {formatIN(r.qualityFlags)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="border-t border-gray-100 px-5 py-3 text-[12.5px]" style={{ color: INK_MUTED }}>
          Open a verifier for their record, the work of theirs that was sampled for review, and
          their standing against the removal rules.
        </p>
      </section>
    </div>
  );
}
