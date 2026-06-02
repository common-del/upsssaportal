import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { buildSchoolReportData } from '@/lib/reports/schoolReport';
import { SchoolReportCardView } from '@/components/school/SchoolReportCardView';

export default async function SchoolReportCardPage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const data = await buildSchoolReportData(schoolUdise);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">School Report Card</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Report card is not available yet. Complete your SQAAF assessment and wait for results to be published.
        </div>
      </div>
    );
  }

  return <SchoolReportCardView data={data} />;
}
