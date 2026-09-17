'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The school register's filter bar: a search box and five menus, above the table.
 *
 * One control per column the register can answer a question about, in the order the columns
 * appear, so the bar reads as a key to the table rather than as a separate machine. Fee has a
 * column but no menu, by SSSA's choice: it is a fact worth seeing on a row and not a question
 * anyone asks of the whole register.
 *
 * Block is built from the chosen district rather than listing all 826 at once, so the two
 * cannot contradict each other and the menu stays a length a person can read. It is disabled
 * until a district is picked, which says why it is empty without a sentence explaining it.
 *
 * Search navigates on a debounce so typing a UDISE does not fire eleven requests; the menus
 * navigate at once, because a menu is one decision. Every filter is a search parameter, which
 * keeps the page server-rendered, keeps a filtered view shareable, and lets Back step through
 * the filters the way people expect.
 */

type Option = { value: string; label: string };

const NAVY = '#1B2A6B';

export type RegisterFilterValues = {
  q: string;
  district: string;
  block: string;
  management: string;
  sqaaf: string;
  status: string;
};

/** Empty means "no filter", so a select showing its placeholder is not a value. */
const isSet = (v: string) => v.trim() !== '';

function Select({
  id,
  label,
  value,
  options,
  placeholder,
  disabled,
  disabledHint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  onChange: (v: string) => void;
}) {
  const on = isSet(value) && !disabled;
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        style={{
          borderColor: on ? NAVY : '#D6DCE7',
          color: on ? NAVY : '#3C4A61',
          fontWeight: on ? 600 : 400,
          backgroundColor: on ? '#F5F8FD' : undefined,
        }}
      >
        <option value="">{disabled ? (disabledHint ?? placeholder) : placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function RegisterFilters({
  selected,
  districts,
  blocks,
  managements,
  bands,
  total,
  matched,
}: {
  selected: RegisterFilterValues;
  districts: Option[];
  /** Already narrowed to the chosen district by the page. */
  blocks: Option[];
  managements: Option[];
  /** The framework's own band labels, so this cannot disagree with the table. */
  bands: Option[];
  total: number;
  matched: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(selected.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A filter changed elsewhere, or Back was pressed: follow the URL rather than keeping a
  // stale box. Keyed on the parameter so typing does not fight this.
  useEffect(() => {
    setQ(selected.q);
  }, [selected.q]);

  function navigate(updates: Partial<RegisterFilterValues>) {
    const next = { ...selected, ...updates };
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (isSet(value)) params.set(key, value);
      else params.delete(key);
    }
    // Any change puts you back on the first page: page 7 of the old result set means nothing
    // in the new one, and an empty page reads as "no matches" when there are hundreds.
    params.delete('page');
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navigate({ q: value }), 350);
  }

  const anyFilter =
    isSet(selected.q) ||
    isSet(selected.district) ||
    isSet(selected.block) ||
    isSet(selected.management) ||
    isSet(selected.sqaaf) ||
    isSet(selected.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
        <span className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
          <label htmlFor="reg-q" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search
          </label>
          <input
            id="reg-q"
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="School or UDISE"
            className="rounded-lg border px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1"
            style={{ borderColor: isSet(q) ? NAVY : '#D6DCE7', color: '#3C4A61' }}
          />
        </span>

        <Select
          id="reg-district"
          label="District"
          value={selected.district}
          options={districts}
          placeholder="All districts"
          // Changing district clears the block: a block from the old district would filter
          // every school out and look like an empty register.
          onChange={(v) => navigate({ district: v, block: '' })}
        />
        <Select
          id="reg-block"
          label="Block"
          value={selected.block}
          options={blocks}
          placeholder="All blocks"
          disabled={!isSet(selected.district)}
          disabledHint="Pick a district first"
          onChange={(v) => navigate({ block: v })}
        />
        <Select
          id="reg-management"
          label="Management"
          value={selected.management}
          options={managements}
          placeholder="All management"
          onChange={(v) => navigate({ management: v })}
        />
        <Select
          id="reg-sqaaf"
          label="SQAAF"
          value={selected.sqaaf}
          options={bands}
          placeholder="Any grade"
          onChange={(v) => navigate({ sqaaf: v })}
        />
        <Select
          id="reg-status"
          label="Status"
          value={selected.status}
          options={[
            { value: 'VERIFIED', label: 'Verified' },
            { value: 'SELF', label: 'Self-assessed' },
          ]}
          placeholder="Any status"
          onChange={(v) => navigate({ status: v })}
        />
      </div>

      {/* A filtered register that still reports the full total is a page lying about what is
          on screen, so the count names both numbers and offers one way out of all of them. */}
      <p className="flex flex-wrap items-baseline gap-2 text-[12.5px] text-gray-600">
        <span>
          <b className="text-gray-900">{matched.toLocaleString('en-IN')}</b>
          {anyFilter && <> of {total.toLocaleString('en-IN')}</>} {matched === 1 ? 'school' : 'schools'}
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
