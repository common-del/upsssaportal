import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AlertCircle, Scale } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getBatchSelfAssessmentScores, getBatchVerificationScores } from '@/lib/scoring';
import { getAppealEligibility } from '@/lib/actions/finalization';

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

export default async function VerifierFeedbackPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const t = await getTranslations('verifierFeedback');
  const schoolUdise = session.user.name!;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return <EmptyWrap t={t} msg={t('noCycle')} />;
  }

  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework || framework.status !== 'PUBLISHED') {
    return <EmptyWrap t={t} msg={t('noFramework')} />;
  }

  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: { category: true },
  });
  if (!school) return <EmptyWrap t={t} msg={t('notFound')} />;

  const categoryCode = CATEGORY_TO_CODE[school.category] ?? 'PRIMARY';

  const vSubmission = await prisma.verificationSubmission.findFirst({
    where: { cycleId: cycle.id, schoolUdise, status: 'SUBMITTED' },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true, notes: true } } },
  });

  if (!vSubmission) {
    return <EmptyWrap t={t} msg={t('noVerifierYet')} />;
  }

  const saSubmission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
    include: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
  });

  const fullFramework = await prisma.framework.findUnique({
    where: { id: framework.id },
    include: {
      domains: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          subDomains: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: {
              parameters: {
                where: { isActive: true },
                orderBy: { order: 'asc' },
                include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
              },
            },
          },
        },
      },
    },
  });
  if (!fullFramework) return <EmptyWrap t={t} msg={t('noFramework')} />;

  const [saScores, vScores] = await Promise.all([
    getBatchSelfAssessmentScores(cycle.id, framework.id, [schoolUdise]),
    getBatchVerificationScores(cycle.id, framework.id, [schoolUdise]),
  ]);

  const saMap = new Map<string, string>();
  if (saSubmission) for (const r of saSubmission.responses) saMap.set(r.parameterId, r.selectedOptionKey);

  const vMap = new Map<string, { selectedOptionKey: string; notes: string | null }>();
  for (const r of vSubmission.responses) vMap.set(r.parameterId, { selectedOptionKey: r.selectedOptionKey, notes: r.notes });

  /**
   * Only the indicators the two sides answered differently.
   *
   * The page used to render the whole framework — five domains, eleven sub-domains,
   * every applicable parameter with both answers side by side. Accurate, and it
   * buried the six rows a school can actually do something about under seventy-five
   * it agreed with. An appeal is argued indicator by indicator, so the disagreements
   * are the page.
   *
   * Direction comes from the option order, which is best-first, so a higher index is
   * the weaker answer. No point figure is shown: converting one indicator to points
   * needs the domain weighting, and a number I cannot stand behind is worse here than
   * no number, on a page whose whole purpose is disputing numbers.
   */
  type Difference = {
    id: string;
    titleEn: string;
    titleHi: string;
    domainEn: string;
    selfLabel: string | null;
    verifierLabel: string | null;
    direction: 'down' | 'up' | 'changed';
    note: string | null;
  };

  const differences: Difference[] = [];
  let agreed = 0;
  let applicable = 0;

  for (const domain of fullFramework.domains) {
    for (const sd of domain.subDomains) {
      for (const param of sd.parameters) {
        if (!(param.applicability as string[]).includes(categoryCode)) continue;
        applicable++;

        const own = saMap.get(param.id);
        const theirs = vMap.get(param.id);
        if (!theirs) continue;

        if (own == null || own === theirs.selectedOptionKey) {
          agreed++;
          continue;
        }

        const ownIdx = param.options.findIndex((o) => o.key === own);
        const theirIdx = param.options.findIndex((o) => o.key === theirs.selectedOptionKey);
        const direction: Difference['direction'] =
          ownIdx === -1 || theirIdx === -1 ? 'changed' : theirIdx > ownIdx ? 'down' : 'up';

        differences.push({
          id: param.id,
          titleEn: param.titleEn,
          titleHi: param.titleHi,
          domainEn: domain.titleEn,
          selfLabel: param.options.find((o) => o.key === own)?.labelEn ?? null,
          verifierLabel:
            param.options.find((o) => o.key === theirs.selectedOptionKey)?.labelEn ?? null,
          direction,
          note: theirs.notes,
        });
      }
    }
  }

  const selfPct = saScores[schoolUdise]?.scorePercent ?? null;
  const verifiedPct = vScores[schoolUdise]?.scorePercent ?? null;
  const delta =
    selfPct != null && verifiedPct != null ? Math.round((verifiedPct - selfPct) * 10) / 10 : null;

  const checkedOn = vSubmission.submittedAt ?? vSubmission.updatedAt;

  const DIRECTION_STYLE: Record<Difference['direction'], string> = {
    down: 'bg-[#FBE9E7] text-[#96271E]',
    up: 'bg-[#E7F5EE] text-[#14603A]',
    changed: 'bg-[#F3F4F6] text-gray-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {checkedOn ? t('checkedOn', { date: checkedOn.toLocaleDateString('en-IN') }) : t('subtitle')}
          {' · '}
          {t('agreedCount', { count: agreed, total: applicable })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
            {t('vScore')}
          </p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums" style={{ color: '#1B2A6B' }}>
            {verifiedPct != null ? verifiedPct.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
            {t('saScore')}
          </p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums text-gray-400">
            {selfPct != null ? selfPct.toFixed(1) : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
            {t('difference')}
          </p>
          <p
            className={`mt-1.5 text-3xl font-bold tabular-nums ${
              delta != null && delta < 0 ? 'text-[#96271E]' : 'text-gray-900'
            }`}
          >
            {delta == null ? '—' : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {differences.length} {differences.length === 1 ? 'indicator' : 'indicators'}
          </p>
        </div>
      </div>

      <AppealBanner cycleId={cycle.id} schoolUdise={schoolUdise} t={t} />

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('differencesTitle')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('differencesNote')}</p>

        {differences.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#B9E0CB] bg-[#E7F5EE] px-4 py-3 text-sm text-[#14603A]">
            {t('noDifferences')}
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    {[t('colIndicator'), t('colDomain'), t('colYouSaid'), t('colVerifierSaid'), t('colEffect')].map(
                      (h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap border-b border-gray-200 pb-2.5 pr-4 text-left text-[10.5px] font-bold uppercase tracking-wider text-gray-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {differences.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-semibold text-gray-900">{d.titleEn}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{d.titleHi}</p>
                        {d.note && (
                          <p className="mt-1.5 text-xs text-gray-600">
                            <span className="font-semibold">{t('verifierNote')}:</span> {d.note}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-top text-gray-600">{d.domainEn}</td>
                      <td className="py-3 pr-4 align-top text-gray-700">
                        {d.selfLabel ?? t('noAnswer')}
                      </td>
                      <td className="py-3 pr-4 align-top font-medium text-gray-900">
                        {d.verifierLabel ?? t('noAnswer')}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${DIRECTION_STYLE[d.direction]}`}
                        >
                          {d.direction === 'down'
                            ? t('markedDown')
                            : d.direction === 'up'
                              ? t('markedUp')
                              : t('changed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-gray-500">{t('standsNote')}</p>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The route out of this page. Reads eligibility rather than assuming it: the appeal
 * window closes a fixed number of days after the verifier submitted, and a school
 * that already filed one needs the link to its appeal, not an invitation to file
 * another.
 */
async function AppealBanner({
  cycleId,
  schoolUdise,
  t,
}: {
  cycleId: string;
  schoolUdise: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const eligibility = await getAppealEligibility(cycleId, schoolUdise);
  if (!('deadline' in eligibility)) return null;

  const filed = !!eligibility.existingAppeal;
  if (!eligibility.eligible && !filed) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${
        filed
          ? 'border-[#B9E0CB] bg-[#E7F5EE] text-[#14603A]'
          : 'border-[#EBD9A8] bg-[#FBF1DE] text-[#6B4A00]'
      }`}
    >
      <span className="flex items-start gap-2.5">
        {filed ? (
          <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>
          <span className="font-semibold">
            {filed ? t('appealInProgress') : t('appealEligible')}
          </span>
          {!filed && (
            <span className="mt-0.5 block text-xs">
              {t('appealDeadline')}: {eligibility.deadline.toLocaleDateString('en-IN')}
            </span>
          )}
        </span>
      </span>
      <Link
        href="/app/school/appeals"
        className="whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold text-white"
        style={{ backgroundColor: '#1B2A6B' }}
      >
        {t('goToAppeal')}
      </Link>
    </div>
  );
}

function EmptyWrap({ t, msg }: { t: (k: string) => string; msg: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">{msg}</div>
    </div>
  );
}
