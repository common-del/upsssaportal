import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { prisma } from '@/lib/db';

export default async function DistrictHomePage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'DISTRICT_OFFICIAL') redirect('/');

  const t = await getTranslations('appDistrict');
  const districtCode = session.user.districtCode ?? '';

  const ticketCount = await prisma.ticket.count({
    where: { districtCode },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-text-secondary">{t('welcome', { username: session.user.name })}</p>
      <p className="mt-2 text-sm font-medium text-navy-700">{t('district', { code: districtCode || '—' })}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/app/district/tickets" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <MessageSquare size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('ticketsLink')}</p>
            <p className="text-sm text-text-secondary">{t('ticketsCount', { count: ticketCount })}</p>
          </div>
        </Link>
      </div>

      <p className="mt-8 text-sm text-text-secondary">{t('placeholder')}</p>
    </div>
  );
}
