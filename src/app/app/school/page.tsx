import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSchoolDashboardData } from '@/lib/school/dashboardData';
import { SchoolDashboard } from '@/components/school/SchoolDashboard';

export default async function SchoolHomePage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const data = await getSchoolDashboardData(session.user.name!, session.user.id!);
  if (!data) redirect('/login?tab=school');

  return <SchoolDashboard data={data} />;
}
