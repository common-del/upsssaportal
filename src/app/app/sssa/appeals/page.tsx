import Link from 'next/link';
import { buildAppeals } from '@/lib/sssa/appeals';

const NAVY = '#1B2A6B';

/**
 * Appeals: schools disputing their verification.
 *
 * Kept separate from Complaints, which is the public complaining about a school.
 * These are different objects with different resolution paths — an Appeal is argued
 * indicator by indicator and only SSSA decides it, while a Ticket escalates on a
 * clock through three levels. They were one queue and the merge hid both.
 */
export default async function AppealsPage() {
  const data = await buildAppeals();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
        <p className="mt-1 text-sm text-gray-500">Raised by schools against their verification</p>
      </header>


      <section>
        <h2 className="text-base font-bold tracking-tight text-gray-900">Open appeals</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          One appeal per school per cycle. Indicators shows those still undecided.
        </p>

        {data.rows.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
            No school has appealed this cycle.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Indicators</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">School said</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Verifier said</th>
                  <th className="border-b border-gray-100 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3">
                      <span className="block font-semibold" style={{ color: NAVY }}>
                        {r.school}
                      </span>
                      <span className="text-xs text-gray-500">{r.district}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.verifier ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <b style={{ color: r.pending ? '#C8372D' : '#1C7A4A' }}>{r.pending}</b>
                      <span className="text-gray-500"> of {r.items}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                      {r.selfScore != null ? Math.round(r.selfScore) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: '#C8372D' }}>
                      {r.verifierScore != null ? Math.round(r.verifierScore) : '—'}
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

      {data.byVerifier.length > 0 && (
        <section>
          <h2 className="text-base font-bold tracking-tight text-gray-900">Appeals by verifier</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Verifiers with at least 20 completed verifications.
          </p>
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
                    <tr key={v.verifier} className="border-t border-gray-100 first:border-t-0">
                      <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                        {v.verifier}
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
        </section>
      )}
    </div>
  );
}
