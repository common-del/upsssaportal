import { buildVerificationQueue } from '@/lib/sssa/verificationQueue';
import { VerificationTabs, type VerificationTab } from '@/components/sssa/VerificationTabs';

/**
 * Appeals, with the legacy assignment queue behind a second tab.
 *
 * This page was called Verification when SSSA assigned every school to a verifier by
 * hand. The SQAAF pipeline does assignment itself now — masked desk batches and the
 * seeded field cohort — so of the page's two queues only Appeals is still SSSA's own
 * work, and the page is named for what it is for. The manual queue is not deleted,
 * because the original VerifierAssignment screens still run on it; it sits behind the
 * Legacy queue tab until that pathway is formally retired.
 */
export default async function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [data, sp] = await Promise.all([buildVerificationQueue(), searchParams]);
  // 'todo' is the old first tab's id and 'legacy' its new name, so both open the
  // legacy queue. Anything else — including 'decide' and 'appealed', earlier names
  // still live in notification links — lands on Appeals, the page's own name.
  const tab: VerificationTab = sp.tab === 'todo' || sp.tab === 'legacy' ? 'todo' : 'appeals';

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Appeals waiting on an SSSA decision, with the legacy manual assignment queue
        </p>
      </header>

      {!data ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No active cycle. Appeals arrive once one is running.
        </div>
      ) : (
        <>
          {tab === 'todo' && data.waiting > 0 && (
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
          <VerificationTabs data={data} initialTab={tab} />
        </>
      )}
    </div>
  );
}
