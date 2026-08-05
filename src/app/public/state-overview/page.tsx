import { getTranslations } from 'next-intl/server';
import { BackButton } from '@/components/common/BackButton';
import { StateOverviewContent } from '@/components/public/StateOverviewContent';

export default async function StateOverviewPage() {
  const tc = await getTranslations('common');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton
        fallbackHref="/public"
        label={tc('back')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
      />

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">State Overview</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">
        SQAAF performance across Uttar Pradesh for the current assessment cycle. All figures on this
        page are placeholder data.
      </p>

      <StateOverviewContent />
    </div>
  );
}
