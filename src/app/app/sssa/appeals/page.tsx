import Link from 'next/link';
import { buildAppeals, type Scored } from '@/lib/sssa/appeals';
import { AppealsTabs, type AppealsTab } from '@/components/sssa/AppealsTabs';

const NAVY = '#1B2A6B';

/**
 * A score over the band it falls in.
 *
 * One decimal, not rounded to whole. Two indicators out of dozens move a
 * weighted percentage by a few tenths, so rounding printed a school's self score
 * and its verified score as the same number and made the appeal look like a
 * mistake. The band underneath is what actually matters to a school — a tenth of
 * a point either side of 40 is the difference between Needs Improvement and
 * Satisfactory.
 */
function Score({ value, tone = 'ink' }: { value: Scored; tone?: 'ink' | 'red' | 'green' }) {
  if (value.score == null) return <span className="text-gray-400">—</span>;
  const color = tone === 'red' ? '#C8372D' : tone === 'green' ? '#1C7A4A' : '#111827';
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-bold tabular-nums" style={{ color }}>
        {value.score.toFixed(1)}
      </span>
      {value.band && <span className="text-[10.5px] text-gray-500">{value.band}</span>}
    </span>
  );
}

/**
 * Appeals: schools disputing their verification.
 *
 * Kept separate from Complaints, which is the public complaining about a school.
 * These are different objects with different resolution paths — an Appeal is argued
 * indicator by indicator and only SSSA decides it, while a Ticket escalates on a
 * clock through three levels. They were one queue and the merge hid both.
 *
 * The two tables are tabs rather than a stack. One is a worklist, the other is a
 * pattern across verifiers; reading either does not help you read the other.
 */
export default async function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const data = await buildAppeals();
  const sp = await searchParams;
  const tab: AppealsTab = sp.tab === 'verifier' ? 'verifier' : 'appeals';

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
        <p className="mt-1 text-sm text-gray-500">Raised by schools against their verification</p>
      </header>

      <AppealsTabs
        active={tab}
        appealCount={data.rows.length}
        verifierCount={data.byVerifier.length}
        pending={data.open}
      />

      {tab === 'appeals' ? (
        <section>
          <p className="text-xs text-gray-500">
            One appeal per school per cycle. Final is the verified score with the school&apos;s answer
            restored wherever an appeal was upheld.
          </p>

          {data.rows.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
              No school has appealed this cycle.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[920px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Block</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Self</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Verified</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Final</th>
                    <th className="border-b border-gray-100 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                        {r.school}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.district}</td>
                      <td className="px-4 py-3 text-gray-700">{r.block ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.verifier ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Score value={r.self} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Score value={r.verified} tone="red" />
                      </td>
                      {/* Green only when the appeal actually moved it — otherwise Final is
                          simply the verified score and colour would imply a change. */}
                      <td className="px-4 py-3 text-right">
                        <Score
                          value={r.final}
                          tone={
                            r.final.score != null &&
                            r.verified.score != null &&
                            r.final.score > r.verified.score
                              ? 'green'
                              : 'ink'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/app/sssa/finalization/appeal/${r.udise}`}
                          className="inline-block rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-gray-50"
                          style={{ borderColor: NAVY, color: NAVY }}
                        >
                          {r.pending ? 'Decide' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section>
          <p className="text-xs text-gray-500">
            Verifiers with at least 20 completed verifications. A verifier appealed against far more
            often than their peers, and upheld most of the time, is a scoring problem rather than a
            run of aggrieved schools.
          </p>

          {data.byVerifier.length === 0 ? (
            // Says which of the two reasons applies, because "no rows" here means
            // either nobody has been appealed against or nobody has verified enough
            // to be measured, and those call for opposite responses.
            <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-[13px] text-gray-500">
              Nothing to compare yet. Either no appeal names a verifier, or no verifier has reached
              20 completed verifications — below that, an appeal rate is noise.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Verified</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Appealed</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Rate</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Upheld</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byVerifier.map((v) => {
                    const rate = v.appealed / v.verified;
                    const upheld = v.appealed ? v.upheld / v.appealed : 0;
                    return (
                      <tr key={v.verifierId} className="border-t border-gray-100 first:border-t-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/sssa/users/${v.verifierId}`}
                            className="font-semibold hover:underline"
                            style={{ color: NAVY }}
                          >
                            {v.verifier}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{v.verified}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{v.appealed}</td>
                        <td
                          className="px-4 py-3 text-right font-bold tabular-nums"
                          style={{ color: rate > 0.2 ? '#C8372D' : rate > 0.1 ? '#B8791A' : '#111827' }}
                        >
                          {Math.round(rate * 100)}%
                        </td>
                        <td
                          className="px-4 py-3 text-right font-bold tabular-nums"
                          style={{ color: upheld > 0.5 ? '#C8372D' : '#6B7280' }}
                        >
                          {Math.round(upheld * 100)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
