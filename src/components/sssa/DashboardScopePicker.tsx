'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { DistrictOption } from '@/lib/sssa/stateDashboard';

/**
 * Which set of schools the page is about.
 *
 * A search parameter rather than component state, so the narrowed view is shareable, survives a
 * refresh, and lets Back step out of it. Everything on the page except the district ranking reads
 * from the same clause on the server, so nothing here has to know what it changes.
 */
export function DashboardScopePicker({
  districts,
  selected,
}: {
  districts: DistrictOption[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <span className="flex items-center gap-2">
      <label htmlFor="scope-district" className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        Showing
      </label>
      <select
        id="scope-district"
        value={selected ?? ''}
        onChange={(e) => router.push(e.target.value ? `${pathname}?district=${e.target.value}` : pathname)}
        className="min-h-[38px] rounded-lg border bg-white px-3 py-1.5 text-[13px] font-semibold focus:outline-none focus:ring-1"
        style={{ borderColor: selected ? '#1B2A6B' : '#D6DCE7', color: '#1B2A6B' }}
      >
        <option value="">All of Uttar Pradesh</option>
        {districts.map((d) => (
          <option key={d.code} value={d.code}>
            {d.name}
          </option>
        ))}
      </select>
    </span>
  );
}
