import { notFound } from 'next/navigation';
import { BackButton } from '@/components/common/BackButton';
import { MANDALS, districtSqaafStats } from '@/lib/public/dummyData';

export default async function MandalDistrictsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const mandal = MANDALS.find((m) => m.code === code);
  if (!mandal) notFound();

  const rows = mandal.districts.map(districtSqaafStats);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BackButton
        fallbackHref="/public"
        label="Back to homepage"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#1B2A6B] hover:underline"
      />

      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">{mandal.name} Mandal</h1>
      <p className="mt-2 text-sm text-gray-600">
        {mandal.districts.length} districts · SQAAF submission analytics
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">District</th>
              <th className="px-3 py-2">Total Schools</th>
              <th className="px-3 py-2">Government Schools</th>
              <th className="px-3 py-2">Govt Aided Schools</th>
              <th className="px-3 py-2">Private Schools</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2">Teachers</th>
              <th className="px-3 py-2">SQAAF Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.district} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-[#1B2A6B]">{row.district}</td>
                <td className="px-3 py-2">{row.totalSchools.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.govt.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.aided.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.private.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.students.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.teachers.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{row.verified.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
