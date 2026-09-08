import { redirect } from 'next/navigation';

/**
 * Verification became Appeals in the consolidation: the SQAAF pipeline assigns
 * verifiers itself, so of this page's two queues only Appeals was still SSSA's own
 * work, and the page moved to /app/sssa/appeals under that name. The manual queue
 * survives there as the Legacy queue tab.
 *
 * Kept as a redirect rather than deleted: this route is live in notification links
 * and bookmarks, and a dead URL teaches nobody where the page went. The mapping
 * preserves what the caller was looking at — a link without ?tab= meant the old
 * first tab, the assignment queue, so it opens the Legacy queue rather than Appeals.
 */
export default async function VerificationMovedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const wantsAppeals = sp.tab === 'appeals' || sp.tab === 'decide' || sp.tab === 'appealed';
  redirect(wantsAppeals ? '/app/sssa/appeals' : '/app/sssa/appeals?tab=legacy');
}
