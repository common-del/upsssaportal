import { getDriftReport } from '@/lib/actions/supervisor';
import { DRIFT_MIN_BUCKET } from '@/lib/verification/drift';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';

/**
 * The risk algorithm drift monitor. Distribution of risk scores by month, with flags where
 * a month moved against the running baseline. The screen exists to be looked at monthly and
 * referred onwards, so it renders as plain bars rather than a chart library: a shift you can
 * see at 720p on a table read aloud in a review meeting.
 */
export default async function DriftPage() {
  const report = await getDriftReport();
  if (!report) return <p className="text-sm text-gray-600">Not authorised.</p>;

  const maxCount = Math.max(1, ...report.buckets.map((b) => b.count));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Risk algorithm drift
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Risk scores by month. A flagged month moved against the baseline of everything before
          it and should be referred to the platform vendor with this page&apos;s numbers. Months
          under {DRIFT_MIN_BUCKET} screenings are shown but never flagged.
        </p>
      </div>

      {report.flags.length > 0 && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: RED, backgroundColor: '#FBE9E7' }}>
          <p className="text-sm font-bold" style={{ color: RED }}>
            {report.flags.length} shift{report.flags.length === 1 ? '' : 's'} flagged for referral
          </p>
          <ul className="mt-2 space-y-1">
            {report.flags.map((f, i) => (
              <li key={i} className="text-sm" style={{ color: RED }}>
                <span className="font-mono font-bold">{f.bucketKey}</span>{' '}
                {f.kind === 'MEAN_SHIFT' ? 'mean shift' : 'above-threshold share shift'}: {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
                <th className="px-5 py-2 font-bold">Month</th>
                <th className="px-3 py-2 font-bold">Screenings</th>
                <th className="px-3 py-2 text-right font-bold">Mean score</th>
                <th className="px-5 py-2 text-right font-bold">Above threshold</th>
              </tr>
            </thead>
            <tbody>
              {report.buckets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-4" style={{ color: INK_MUTED }}>
                    No risk scores computed yet. This fills as desk screening completes.
                  </td>
                </tr>
              )}
              {report.buckets.map((b) => {
                const flagged = report.flags.some((f) => f.bucketKey === b.key);
                return (
                  <tr key={b.key} className="border-t border-gray-100" style={flagged ? { backgroundColor: '#FBE9E7' } : undefined}>
                    <td className="px-5 py-2.5 font-mono font-bold" style={{ color: flagged ? RED : NAVY_DEEP }}>
                      {b.key}
                      {flagged && ' ▲'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3 rounded-full" style={{ width: `${Math.max(2, (b.count / maxCount) * 160)}px`, backgroundColor: NAVY }} />
                        <span className="font-mono text-xs">{b.count.toLocaleString('en-IN')}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{b.meanScore.toFixed(1)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{b.aboveThresholdPct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
