import { getPublicationOverview, getStatusReport, type DistrictStatusRow } from '@/lib/actions/programmeAdmin';
import { PublishControl } from '@/components/sssa/PublishControl';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GREEN = '#14603A';

/**
 * State, division and district status reporting, plus publication control.
 *
 * The thirteen pipeline states report in five buckets a review meeting can actually use;
 * the raw states stay available in the tables. Divisions are the mandals the geography
 * already carries.
 */

const BUCKETS: { key: string; label: string; states: string[]; colour: string }[] = [
  {
    key: 'self',
    label: 'Self assessment',
    states: ['SELF_ASSESSMENT_OPEN', 'NOT_SUBMITTED', 'NON_SUBMITTER'],
    colour: INK_MUTED,
  },
  {
    key: 'screening',
    label: 'Screening',
    states: ['SUBMITTED', 'AUTO_CHECK', 'DESK_SCREENING', 'VIDEO_WALKTHROUGH'],
    colour: NAVY,
  },
  { key: 'queues', label: 'Queued', states: ['CENSUS_QUEUE', 'FIELD_COHORT'], colour: NAVY_DEEP },
  {
    key: 'field',
    label: 'Field and review',
    states: ['FIELD_VISIT', 'DISCREPANCY_REVIEW', 'SCHOOL_RESPONSE_WINDOW'],
    colour: GOLD,
  },
  { key: 'published', label: 'Published', states: ['PUBLISHED'], colour: GREEN },
];

function bucketCounts(byState: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const bucket of BUCKETS) {
    out[bucket.key] = bucket.states.reduce((sum, s) => sum + (byState[s] ?? 0), 0);
  }
  return out;
}

export default async function ReportingPage() {
  const [report, publication] = await Promise.all([getStatusReport(), getPublicationOverview()]);
  if (!report || !publication) return <p className="text-sm text-gray-600">Not authorised.</p>;

  const stateBuckets = bucketCounts(report.stateTotals);
  const totalRuns = Object.values(report.stateTotals).reduce((s, n) => s + n, 0);

  // Division rollup: districts aggregated by their mandal.
  const divisions = new Map<string, { name: string; schools: number; buckets: Record<string, number>; districts: number }>();
  for (const d of report.districts) {
    const key = d.mandalCode ?? 'NONE';
    const entry = divisions.get(key) ?? {
      name: d.mandalName ?? 'Unassigned',
      schools: 0,
      buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, 0])),
      districts: 0,
    };
    entry.schools += d.schools;
    entry.districts += 1;
    const counts = bucketCounts(d.byState);
    for (const b of BUCKETS) entry.buckets[b.key] = (entry.buckets[b.key] ?? 0) + (counts[b.key] ?? 0);
    divisions.set(key, entry);
  }
  const divisionRows = [...divisions.values()].sort((a, b) => b.schools - a.schools);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Programme status
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          {report.totalSchools.toLocaleString('en-IN')} schools on the register,{' '}
          {totalRuns.toLocaleString('en-IN')} verification runs in this cycle.
        </p>
      </div>

      {/* State totals */}
      <div className="grid gap-3 sm:grid-cols-5">
        {BUCKETS.map((b) => (
          <div key={b.key} className="rounded-xl border-2 border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold" style={{ color: b.colour }}>
              {(stateBuckets[b.key] ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: INK_MUTED }}>
              {b.label}
            </p>
          </div>
        ))}
      </div>

      {/* Publication control */}
      <section className="rounded-xl border-2 bg-white p-5" style={{ borderColor: GREEN }}>
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Publication
        </h2>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          {publication.publishedCount.toLocaleString('en-IN')} verifications published so far.
          Publishing recomputes each school&apos;s public score from the verified record: claims
          corrected by upheld rulings, or field findings for non-submitters. A run with nothing
          verifiable is refused, not published blank.
        </p>
        <div className="mt-3">
          <PublishControl censusQueueCount={publication.censusQueueCount} />
        </div>

        {publication.recent.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
                  <th className="py-2 pr-3 font-bold">School</th>
                  <th className="py-2 pr-3 font-bold">District</th>
                  <th className="py-2 pr-3 text-right font-bold">Final score</th>
                  <th className="py-2 pr-3 font-bold">Band</th>
                  <th className="py-2 pr-3 text-right font-bold">Corrections</th>
                  <th className="py-2 font-bold">Published</th>
                </tr>
              </thead>
              <tbody>
                {publication.recent.map((r) => (
                  <tr key={r.runId} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-gray-900">{r.schoolName}</p>
                      <p className="font-mono text-xs" style={{ color: INK_MUTED }}>
                        {r.schoolUdise}
                      </p>
                    </td>
                    <td className="py-2 pr-3">{r.districtName}</td>
                    <td className="py-2 pr-3 text-right font-mono font-bold" style={{ color: NAVY_DEEP }}>
                      {r.finalScorePercent === null ? 'n/a' : `${r.finalScorePercent.toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-3 font-semibold">{r.gradeBandCode ?? 'n/a'}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.corrections}</td>
                    <td className="py-2 text-xs" style={{ color: INK_MUTED }}>
                      {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('en-IN') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Divisions */}
      <section className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            By division
          </h2>
        </div>
        <div className="overflow-x-auto">
          <StatusTable
            rows={divisionRows.map((d) => ({
              name: `${d.name} (${d.districts} districts)`,
              schools: d.schools,
              buckets: d.buckets,
            }))}
          />
        </div>
      </section>

      {/* Districts */}
      <section className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            By district
          </h2>
        </div>
        <div className="overflow-x-auto">
          <StatusTable
            rows={report.districts.map((d: DistrictStatusRow) => ({
              name: d.districtName,
              schools: d.schools,
              buckets: bucketCounts(d.byState),
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function StatusTable({
  rows,
}: {
  rows: { name: string; schools: number; buckets: Record<string, number> }[];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide" style={{ color: INK_MUTED }}>
          <th className="px-5 py-2 font-bold">Area</th>
          <th className="px-3 py-2 text-right font-bold">Schools</th>
          {BUCKETS.map((b) => (
            <th key={b.key} className="px-3 py-2 text-right font-bold">
              {b.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-gray-100">
            <td className="px-5 py-2 font-semibold text-gray-900">{r.name}</td>
            <td className="px-3 py-2 text-right font-mono">{r.schools.toLocaleString('en-IN')}</td>
            {BUCKETS.map((b) => (
              <td key={b.key} className="px-3 py-2 text-right font-mono" style={{ color: (r.buckets[b.key] ?? 0) > 0 ? b.colour : '#C6CDD8' }}>
                {(r.buckets[b.key] ?? 0).toLocaleString('en-IN')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
