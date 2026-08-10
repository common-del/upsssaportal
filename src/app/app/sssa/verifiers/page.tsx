import { buildVerificationQueue } from '@/lib/sssa/verificationQueue';
import { VerificationTabs, type VerificationTab } from '@/components/sssa/VerificationTabs';

/**
 * Verification: the whole lifecycle of getting a school checked.
 *
 * Three tabs — waiting to be checked, score accepted, appealed. Appeals used to be
 * its own sidebar page, which split one process across two places and meant an
 * appealed school could not be read beside the verification it disputes.
 */
export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [data, sp] = await Promise.all([buildVerificationQueue(), searchParams]);
  // 'appealed' and 'accepted' are the previous names for these tabs, still live in
  // notification links and the /appeals redirect, so they resolve rather than
  // silently dropping someone on the wrong list.
  const tab: VerificationTab =
    sp.tab === 'settled' || sp.tab === 'accepted'
      ? 'settled'
      : sp.tab === 'decide' || sp.tab === 'appealed'
        ? 'decide'
        : 'todo';

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Verification</h1>
        <p className="mt-1 text-sm text-gray-500">
          Getting submissions checked, and what came of the ones already done
        </p>
      </header>

      {!data ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No active cycle. Activate one before assigning verifiers.
        </div>
      ) : (
        <>
          {tab === 'todo' && data.waiting > 0 && (
            <p className="max-w-[62ch] text-[16px] leading-relaxed text-gray-600">
              <b className="font-bold tabular-nums text-gray-900">
                {data.waiting.toLocaleString('en-IN')}
              </b>{' '}
              schools are waiting to be verified. The oldest has waited{' '}
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
