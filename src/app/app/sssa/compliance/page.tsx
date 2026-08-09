import { buildCompliance } from '@/lib/sssa/compliance';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

function Count({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'red' | 'amber' | 'green';
}) {
  const color = tone === 'red' ? '#C8372D' : tone === 'amber' ? '#B8791A' : tone === 'green' ? '#1C7A4A' : '#111827';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums" style={{ color }}>
        {inr(value)}
      </div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
    </div>
  );
}

/**
 * Compliance: what schools owe regardless of the assessment cycle.
 *
 * The data has been collected since the portal launched and read by nobody at the
 * state. A school with a lapsed mandatory document was in open breach and invisible
 * — not because the fact was hard to compute, but because no page asked.
 */
export default async function CompliancePage() {
  const data = await buildCompliance();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Obligations schools owe regardless of the assessment cycle
        </p>
      </header>

      <p className="max-w-[62ch] text-[16.5px] leading-relaxed text-gray-600">
        <b className="font-bold tabular-nums text-[#C8372D]">{inr(data.expiredDocs)}</b> mandatory
        documents have lapsed. <b className="font-bold tabular-nums text-gray-900">{inr(data.missingDocs)}</b>{' '}
        schools are missing at least one, and{' '}
        <b className="font-bold tabular-nums text-gray-900">{inr(data.noFeeDisclosure)}</b> have not
        disclosed their fees.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count label="Expired documents" value={data.expiredDocs} sub="validity has passed" tone="red" />
        <Count label="Schools missing a document" value={data.missingDocs} sub="fewer held than expected" tone="amber" />
        <Count label="No fee disclosure" value={data.noFeeDisclosure} sub="no disclosure on file" tone="amber" />
        <Count label="Fully compliant" value={data.fullyCompliant} sub={`${data.totalSchools ? Math.round((data.fullyCompliant / data.totalSchools) * 100) : 0}% of schools`} tone="green" />
      </div>

      <section>
        <h2 className="text-base font-bold tracking-tight text-gray-900">Longest in breach</h2>
        <p className="mt-0.5 max-w-[74ch] text-xs text-gray-500">
          Ordered by how long the oldest current breach has stood — a lapse nobody has acted on for
          months is a different problem from one that happened last week.
        </p>

        {data.rows.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
            No school is in breach. Every mandatory document is current and every fee disclosure is
            on file.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">School</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">District</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Documents</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Expired</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-left font-bold">Fees</th>
                  <th className="border-b border-gray-100 px-4 py-3 text-right font-bold">Days in breach</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.district}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                      {r.documentsHeld} of {r.documentsExpected}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold tabular-nums"
                      style={{ color: r.expired ? '#C8372D' : '#9AA2B4' }}
                    >
                      {r.expired || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          r.feeDisclosed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {r.feeDisclosed ? 'Disclosed' : 'Not disclosed'}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold tabular-nums"
                      style={{
                        color:
                          r.daysInBreach == null
                            ? '#9AA2B4'
                            : r.daysInBreach > 90
                              ? '#C8372D'
                              : r.daysInBreach > 60
                                ? '#B8791A'
                                : '#111827',
                      }}
                    >
                      {r.daysInBreach ?? '—'}
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
