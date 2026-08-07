import { redirect } from 'next/navigation';

/** Folded into /app/sssa. Kept as a redirect because these URLs are linked from
 *  elsewhere in the app and are likely bookmarked - the query carries over so a
 *  saved mandal view still lands on the same scope. */
export default async function LegacyMandalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mandal?: string; district?: string; block?: string }>;
}) {
  const { mandal, district, block } = await searchParams;
  const params = new URLSearchParams();
  if (mandal) params.set('mandal', mandal);
  if (district) params.set('district', district);
  if (block) params.set('block', block);
  const qs = params.toString();
  redirect(`/app/sssa${qs ? `?${qs}` : ''}`);
}
