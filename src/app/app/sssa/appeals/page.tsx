import Link from 'next/link';
import { buildAppeals, type Scored } from '@/lib/sssa/appeals';

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
 * One list, no tab bar. The by-verifier table that used to sit beside it has moved
 * to Users, where the same people were already listed twice over — a verifier's
 * appeal rate and their caseload answer one question together, and neither page
 * held both.
 */
export default async function AppealsPage() {
  const data = await buildAppeals();
  const outstanding = data.open;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Raised by schools against their verification
          </p>
        </div>
        {outstanding > 0 && (
          <p className="text-[13px] tabular-nums text-gray-500">
            <b style={{ color: '#C8372D' }}>{outstanding.toLocaleString('en-IN')}</b> waiting on a
            decision
          </p>
        )}
      </header>

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
    </div>
  );
}
