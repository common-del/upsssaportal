'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WorkforceFilterValues } from '@/lib/sssa/workforce';

/**
 * Four controls above the verifier table: search, type, district, status.
 *
 * Built like the school register's bar and for the same reason: every filter is a search
 * parameter, so the page stays server-rendered, a filtered view is shareable, and Back steps
 * through the filters the way people expect. Search debounces because typing a name is eleven
 * keystrokes; the menus navigate at once because a menu is one decision.
 */

const NAVY = '#1B2A6B';

type Option = { value: string; label: string };

const isSet = (v: string) => v.trim() !== '';

function Select({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const on = isSet(value);
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1"
        style={{
          borderColor: on ? NAVY : '#D6DCE7',
          color: on ? NAVY : '#3C4A61',
          fontWeight: on ? 600 : 400,
          backgroundColor: on ? '#F5F8FD' : '#FFFFFF',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function WorkforceFilters({
  selected,
  districts,
  total,
  matched,
}: {
  selected: WorkforceFilterValues;
  /** District names anybody is rostered to. Empty when nobody has a roster, in which case the
   *  menu is not offered rather than offered and useless. */
  districts: string[];
  total: number;
  matched: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(selected.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQ(selected.q);
  }, [selected.q]);

  function navigate(updates: Partial<WorkforceFilterValues>) {
    const next = { ...selected, ...updates };
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (isSet(value)) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navigate({ q: value }), 350);
  }

  const anyFilter =
    isSet(selected.q) || isSet(selected.cell) || isSet(selected.district) || isSet(selected.status);

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <span className="flex min-w-0 flex-col gap-1">
          <label htmlFor="wf-q" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search
          </label>
          <input
            id="wf-q"
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name or username"
            className="rounded-lg border px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1"
            style={{ borderColor: isSet(q) ? NAVY : '#D6DCE7', color: '#3C4A61' }}
          />
        </span>

        <Select
          id="wf-cell"
          label="Type"
          value={selected.cell}
          options={[
            { value: 'ONLINE', label: 'Desk' },
            { value: 'FIELD', label: 'Field' },
          ]}
          placeholder="All verifiers"
          onChange={(v) => navigate({ cell: v })}
        />

        {districts.length > 0 ? (
          <Select
            id="wf-district"
            label="District"
            value={selected.district}
            options={districts.map((d) => ({ value: d, label: d }))}
            placeholder="All districts"
            onChange={(v) => navigate({ district: v })}
          />
        ) : (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">District</span>
            <span className="rounded-lg border border-dashed px-3 py-2 text-[12.5px] text-gray-400" style={{ borderColor: '#D6DCE7' }}>
              Nobody has a district roster
            </span>
          </span>
        )}

        <Select
          id="wf-status"
          label="Status"
          value={selected.status}
          options={[
            { value: 'CERTIFIED', label: 'Certified' },
            { value: 'NOT_CERTIFIED', label: 'Not certified' },
            { value: 'DE_EMPANELLED', label: 'Removed' },
          ]}
          placeholder="Any status"
          onChange={(v) => navigate({ status: v })}
        />
      </div>

      <p className="flex flex-wrap items-baseline gap-2 text-[12.5px] text-gray-600">
        <span>
          <b className="text-gray-900">{matched.toLocaleString('en-IN')}</b>
          {anyFilter && <> of {total.toLocaleString('en-IN')}</>}{' '}
          {matched === 1 ? 'verifier' : 'verifiers'}
        </span>
        {isSet(selected.district) && (
          <span className="text-gray-500">
            including anyone rostered statewide, who can work there too.
          </span>
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="font-semibold underline"
            style={{ color: NAVY }}
          >
            Clear filters
          </button>
        )}
      </p>
    </div>
  );
}
