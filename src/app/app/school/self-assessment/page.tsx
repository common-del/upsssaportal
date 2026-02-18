import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  getActiveFrameworkForSchool,
  getOrCreateSubmission,
} from '@/lib/actions/selfAssessment';
import SelfAssessmentForm from '@/components/selfAssessment/SelfAssessmentForm';

export default async function SelfAssessmentPage() {
  const session = await auth();
  if (!session) redirect('/school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const t = await getTranslations('selfAssessment');

  const data = await getActiveFrameworkForSchool(schoolUdise);

  if (!data) {
    return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToHome')}
      </Link>
        <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {t('noActiveFramework')}
        </div>
      </div>
    );
  }

  const { framework, cycleId, cycleName, totalApplicable } = data;
  const submission = await getOrCreateSubmission(cycleId, schoolUdise, framework.id);

  const responseMap: Record<string, { selectedOptionKey: string; notes: string | null }> = {};
  for (const r of submission.responses) {
    responseMap[r.parameterId] = { selectedOptionKey: r.selectedOptionKey, notes: r.notes };
  }

  // Serialize for client component
  const serializedFramework = {
    id: framework.id,
    domains: framework.domains.map((d) => ({
      id: d.id,
      code: d.code,
      titleEn: d.titleEn,
      titleHi: d.titleHi,
      subDomains: d.subDomains.map((sd) => ({
        id: sd.id,
        code: sd.code,
        titleEn: sd.titleEn,
        titleHi: sd.titleHi,
        parameters: sd.parameters.map((p) => ({
          id: p.id,
          code: p.code,
          titleEn: p.titleEn,
          titleHi: p.titleHi,
          evidenceRequired: p.evidenceRequired,
          options: p.options.map((o) => ({
            key: o.key,
            labelEn: o.labelEn,
            labelHi: o.labelHi,
          })),
        })),
      })),
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/app/school" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
        <ArrowLeft size={16} /> {t('backToHome')}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t('cycle')}: <span className="font-semibold">{cycleName}</span>
        </p>
      </div>

      <SelfAssessmentForm
        framework={serializedFramework}
        submissionId={submission.id}
        schoolUdise={schoolUdise}
        existingResponses={responseMap}
        totalApplicable={totalApplicable}
        isSubmitted={submission.status === 'SUBMITTED'}
      />
    </div>
  );
}
