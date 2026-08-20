import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/authz';
import { previewCohort } from '@/lib/actions/cohort';
import { CohortBuildForm } from '@/components/sssa/CohortBuildForm';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

function formatIN(n: number) {
  return n.toLocaleString('en-IN');
}

/**
 * The cohort build tool.
 *
 * The preview exists because this is an expensive, hard-to-reverse action: it creates a field
 * visit per school and moves every selected run into the cohort. The number that matters most is
 * not the total but the district-wise load, since a cohort correctly sized statewide can still be
 * undeliverable in a district that draws three times its share.
 */
export default async function CohortPage() {
  const actor = await requireRole('SSSA_ADMIN');
  if (!actor) redirect('/login?tab=official');

  const preview = await previewCohort();

  if (!preview) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Field cohort
        </h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No active cycle, so there is no cohort to build.
        </div>
      </div>
    );
  }

  const { plan, basis, percentage, registerCount, intakeCount, candidateCount } = preview;
  const denominator = basis === 'ALL_SCHOOLS' ? registerCount : intakeCount;
  const districtRows = Object.entries(plan.byDistrict).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Field cohort
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Schools receiving a physical visit this year, drawn from the census queue and the
          fast-tracked cases ahead of it.
        </p>
      </div>

      {/* The basis is the decision the source documents leave open, so the screen states which
          reading it is using rather than presenting the number as settled. */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#FBF1DE', backgroundColor: '#FDF8EC' }}>
        <p className="text-sm font-bold" style={{ color: '#7A5209' }}>
          {percentage}% measured against {basis === 'ALL_SCHOOLS' ? 'every school on the register' : 'this year’s verification intake'}
        </p>
        <p className="mt-1 text-sm" style={{ color: '#7A5209' }}>
          {basis === 'ALL_SCHOOLS'
            ? `${formatIN(registerCount)} schools, so ${formatIN(Math.round((registerCount * percentage) / 100))} visits a year and every school seen once in three years.`
            : `${formatIN(intakeCount)} schools in this year’s intake, so ${formatIN(Math.round((intakeCount * percentage) / 100))} visits a year, which preserves the triage but lengthens the revisit interval.`}
        </p>
        <p className="mt-2 text-xs" style={{ color: '#7A5209' }}>
          The source documents say both 33% and a three-year revisit, and only one reading satisfies
          both. Change the basis in programme configuration if this is the wrong one.
        </p>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl bg-gray-100 [grid-template-columns:repeat(auto-fit,minmax(165px,1fr))]">
        {[
          { n: candidateCount, l: 'Waiting in the queue' },
          { n: plan.size, l: 'Selected this year' },
          { n: plan.deferredCount, l: 'Deferred to next year' },
          { n: denominator, l: basis === 'ALL_SCHOOLS' ? 'Schools on the register' : 'This year’s intake' },
        ].map((s) => (
          <div key={s.l} className="bg-white px-4 py-4">
            <p className="text-2xl font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
              {formatIN(s.n)}
            </p>
            <p className="text-xs font-medium" style={{ color: INK_MUTED }}>
              {s.l}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-3" style={{ backgroundColor: NAVY }}>
          <h2 className="text-sm font-bold text-white">Queue order</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {([1, 2, 3] as const).map((p) => (
            <li key={p} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-800">
                <span className="mr-2 font-mono text-xs" style={{ color: INK_MUTED }}>
                  {p}
                </span>
                {p === 1 ? 'Unresolved on video' : p === 2 ? 'Did not submit' : 'Census rotation'}
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                {formatIN(plan.byPriority[p])}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3" style={{ backgroundColor: NAVY }}>
          <h2 className="text-sm font-bold text-white">District load</h2>
          <span className="text-xs text-white/80">{districtRows.length} districts drawn</span>
        </div>
        {districtRows.length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: INK_MUTED }}>
            Nothing selected yet.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {districtRows.map(([code, count]) => (
                  <tr key={code}>
                    <td className="px-5 py-2.5 font-mono text-xs" style={{ color: INK_MUTED }}>
                      {code}
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold tabular-nums text-gray-900">
                      {formatIN(count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CohortBuildForm selectedCount={plan.size} />
    </div>
  );
}
