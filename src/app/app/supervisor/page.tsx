import Link from 'next/link';
import { getSupervisorOverview } from '@/lib/actions/supervisor';
import { AllocateForm } from '@/components/supervisor/AllocateForm';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

/**
 * The roster and turnaround view: who is doing the work, how much each is carrying, and how
 * long it takes them. The numbers deliberately count work, not people: certification and
 * de-empanelment state sit beside the counts because an uncertified verifier with a queue is
 * a configuration error someone should see here first.
 */
export default async function SupervisorHomePage() {
  const overview = await getSupervisorOverview();
  if (!overview) {
    return <p className="text-sm text-gray-600">Not authorised.</p>;
  }

  const online = overview.roster.filter((r) => r.cell === 'ONLINE');
  const field = overview.roster.filter((r) => r.cell === 'FIELD');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Verifier roster
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Your cell&apos;s verifiers, their load and their turnaround.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Unassigned desk cases" value={overview.unassignedDeskCases} />
        <StatCard
          label="Open escalations"
          value={overview.escalationsOpen}
          href="/app/supervisor/escalations"
        />
        <StatCard
          label="Discrepancy cases"
          value={overview.discrepancyCases}
          href="/app/supervisor/discrepancies"
        />
      </div>

      {overview.cells.includes('ONLINE') && (
        <section className="rounded-xl border-2 border-gray-200 bg-white p-5">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            Batch allocation
          </h2>
          <p className="mb-3 mt-1 text-sm" style={{ color: INK_MUTED }}>
            {overview.unassignedDeskCases} unassigned case
            {overview.unassignedDeskCases === 1 ? '' : 's'} in the desk screening queue. The server
            hands out the oldest first.
          </p>
          <AllocateForm
            verifiers={online
              .filter((v) => v.certification === 'CERTIFIED' && !v.deEmpanelledAt)
              .map((v) => ({ profileId: v.profileId, name: v.name, openCount: v.openCount }))}
            unassigned={overview.unassignedDeskCases}
          />
        </section>
      )}

      {(['ONLINE', 'FIELD'] as const)
        .filter((cell) => overview.cells.includes(cell))
        .map((cell) => {
          const rows = cell === 'ONLINE' ? online : field;
          return (
            <section key={cell} className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-5 py-3">
                <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
                  {cell === 'ONLINE' ? 'Online cell (desk screening)' : 'Field cell (physical visits)'}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
                      <th className="px-5 py-2 font-bold">Verifier</th>
                      <th className="px-3 py-2 font-bold">Status</th>
                      <th className="px-3 py-2 text-right font-bold">Open</th>
                      <th className="px-3 py-2 text-right font-bold">Completed</th>
                      <th className="px-3 py-2 text-right font-bold">Avg days</th>
                      <th className="px-3 py-2 text-right font-bold">Escalations</th>
                      <th className="px-5 py-2 text-right font-bold">Quality flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-4 text-sm" style={{ color: INK_MUTED }}>
                          No verifiers in this cell yet.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.profileId} className="border-t border-gray-100">
                        <td className="px-5 py-2.5 font-semibold text-gray-900">{r.name}</td>
                        <td className="px-3 py-2.5">
                          {r.deEmpanelledAt ? (
                            <span className="rounded-full bg-[#FBE9E7] px-2 py-0.5 text-xs font-bold text-[#96271E]">
                              De-empanelled
                            </span>
                          ) : r.certification === 'CERTIFIED' ? (
                            <span className="rounded-full bg-[#E7F5EE] px-2 py-0.5 text-xs font-bold text-[#14603A]">
                              Certified
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                              {r.certification.replaceAll('_', ' ').toLowerCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.openCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.completedCount}</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {r.avgTurnaroundDays === null ? 'n/a' : r.avgTurnaroundDays.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.escalationsOpen}</td>
                        <td className="px-5 py-2.5 text-right font-mono">{r.qualityFlags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
        {value.toLocaleString('en-IN')}
      </p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
        {label}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
