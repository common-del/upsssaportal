import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildCompliance, type ProfileStatus } from '@/lib/sssa/compliance';
import { MANAGEMENT_CODES, MANAGEMENT_LABELS_SHORT } from '@/lib/schoolManagement';
import { PageHeader, Section, StatCard, StatGrid, Table, Th, Td } from '@/components/sssa/ui';

const NAVY = '#1B2A6B';
const inr = (n: number) => n.toLocaleString('en-IN');

const STATUS_STYLE: Record<ProfileStatus, string> = {
  COMPLETE: 'bg-[#E7F5EE] text-[#14603A]',
  PARTIAL: 'bg-[#FBF1DE] text-[#7A5209]',
  EMPTY: 'bg-[#FBE9E7] text-[#96271E]',
};

/**
 * Compliance: whether each school has completed its profile.
 *
 * It used to carry four tallies — expired documents, incomplete sets, no fee
 * disclosure, compliant — and a table of document counts, which were four readings
 * of the same four facts. One status per school says all of it, and the row says how
 * many of the parts that apply to that school are still missing.
 */
export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; management?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filters = {
    district: sp.district ?? '',
    management: sp.management ?? '',
    // Incomplete by default: this page is a worklist, and the schools that have
    // finished are not the ones anybody opened it to find.
    status: sp.status ?? 'incomplete',
    q: sp.q ?? '',
  };

  const [data, districts] = await Promise.all([
    buildCompliance(filters),
    prisma.district.findMany({ select: { nameEn: true }, orderBy: { nameEn: 'asc' } }),
  ]);

  const pctDocs = data.totalSchools
    ? Math.round((data.schoolsWithDocRecords / data.totalSchools) * 100)
    : 0;

  const selectCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Compliance" subtitle="Whether each school has completed its profile" />

      {/* Until most of the register carries records, these figures describe the
          import rather than the schools. Saying so is the difference between a
          coverage gap and a compliance crisis — without it this page reports tens of
          thousands of schools in breach of obligations nobody has asked them about. */}
      {!data.tracked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b className="font-semibold">These figures describe the import, not compliance.</b>{' '}
          {inr(data.schoolsWithDocRecords)} of {inr(data.totalSchools)} schools ({pctDocs}%) have
          ever uploaded a document and {inr(data.schoolsWithFeeRecords)} have disclosed fees. Until
          that changes, incomplete mostly means nobody has collected the information yet.
        </div>
      )}

      <StatGrid>
        <StatCard label="Profile complete" value={data.complete} tone="green" />
        <StatCard label="Partly filled" value={data.partial} tone="amber" />
        <StatCard label="Nothing entered" value={data.empty} tone="red" />
      </StatGrid>

      <Section
        title="Schools"
        note="A profile is the school's address, contact number, fee disclosure and mandatory documents. Government schools are not asked to disclose fees, so theirs is three parts."
      >
        {/* A plain form, so the page stays server-rendered and a filtered view is a
            URL somebody can send. */}
        <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search school or UDISE"
            className="min-w-[190px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[12.5px] focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          />
          <select name="district" defaultValue={filters.district} className={selectCls}>
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.nameEn} value={d.nameEn}>
                {d.nameEn}
              </option>
            ))}
          </select>
          <select name="management" defaultValue={filters.management} className={selectCls}>
            <option value="">All management</option>
            {MANAGEMENT_CODES.map((c) => (
              <option key={c} value={MANAGEMENT_LABELS_SHORT[c]}>
                {MANAGEMENT_LABELS_SHORT[c]}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={filters.status} className={selectCls}>
            <option value="incomplete">Incomplete</option>
            <option value="complete">Complete</option>
            <option value="">All</option>
          </select>
          <button
            type="submit"
            className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Apply
          </button>
        </form>

        {/* Says what it is not showing. A capped table that reports only its own
            length reads as the whole answer. */}
        <p className="mb-2 text-[12.5px] tabular-nums text-gray-500">
          {data.matched === 0
            ? 'No school matches those filters.'
            : data.rows.length < data.matched
              ? `Showing ${inr(data.rows.length)} of ${inr(data.matched)} matching schools, most incomplete first.`
              : `${inr(data.matched)} ${data.matched === 1 ? 'school' : 'schools'}.`}
        </p>

        {data.rows.length > 0 && (
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>School</Th>
                <Th>District</Th>
                <Th>Block</Th>
                <Th>Management</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                  <Td strong>
                    {r.name}
                    <span className="mt-0.5 block font-mono text-[10.5px] font-normal text-gray-400">
                      {r.udise}
                    </span>
                  </Td>
                  <Td>{r.district}</Td>
                  <Td>{r.block}</Td>
                  <Td>
                    {r.management ?? <span className="text-gray-400">Not recorded</span>}
                  </Td>
                  <Td>
                    {/* The count is the useful half. "2 of 4 missing" is a different
                        conversation from "nothing entered", and both are different from
                        done. */}
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status === 'COMPLETE'
                        ? 'Complete'
                        : r.status === 'EMPTY'
                          ? 'Nothing entered'
                          : `${r.missing} of ${r.applicable} missing`}
                    </span>
                  </Td>
                  <Td align="right">
                    <Link
                      href={`/app/sssa/monitoring/schools/${r.udise}`}
                      className="whitespace-nowrap text-[12px] font-bold hover:underline"
                      style={{ color: NAVY }}
                    >
                      View profile →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
