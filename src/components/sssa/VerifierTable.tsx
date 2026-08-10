import Link from 'next/link';
import type { VerifierListRow } from '@/lib/sssa/verifierList';

const NAVY = '#1B2A6B';
const RED = '#C8372D';

const th =
  'border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-wider text-gray-500';

/**
 * Every verifier, their caseload and how their scoring is holding up.
 *
 * These columns used to be two tables on two pages — Verification knew what each
 * verifier was carrying, Appeals knew how often their scoring was contested — plus
 * a third page nobody could reach. Read apart, neither told you anything: a high
 * appeal rate on four verifications is noise, and a heavy caseload says nothing
 * about whether the work is any good.
 */
export function VerifierTable({ rows }: { rows: VerifierListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-7 text-center text-[13px] text-gray-500">
        No verifier accounts yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
        <thead>
          <tr>
            <th className={`${th} text-left`}>Verifier</th>
            <th className={`${th} text-left`}>District</th>
            <th className={`${th} text-right`}>Assigned</th>
            <th className={`${th} text-right`}>Checked</th>
            <th className={`${th} text-right`}>Appealed</th>
            <th className={`${th} text-right`}>Upheld</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const upheldPct = v.appealed > 0 ? v.upheld / v.appealed : null;
            return (
              <tr key={v.id} className="border-t border-gray-100 first:border-t-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/sssa/users/${v.id}`}
                    className="font-semibold hover:underline"
                    style={{ color: NAVY }}
                  >
                    {v.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{v.district ?? '—'}</td>
                <td
                  className="px-4 py-3 text-right font-bold tabular-nums"
                  style={{ color: v.assigned === 0 ? RED : '#111827' }}
                >
                  {v.assigned}
                  <span className="font-normal text-gray-500"> of {v.capacity}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{v.checked}</td>

                {/* Withheld rather than shown with a caveat: one appeal against three
                    verifications is 33% and describes the sample, not the verifier. */}
                <td className="px-4 py-3 text-right tabular-nums">
                  {v.appealRate == null ? (
                    <span className="text-gray-400" title="Fewer than 20 verifications checked">
                      —
                    </span>
                  ) : (
                    <span
                      className="font-bold"
                      style={{
                        color:
                          v.appealRate > 0.2 ? RED : v.appealRate > 0.1 ? '#B8791A' : '#111827',
                      }}
                    >
                      {Math.round(v.appealRate * 100)}%
                      <span className="font-normal text-gray-500"> · {v.appealed}</span>
                    </span>
                  )}
                </td>

                {/* Upheld is the column that matters. A verifier appealed against
                    often and overruled most times is scoring badly; appealed often and
                    upheld rarely is scoring strictly, which is their job. */}
                <td className="px-4 py-3 text-right tabular-nums">
                  {upheldPct == null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span
                      className="font-bold"
                      style={{ color: upheldPct > 0.5 ? RED : '#6B7280' }}
                    >
                      {Math.round(upheldPct * 100)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
