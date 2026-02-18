import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { getFrameworkFull } from '@/lib/actions/framework';
import FrameworkEditor from '@/components/framework/FrameworkEditor';

export default async function FrameworkEditorPage({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/system/sssa');
  if (session.user.role !== 'SSSA_ADMIN') redirect('/');

  const { frameworkId } = await params;
  const t = await getTranslations('framework');

  const framework = await getFrameworkFull(frameworkId);
  if (!framework) notFound();

  const isPublished = framework.status === 'PUBLISHED';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/app/sssa/frameworks"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900"
      >
        <ArrowLeft size={16} />
        {t('backToFrameworks')}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-navy-900">{t('editorTitle')}</h1>
        <span className="text-sm text-text-secondary">{framework.cycle.name}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isPublished ? t('statusPublished') : t('statusDraft')}
        </span>
      </div>

      {isPublished && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Lock size={16} />
          {t('publishedReadonly')}
        </div>
      )}

      <FrameworkEditor framework={framework} userId={session.user.id} />
    </div>
  );
}
