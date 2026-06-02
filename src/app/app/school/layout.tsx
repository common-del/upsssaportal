import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SchoolAdminLayout } from '@/components/school/SchoolTopNav';
import { schoolInitials } from '@/lib/school/helpers';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const schoolUdise = session.user.name!;
  const [school, unreadCount] = await Promise.all([
    prisma.school.findUnique({
      where: { udise: schoolUdise },
      select: { nameEn: true, category: true },
    }),
    prisma.notification.count({
      where: { userId: session.user.id!, read: false },
    }),
  ]);

  return (
    <SchoolAdminLayout
      schoolName={school?.nameEn ?? 'School'}
      schoolInitials={schoolInitials(school?.nameEn ?? 'UP')}
      schoolCategory={school?.category ?? 'GOVT'}
      unreadCount={unreadCount}
    >
      {children}
    </SchoolAdminLayout>
  );
}
