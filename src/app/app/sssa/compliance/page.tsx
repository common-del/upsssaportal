import { buildCompliance } from '@/lib/sssa/compliance';
import { PageHeader, Section, StatCard, StatGrid, Table, Th, Td, Pill } from '@/components/sssa/ui';

const inr = (n: number) => n.toLocaleString('en-IN');

export default async function CompliancePage() {
  const data = await buildCompliance();
  const pctTracked = data.totalSchools
    ? Math.round((data.schoolsWithDocRecords / data.totalSchools) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Compliance" subtitle="Mandatory documents and fee disclosure" />

      {/* Until most of the register carries records, these figures describe the
          import rather than the schools. Saying so is the difference between a
          coverage gap and a compliance crisis. */}
      {!data.tracked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Document and fee records exist for {inr(data.schoolsWithDocRecords)} of{' '}
          {inr(data.totalSchools)} schools ({pctTracked}%). Figures below cover only those schools.
          The rest have not been assessed rather than found in breach.
        </div>
      )}

      <StatGrid>
        <StatCard label="Expired documents" value={data.expiredDocs} tone="red" />
        <StatCard label="Incomplete sets" value={data.incompleteDocs} tone="amber" />
        <StatCard label="No fee disclosure" value={data.noFeeDisclosure} tone="amber" />
        <StatCard label="Compliant" value={data.fullyCompliant} tone="green" />
      </StatGrid>

      <Section title="Longest in breach">
        {data.rows.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600">
            No school with records is in breach.
          </p>
        ) : (
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>School</Th>
                <Th>District</Th>
                <Th align="right">Documents</Th>
                <Th align="right">Expired</Th>
                <Th>Fees</Th>
                <Th align="right">Days</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.udise} className="border-t border-gray-100 first:border-t-0">
                  <Td strong>{r.name}</Td>
                  <Td>{r.district}</Td>
                  <Td align="right" muted>
                    {r.documentsHeld} of {r.documentsExpected}
                  </Td>
                  <Td align="right" tone={r.expired ? 'red' : 'muted'} bold>
                    {r.expired || '—'}
                  </Td>
                  <Td>
                    <Pill tone={r.feeDisclosed ? 'green' : 'red'}>
                      {r.feeDisclosed ? 'Disclosed' : 'Not disclosed'}
                    </Pill>
                  </Td>
                  <Td
                    align="right"
                    bold
                    tone={
                      r.daysInBreach == null
                        ? 'muted'
                        : r.daysInBreach > 90
                          ? 'red'
                          : r.daysInBreach > 60
                            ? 'amber'
                            : 'default'
                    }
                  >
                    {r.daysInBreach ?? '—'}
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
