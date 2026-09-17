import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/authz';
import { previewCohort, type DistrictLoadRow } from '@/lib/actions/cohort';
import { PRIORITY_LABEL } from '@/lib/verification/cohort';
import { CohortBuildForm } from '@/components/sssa/CohortBuildForm';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GOLD_INK = '#7A5209';

/**
 * The draw.
 *
 * This screen used to open on an amber box about whether 33% means 33% of the register or of the
 * year's intake, then show four counts, a list of raw district codes and a button labelled
 * "Build cohort". It never said what the button did. It does now, in numbers, before anything
 * else: how many schools move, how many visits are created, and how many of them have nobody to
 * send. The percentage argument is a line at the bottom, which is its weight.
 *
 * District load carries names and a bar because it is the number that decides whether to press.
 * A cohort correctly sized statewide is still undeliverable in a district drawing three times its
 * share, and unreadable as `D001`.
 */

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Consequence({ n, colour, children }: { n: number; colour: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <span className="w-24 shrink-0 text-right text-[22px] font-bold tabular-nums" style={{ color: colour }}>
        {formatIN(n)}
      </span>
      <span className="text-sm leading-relaxed text-gray-800">{children}</span>
    </div>
  );
}

function DistrictRow({ row, widest }: { row: DistrictLoadRow; widest: number }) {
  const heavy = row.timesAverage >= 2 || row.verifiers === 0;
  return (
    <div className="flex items-center gap-3.5 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="w-32 shrink-0 truncate text-sm font-semibold text-gray-800">{row.name}</span>
      <span className="h-2.5 grow overflow-hidden rounded-full" style={{ backgroundColor: '#EDF1F7' }}>
        <span
          className="block h-2.5 rounded-full"
          style={{
            backgroundColor: heavy ? GOLD : NAVY,
            width: `${widest === 0 ? 0 : Math.max(2, Math.round((row.count / widest) * 100))}%`,
          }}
        />
      </span>
      <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
        {formatIN(row.count)}
      </span>
      <span className="w-48 shrink-0 text-xs" style={{ color: heavy ? GOLD_INK : '#8A97AC' }}>
        {row.verifiers === 0
          ? 'No verifier rostered here'
          : `${formatIN(row.verifiers)} ${row.verifiers === 1 ? 'verifier' : 'verifiers'}, ${formatIN(row.perVerifier ?? 0)} each`}
      </span>
    </div>
  );
}

