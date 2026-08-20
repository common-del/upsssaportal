import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireSchool } from '@/lib/authz';
import { buildImprovementPlan } from '@/lib/school/improvementPlan';

/**
 * The School Improvement Plan.
 *
 * Computed on every render from the school's current answers, which is what makes the source
 * flowchart's promise true: change a level on the SQAAF form and this page has already
 * changed. Nothing is cached and nothing needs invalidating.
 *
 * Colours follow the brief's visual system. Navy carries the desk track, and this is a desk
 * artefact, so nothing on this page is gold: gold belongs to the field.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

export default async function ImprovementPlanPage() {
  const actor = await requireSchool();
  if (!actor) redirect('/login?tab=school');

  const plan = await buildImprovementPlan(actor.schoolUdise);

  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          School Improvement Plan
        </h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No assessment cycle is open. Your plan will appear here once one is.
        </div>
      </div>
    );
  }

  const totalActions = plan.domains.reduce((n, d) => n + d.actions.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          School Improvement Plan
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Built from your own SQAAF answers for {plan.cycleName}. Change a level on the SQAAF
          form and this plan changes with it.
        </p>
      </div>

      {plan.notStarted ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-700">
            Your plan is built from your SQAAF answers, and none have been recorded yet.
          </p>
          <Link
            href="/app/school/sqaaf"
            className="mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: NAVY }}
          >
            Start your self-assessment
          </Link>
        </div>
      ) : (
        <>
          <section className="grid gap-px overflow-hidden rounded-xl bg-gray-100 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <div className="bg-white px-4 py-4">
              <p className="text-2xl font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                {plan.answered}
              </p>
              <p className="text-xs font-medium" style={{ color: INK_MUTED }}>
                Indicators answered
              </p>
            </div>
            <div className="bg-white px-4 py-4">
              <p className="text-2xl font-bold tabular-nums text-[#14603A]">{plan.atTopLevel}</p>
              <p className="text-xs font-medium" style={{ color: INK_MUTED }}>
                Already at the top level
              </p>
            </div>
            <div className="bg-white px-4 py-4">
              <p className="text-2xl font-bold tabular-nums" style={{ color: NAVY_DEEP }}>
                {totalActions}
              </p>
              <p className="text-xs font-medium" style={{ color: INK_MUTED }}>
                Actions in this plan
              </p>
            </div>
          </section>

          {totalActions === 0 ? (
            <div className="rounded-xl border border-[#E7F5EE] bg-[#E7F5EE] p-6">
              <p className="text-sm font-semibold text-[#14603A]">
                Every indicator you have answered is already at the top level.
              </p>
              <p className="mt-1 text-sm text-[#14603A]">
                There is nothing to improve on your own answers. A verifier may still reach a
                different view when your assessment is checked.
              </p>
            </div>
          ) : (
            plan.domains.map((domain) => (
              <section
                key={domain.code}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
                  style={{ backgroundColor: NAVY }}
                >
                  <h2 className="text-sm font-bold text-white">{domain.titleEn}</h2>
                  <span className="text-xs text-white/80">
                    {domain.actions.length}{' '}
                    {domain.actions.length === 1 ? 'action' : 'actions'}
                    {domain.atTopLevel > 0 && ` · ${domain.atTopLevel} already at the top`}
                  </span>
                </div>

                <ul className="divide-y divide-gray-100">
                  {domain.actions.map((a) => (
                    <li key={a.parameterCode} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className="font-mono text-xs font-semibold"
                          style={{ color: INK_MUTED }}
                        >
                          {a.parameterCode}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {a.parameterTitleEn}
                        </span>
                        <span
                          className="ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: '#EDF1F9', color: NAVY }}
                        >
                          Level {a.currentLevel} to {a.targetLevel}
                        </span>
                      </div>
                      {/* The framework's own wording for the next level up. Not advice written
                          for this page: the school reads the text its assessment is judged
                          against. */}
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        {a.targetDescriptionEn}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: INK_MUTED }}>
                        {a.targetDescriptionHi}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          <p className="text-xs" style={{ color: INK_MUTED }}>
            Each action is the SQAAF framework&apos;s description of the next level up, one step
            at a time rather than a jump to the top. Domains are ordered by weight, so the ones
            that move your score most come first.
          </p>
        </>
      )}
    </div>
  );
}
