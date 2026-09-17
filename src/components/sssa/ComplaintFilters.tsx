'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComplaintFilterValues } from '@/lib/sssa/complaints';

/**
 * Search, district, complaint type and who raised it, above the one complaints list.
 *
 * "Raised by" offers the group rather than the words the filer typed. The public form lets
 * people describe their own role, so a menu built from that column would list every phrase
 * anybody has ever used; the group is the question somebody is actually asking of the list.
 *
 * Every filter is a search parameter, so the page stays server-rendered, a filtered view is
 * shareable, and Back steps through the filters. Search debounces; the menus navigate at once.
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
        className="rounded-lg border px-3 py-2.5 text-[12.5px] focus:outline-none focus:ring-1"
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

export function ComplaintFilters({
  selected,
  districts,
  types,
  total,
  matched,
}: {
  selected: ComplaintFilterValues;
  districts: string[];
  types: string[];
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

  function navigate(updates: Partial<ComplaintFilterValues>) {
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
    isSet(selected.q) || isSet(selected.district) || isSet(selected.type) || isSet(selected.source);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <span className="flex min-w-0 flex-col gap-1">
          <label htmlFor="cx-q" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search
          </label>
          <input
            id="cx-q"
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="School, person or type"
            className="rounded-lg border px-3 py-2.5 text-[12.5px] focus:outline-none focus:ring-1"
            style={{ borderColor: isSet(q) ? NAVY : '#D6DCE7', color: '#3C4A61' }}
          />
        </span>

        <Select
          id="cx-district"
          label="District"
          value={selected.district}
          options={districts.map((d) => ({ value: d, label: d }))}
          placeholder="All districts"
          onChange={(v) => navigate({ district: v })}
        />

        <Select
          id="cx-type"
          label="Complaint type"
          value={selected.type}
          options={types.map((t) => ({ value: t, label: t }))}
          placeholder="Any type"
          onChange={(v) => navigate({ type: v })}
        />

        {/* No option for a school: a school has no way to raise a complaint, and a menu entry
            that can never match anything is a promise the portal does not keep. */}
        <Select
          id="cx-source"
          label="Raised by"
          value={selected.source}
          options={[
            { value: 'PUBLIC', label: 'A parent or the public' },
            { value: 'VERIFIER', label: 'A verifier' },
          ]}
          placeholder="Anyone"
          onChange={(v) => navigate({ source: v })}
        />
      </div>

      <p className="flex flex-wrap items-baseline gap-2 text-[12.5px] text-gray-600">
        <span>
          <b className="text-gray-900">{matched.toLocaleString('en-IN')}</b>
          {anyFilter && <> of {total.toLocaleString('en-IN')}</>}{' '}
          {matched === 1 ? 'complaint' : 'complaints'}. Past deadline first, then reports waiting on
          you, then oldest.
        </span>
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
