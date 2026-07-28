import Link from 'next/link';
import { LevelBadge } from '@/components/public/LevelBadge';
import { deriveResultFields } from '@/lib/public/schoolProfile';
import type { PerformanceLevel } from '@/lib/public/constants';
import type { SchoolType } from '@/lib/public/constants';

export type FindResultRow = {
  udise: string;
  name: string;
  districtName: string;
  blockName: string;
};

function truncateName(name: string, max = 42): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function FindResultsTable({ rows }: { rows: FindResultRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-4 py-3">School Name</th>
            <th className="px-4 py-3">UDISE</th>
            <th className="px-4 py-3">District</th>
            <th className="px-4 py-3">Block</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Fee</th>
            <th className="px-4 py-3">Accreditation</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const extra = deriveResultFields(row.udise);
            return (
              <tr key={row.udise} className="hover:bg-gray-50">
                <td className="max-w-[220px] px-4 py-3">
                  <Link
                    href={`/public/schools/${row.udise}`}
                    className="font-bold text-[#1B2A6B] hover:underline"
                    title={row.name}
                  >
                    {truncateName(row.name)}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.udise}</td>
                <td className="px-4 py-3">{row.districtName}</td>
                <td className="px-4 py-3">{row.blockName}</td>
                <td className="px-4 py-3">{extra.type as SchoolType}</td>
                <td className="px-4 py-3">
                  <LevelBadge level={extra.performanceLevel as PerformanceLevel} />
                </td>
                <td className="px-4 py-3">
                  {extra.feeDisclosed ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Disclosed
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Not Disclosed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {extra.accreditation === 'SQAAF Verified' ? (
                    <span className="rounded-full bg-[#1B2A6B] px-2.5 py-0.5 text-xs font-medium text-white">
                      SQAAF Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/public/schools/${row.udise}`}
                    className="text-sm font-medium text-[#1B2A6B] hover:underline"
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
