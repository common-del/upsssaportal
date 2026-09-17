import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/authz';
import { buildVerificationYear, type YearStep } from '@/lib/sssa/verificationYear';
import { getStrandedSchools } from '@/lib/actions/reallocation';
import { StrandedSchools } from '@/components/sssa/StrandedSchools';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GREEN = '#2E7D57';
const GOLD_INK = '#7A5209';

/**
 * The verification year.
 *
 * Field Cohort used to be its own sidebar tab: a permanent place for a button pressed once a
 * year, which looked exactly the same before and after the press. It is a row here instead, in
 * its position in the sequence, where "not drawn yet" and "drawn on 14 September" are two
 * visibly different things and the draw screen is one click away rather than always underfoot.
 *
 * The stranded list sits below it because it is the same subject. A school in the cohort with
 * nobody going to it is the cohort's unfinished business, not a separate workflow.
 */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DOT: Record<YearStep['status'], { fill: string; ring: string }> = {
  DONE: { fill: GREEN, ring: GREEN },
  RUNNING: { fill: '#FFFFFF', ring: NAVY },
  WAITING: { fill: '#FFFFFF', ring: '#D3DAE6' },
};

function StepRow({ step }: { step: YearStep }) {
  const dot = DOT[step.status];
  const dim = step.status === 'WAITING';
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
      <span
        className="h-3 w-3 shrink-0 rounded-full border-2"
        style={{ backgroundColor: dot.fill, borderColor: dot.ring }}
      />
      <span
        className="w-44 shrink-0 text-sm font-semibold"
        style={{ color: dim ? '#8A97AC' : '#1A2331' }}
      >
        {step.name}
      </span>
      <span className="grow text-[13.5px] leading-snug" style={{ color: dim ? '#A2ADBE' : INK_MUTED }}>
        {step.state}
      </span>
      <span className="w-28 shrink-0 text-right text-xs" style={{ color: '#8A97AC' }}>
        {step.note}
      </span>
    </div>
  );
}

export default async function VerificationYearPage() {
  const actor = await requireRole('SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const year = await buildVerificationYear();
  if (!year) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Verification year
        </h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No cycle is active, so there is no year to show. Open one in Configuration.
        </div>
      </div>
    );
  }

  const stranded = year.cohort.stranded > 0 ? await getStrandedSchools() : [];
  const { drawn } = year.cohort;

  // Everything before the cohort, then the cohort itself, then everything after it. Split rather
  // than flagged so the draw reads as a decision point in the sequence and not as another row.
  const before = year.steps.filter((s) => !['field-visits', 'published'].includes(s.key));
  const after = year.steps.filter((s) => ['field-visits', 'published'].includes(s.key));

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={
              year.resultsPublished
                ? { backgroundColor: '#E9EDF4', color: '#3C4A61' }
                : { backgroundColor: '#E3F0E8', color: '#1E6344' }
            }
          >
            {year.resultsPublished ? 'Year complete' : 'Year open'}
          </span>
          {year.startsAt && year.endsAt && (
            <span className="text-[13px]" style={{ color: INK_MUTED }}>
              Opened {formatDate(year.startsAt)}, closes {formatDate(year.endsAt)}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          {year.cycleName}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: '#3C4A61' }}>
          Where every school is in this year&apos;s run, and the one decision the Authority has to
          take next.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {before.map((s) => (
          <StepRow key={s.key} step={s} />
        ))}

        {/* The draw, in its place in the sequence. Two visibly different states, because a screen
            that looks the same before and after an irreversible action cannot be read. */}
        {drawn ? (
          <div className="flex flex-wrap items-center gap-4 border-y border-gray-100 px-5 py-5" style={{ backgroundColor: '#F7FBF8' }}>
            <span
              className="h-3 w-3 shrink-0 rounded-full border-2"
              style={{ backgroundColor: GREEN, borderColor: GREEN }}
            />
            <span className="w-44 shrink-0 text-sm font-semibold text-gray-900">Field cohort</span>
            <span className="grow space-y-1">
              <span className="block text-[13.5px] leading-snug" style={{ color: INK_MUTED }}>
                {drawn.selectedCount.toLocaleString('en-IN')} schools drawn on {formatDate(drawn.at)}
                {drawn.byName ? ` by ${drawn.byName}` : ''}. Travel window {formatDate(drawn.travelWindowStart)} to{' '}
                {formatDate(drawn.travelWindowEnd)}.
              </span>
              {year.cohort.stranded > 0 && (
                <span className="block text-[13.5px] font-semibold" style={{ color: GOLD_INK }}>
                  {year.cohort.stranded.toLocaleString('en-IN')}{' '}
                  {year.cohort.stranded === 1 ? 'school has' : 'schools have'} nobody going to them.
                </span>
              )}
            </span>
            <Link
              href="/app/sssa/cohort"
              className="shrink-0 text-[13px] font-semibold underline"
              style={{ color: NAVY }}
            >
              Open the draw
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 border-y border-gray-100 px-5 py-5" style={{ backgroundColor: '#F5F8FD' }}>
            <span className="h-3 w-3 shrink-0 rounded-full border-2 bg-white" style={{ borderColor: NAVY }} />
            <span className="grow space-y-1">
              <span className="block text-[15.5px] font-bold" style={{ color: NAVY_DEEP }}>
                Field cohort, not drawn yet
              </span>
              <span className="block max-w-2xl text-[13.5px] leading-relaxed" style={{ color: '#3C4A61' }}>
                {year.cohort.waiting.toLocaleString('en-IN')} schools are waiting. Drawing picks this
                year&apos;s list for an unannounced visit and hands each school to a field verifier.
              </span>
            </span>
            <Link
              href="/app/sssa/cohort"
              className="inline-flex min-h-[46px] shrink-0 items-center rounded-lg px-5 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: NAVY }}
            >
              Draw the list
            </Link>
          </div>
        )}

        {after.map((s) => (
          <StepRow key={s.key} step={s} />
        ))}
      </section>

      {/* Only present when there is something to do. An empty exception list on screen every day
          teaches people to stop looking at it. */}
      {stranded.length > 0 && <StrandedSchools rows={stranded} />}
    </div>
  );
}
