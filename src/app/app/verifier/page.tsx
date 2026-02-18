import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { getVerifierAssignments } from '@/lib/actions/verification';

export default async function VerifierHomePage() {
  const session = await auth();
  if (!session) redirect('/system/verifier');
  if (session.user.role !== 'VERIFIER') redirect('/');

  const t = await getTranslations('verifierDashboard');
  const userId = session.user.id!;
  const { assignments, cycleName } = await getVerifierAssignments(userId);

  const submitted = assignments.filter((a) => a.submission?.status === 'SUBMITTED').length;
  const inProgress = assignments.filter((a) => a.submission?.startedAt && a.submission.status !== 'SUBMITTED').length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-text-secondary">{t('welcome', { username: session.user.name })}</p>

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