export default async function CohortPage() {
  const actor = await requireRole('SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const preview = await previewCohort();

  if (!preview) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Draw this year&apos;s inspection list
        </h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No cycle is active, so there is nothing to draw.
        </div>
      </div>
    );
  }

  const {
    size,
    deferredCount,
    candidateCount,
    byPriority,
    districts,
    districtsWithoutVerifier,
    schoolsWithoutVerifier,
    basis,
    percentage,
    registerCount,
    intakeCount,
    drawn,
  } = preview;

  const widest = districts.length === 0 ? 0 : districts[0]!.count;
  const placeable = size - schoolsWithoutVerifier;
  const denominator = basis === 'ALL_SCHOOLS' ? registerCount : intakeCount;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={
              drawn
                ? { backgroundColor: '#E3F0E8', color: '#1E6344' }
                : { backgroundColor: '#E9EDF4', color: '#3C4A61' }
            }
          >
            {drawn ? 'Drawn' : 'Not drawn yet'}
          </span>
          <Link href="/app/sssa/year" className="text-[13px] font-semibold underline" style={{ color: NAVY }}>
            Back to the verification year
          </Link>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Draw this year&apos;s inspection list
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: '#3C4A61' }}>
          Choose which schools get an unannounced physical visit this year, and put each one into a
          field verifier&apos;s queue.
        </p>
      </div>

      {drawn && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#CFE6D9', backgroundColor: '#F1F9F4' }}>
          <p className="text-sm font-bold" style={{ color: '#1E6344' }}>
            {formatIN(drawn.selectedCount)} schools were drawn on {formatDate(drawn.at)}
            {drawn.byName ? ` by ${drawn.byName}` : ''}.
          </p>
          <p className="mt-1 text-sm" style={{ color: '#256B4C' }}>
            {formatIN(drawn.visitsCreated)} visits were created for the window {formatDate(drawn.travelWindowStart)} to{' '}
            {formatDate(drawn.travelWindowEnd)}
            {drawn.unassignedCount > 0
              ? `, and ${formatIN(drawn.unassignedCount)} schools ended the draw with nobody allocated.`
              : '.'}{' '}
            Drawing again adds only the schools that have joined the queue since. It cannot create a
            second visit for a school that already has one.
          </p>
        </div>
      )}

      {size === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">Nothing is waiting to be drawn.</p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            Every school in this year&apos;s queue already has a visit. Schools reach this queue from
            desk screening, from an unresolved walkthrough and from the census rotation.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-3" style={{ backgroundColor: NAVY }}>
            <h2 className="text-sm font-bold text-white">What pressing Draw will do</h2>
          </div>
          <div className="px-5 pb-4 pt-1">
            <Consequence n={size} colour={NAVY_DEEP}>
              schools move out of the waiting queue and into this year&apos;s field cohort.
            </Consequence>
            <Consequence n={placeable} colour={NAVY_DEEP}>
              visits are created, one per school, each handed to a certified field verifier who works
              that district.
            </Consequence>
            {schoolsWithoutVerifier > 0 && (
              <Consequence n={schoolsWithoutVerifier} colour={GOLD_INK}>
                schools are in {districtsWithoutVerifier.length === 1 ? 'a district' : 'districts'} with
                nobody rostered to visit them
                {districtsWithoutVerifier.length <= 3
                  ? ` (${districtsWithoutVerifier.map((d) => d.name).join(', ')})`
                  : ''}
                . They still join the cohort, and appear on the verification year screen until somebody
                is sent.
              </Consequence>
            )}
            {deferredCount > 0 && (
              <Consequence n={deferredCount} colour={INK_MUTED}>
                schools stay in the queue for next year. {formatIN(candidateCount)} are waiting in all.
              </Consequence>
            )}
            <p className="mt-3 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed" style={{ backgroundColor: '#F5F8FD', color: '#3C4A61' }}>
              Verifiers are told the district and the travel window straight away. The school&apos;s name
              is withheld until the morning of the visit.
            </p>
          </div>
        </section>
      )}

      {districts.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ backgroundColor: NAVY }}>
            <h2 className="text-sm font-bold text-white">Where the visits fall</h2>
            <span className="text-xs text-white/80">
              {formatIN(districts.length)} districts, heaviest first
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto px-5">
            {districts.map((row) => (
              <DistrictRow key={row.code} row={row} widest={widest} />
            ))}
          </div>
          <p className="border-t border-gray-100 px-5 py-3 text-xs" style={{ color: '#8A97AC' }}>
            A district is marked in gold when it draws twice the average share or has nobody rostered.
            Block-level and school-level exclusions are not counted here: they are per-school facts,
            and the draw reports what it actually skipped.
          </p>
        </section>
      )}

      {size > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-3" style={{ backgroundColor: NAVY }}>
            <h2 className="text-sm font-bold text-white">Who goes first</h2>
          </div>
          <p className="px-5 pt-3 text-[13px] leading-relaxed" style={{ color: INK_MUTED }}>
            The queue is longer than the cohort in most years, so it is taken in this order. Within
            the last band, the schools waiting longest go first.
          </p>
          <ul className="divide-y divide-gray-100 px-5 pb-1">
            {([1, 2, 3] as const).map((p) => (
              <li key={p} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-800">
                  <span className="mr-2.5 font-mono text-xs" style={{ color: INK_MUTED }}>
                    {p}
                  </span>
                  {PRIORITY_LABEL[p]}
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                  {formatIN(byPriority[p] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {size > 0 && <CohortBuildForm selectedCount={size} />}

      <p className="text-xs leading-relaxed" style={{ color: '#7C8899' }}>
        Sized at {percentage}% of{' '}
        {basis === 'ALL_SCHOOLS'
          ? `the ${formatIN(denominator)} schools on the register, so every school is seen once in three years`
          : `this year's intake of ${formatIN(denominator)} schools, which keeps the triage meaningful but lengthens the revisit interval`}
        . The source documents say both 33% and a three-year revisit, and only one reading satisfies
        both. The basis is set in Configuration.
      </p>
    </div>
  );
}
