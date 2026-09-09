import { redirect } from 'next/navigation';

/**
 * The page once called Verification. Its appeals half now lives in the Decisions
 * inbox; its manual assignment half is the legacy queue at /app/sssa/appeals. This
 * redirect preserves what the caller was looking at: a link without ?tab= meant the
 * old first tab, the assignment queue.
 */
export default async function VerificationMovedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const wantsAppeals = sp.tab === 'appeals' || sp.tab === 'decide' || sp.tab === 'appealed';
  redirect(wantsAppeals ? '/app/sssa/decisions?type=appeals' : '/app/sssa/appeals?tab=legacy');
}
