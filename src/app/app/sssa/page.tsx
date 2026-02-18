import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MessageSquare, LayoutGrid, BarChart3, UserCheck, Users, Trophy } from 'lucide-react';
import { prisma } from '@/lib/db';

export default async function SssaHomePage() {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const t = await getTranslations('appSssa');

  const ticketCount = await prisma.ticket.count();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{t('title')}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/app/sssa/frameworks" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50">
            <LayoutGrid size={20} className="text-navy-700" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('frameworkLink')}</p>
            <p className="text-sm text-text-secondary">{t('frameworkDesc')}</p>
          </div>
        </Link>

        <Link href="/app/sssa/monitoring" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <BarChart3 size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('monitoringLink')}</p>
            <p className="text-sm text-text-secondary">{t('monitoringDesc')}</p>
          </div>
        </Link>

        <Link href="/app/sssa/verification/assign" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
            <UserCheck size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('verificationLink')}</p>
            <p className="text-sm text-text-secondary">{t('verificationDesc')}</p>
          </div>
        </Link>

        <Link href="/app/sssa/finalization" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <Trophy size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('finalizationLink')}</p>
            <p className="text-sm text-text-secondary">{t('finalizationDesc')}</p>
          </div>
        </Link>

        <Link href="/app/sssa/users" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
            <Users size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-navy-900">{t('usersLink')}</p>
            <p className="text-sm text-text-secondary">{t('usersDesc')}</p>
          </div>
        </Link>

        <Link href="/app/sssa/tickets" className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
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
