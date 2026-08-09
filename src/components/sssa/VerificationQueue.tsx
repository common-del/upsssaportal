import type { VerificationQueue as Data } from '@/lib/sssa/verificationQueue';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

function waitColor(days: number) {
  return days >= 14 ? '#C8372D' : days >= 7 ? '#B8791A' : '#111827';
}

/** Evidence attached against indicators answered. A thin ratio means the school is
 *  making claims it has not backed up, which changes what the verification is. */
function evidenceColor(evidenced: number, answered: number) {
  if (answered === 0) return '#9AA2B4';
  const ratio = evidenced / answered;
  return ratio < 0.5 ? '#C8372D' : ratio < 0.9 ? '#B8791A' : '#1C7A4A';
}

export function VerificationQueue({ data }: { data: Data }) {
  if (data.waiting === 0 && data.idle.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[64ch] text-[16.5px] leading-relaxed text-gray-600">
        {data.waiting > 0 ? (
          <>
            <b className="font-bold tabular-nums text-gray-900">{inr(data.waiting)}</b> schools are
            waiting to be verified. The oldest has waited{' '}
            <b className="font-bold tabular-nums text-[#C8372D]">{data.oldestDays} days</b>
            {data.unassigned > 0 && (
              <>
                , and <b className="font-bold tabular-nums text-gray-900">{inr(data.unassigned)}</b>{' '}
                have nobody assigned
              </>
            )}
            .
          </>
        ) : (
          <>Nothing is waiting to be verified.</>
        )}
      </p>

      {/* Idle capacity first when it exists: it is the fix for the queue below, and
          burying it under a 25-row table means nobody connects the two. */}
      {data.idle.length > 0 && data.waiting > 0 && (
        <section>
          <h2 className="text-base font-bold tracking-tight text-gray-900">
            Verifiers with nothing assigned
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Available capacity while {inr(data.waiting)} schools wait.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[460px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Capacity</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {data.idle.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      {v.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{v.district ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                      {v.capacity ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[#C8372D]">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.rows.length > 0 && (
        <section>
          <h2 className="text-base font-bold tracking-tight text-gray-900">The queue</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Showing {data.rows.length} of {inr(data.waiting)}, longest wait first. Evidence is
            attachments against indicators answered.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Waiting</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Evidence</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Verifier</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      {r.school}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.district}</td>
                    <td
                      className="px-4 py-3 text-right font-bold tabular-nums"
                      style={{ color: waitColor(r.daysWaiting) }}
                    >
                      {r.daysWaiting} {r.daysWaiting === 1 ? 'day' : 'days'}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold tabular-nums"
                      style={{ color: evidenceColor(r.evidenced, r.answered) }}
                    >
                      {r.evidenced} of {r.answered}
                    </td>
                    <td className="px-4 py-3">
                      {r.verifier ? (
                        <span className="text-gray-700">{r.verifier}</span>
                      ) : (
                        <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                          Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
