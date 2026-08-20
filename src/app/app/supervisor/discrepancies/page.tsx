import Link from 'next/link';
import { getDiscrepancyQueue } from '@/lib/actions/supervisor';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

export default async function DiscrepanciesPage() {
  const rows = await getDiscrepancyQueue();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Discrepancy review
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases where the field visit found something other than what the school claimed. Open
          the school&apos;s response window, read any response, then rule and publish or refer
          the case back for a re-visit.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          Nothing is waiting for review.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.runId}
              href={`/app/supervisor/discrepancies/${r.runId}`}
              className="block rounded-xl border-2 border-gray-200 bg-white p-4 hover:border-gray-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-bold" style={{ color: NAVY_DEEP }}>
                    {r.schoolName}
                  </p>
                  <p className="text-sm" style={{ color: INK_MUTED }}>
                    {r.districtName} · <span className="font-mono text-xs">{r.schoolUdise}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: NAVY }}>
                    {r.discrepancies} discrepanc{r.discrepancies === 1 ? 'y' : 'ies'}
                  </span>
                  {r.state === 'SCHOOL_RESPONSE_WINDOW' ? (
                    r.hasResponse ? (
                      <span className="rounded-full bg-[#E7F5EE] px-3 py-1 text-xs font-bold text-[#14603A]">
                        School responded, ready to rule
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#FDF8EC] px-3 py-1 text-xs font-bold text-[#7A5209]">
                        Window open
                        {r.windowClosesAt && ` until ${new Date(r.windowClosesAt).toLocaleDateString('en-IN')}`}
                      </span>
                    )
                  ) : (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                      Awaiting window
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
