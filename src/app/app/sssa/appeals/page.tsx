import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buildVerificationQueue } from '@/lib/sssa/verificationQueue';
import { LegacyAssignmentQueue } from '@/components/sssa/LegacyAssignmentQueue';

/**
 * The legacy assignment queue's home, and a redirect for everything else.
 *
 * This URL has been three things: the Appeals page of the first build, then the
 * renamed Verification page, then Appeals again with the manual queue behind a tab.
 * Appeals now live in the Decisions inbox, so a link that meant appeals redirects
 * there; only ?tab=legacy (or the old ?tab=todo) still renders here, serving the
 * original VerifierAssignment pathway until it is formally retired. Deliberately in
 * no sidebar: the Decisions page and the verifier profiles link in.
 */
export default async function LegacyQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  if (sp.tab !== 'legacy' && sp.tab !== 'todo') {
    redirect('/app/sssa/decisions?type=appeals');
  }

  const data = await buildVerificationQueue();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Legacy assignment queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manual verifier assignment from before the SQAAF pipeline. Appeals moved to{' '}
          <Link href="/app/sssa/decisions" className="underline hover:text-gray-700">
            Decisions
          </Link>
          .
        </p>
      </header>

      {!data ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No active cycle, so there is no queue.
        </div>
      ) : (
        <>
          {data.waiting > 0 && (
            <p className="max-w-[62ch] text-[16px] leading-relaxed text-gray-600">
              <b className="font-bold tabular-nums text-gray-900">
                {data.waiting.toLocaleString('en-IN')}
              </b>{' '}
              schools are waiting in the legacy queue. The oldest has waited{' '}
              <b className="font-bold tabular-nums text-[#C8372D]">{data.oldestDays} days</b>
              {data.unassigned > 0 && (
                <>
                  , and{' '}
                  <b className="font-bold tabular-nums text-[#C8372D]">
                    {data.unassigned.toLocaleString('en-IN')}
                  </b>{' '}
                  have nobody assigned
                </>
              )}
              .
            </p>
          )}
          <LegacyAssignmentQueue data={data} />
        </>
      )}
    </div>
  );
}
