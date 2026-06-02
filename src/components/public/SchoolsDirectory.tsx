'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DISTRICTS, SCHOOL_TYPES } from '@/lib/public/constants';
import { SCHOOLS, type SchoolRecord } from '@/lib/public/dummyData';

const PAGE_SIZE = 8;

const LEVEL_BADGE: Record<string, string> = {
  Primary: 'bg-gray-200 text-gray-800',
  'Upper Primary': 'bg-blue-100 text-blue-800',
  Secondary: 'bg-green-100 text-green-800',
  'Higher Secondary': 'bg-purple-100 text-purple-800',
};

export function SchoolsDirectory() {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('All Districts');
  const [type, setType] = useState('All Types');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return SCHOOLS.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.udise.includes(q);
      const matchDistrict =
        district === 'All Districts' || s.district === district;
      const matchType = type === 'All Types' || s.type === type;
      return matchSearch && matchDistrict && matchType;
    });
  }, [search, district, type]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Schools Directory</h1>

      <div className="mt-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or UDISE..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          />
        </div>
        <select
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option>All Districts</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
        >
          <option>All Types</option>
          {SCHOOL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        <span className="font-semibold text-[#1B2A6B]">{filtered.length}</span> schools found
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
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
            {pageItems.map((school) => (
              <SchoolRow key={school.id} school={school} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SchoolRow({ school }: { school: SchoolRecord }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{school.name}</td>
      <td className="px-4 py-3 text-gray-600">{school.udise}</td>
      <td className="px-4 py-3">{school.district}</td>
      <td className="px-4 py-3">{school.block}</td>
      <td className="px-4 py-3">{school.type}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            LEVEL_BADGE[school.level],
          )}
        >
          {school.level}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            school.feeDisclosed
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800',
          )}
        >
          {school.feeDisclosed ? 'Disclosed' : 'Not Disclosed'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            school.accreditation === 'SQAAF Verified'
              ? 'bg-[#1B2A6B] text-white'
              : 'bg-gray-200 text-gray-700',
          )}
        >
          {school.accreditation}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/public/schools/${school.udise}`}
          className="font-medium text-[#1B2A6B] hover:underline"
        >
          View Details →
        </Link>
      </td>
    </tr>
  );
}
