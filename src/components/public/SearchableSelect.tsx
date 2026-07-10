'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  allLabel: string;
  allValue?: string;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  id?: string;
  ariaLabel?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  allLabel,
  allValue = '',
  searchPlaceholder = 'Search...',
  className,
  buttonClassName,
  id,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel =
    value === allValue ? allLabel : (options.find((o) => o.value === value)?.label ?? value);

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm',
          buttonClassName,
        )}
      >
        <span className="truncate text-gray-900">{selectedLabel}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100 p-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-[#1B2A6B] focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
            <li>
              <button
                type="button"
                onClick={() => select(allValue)}
                className={cn(
                  'block w-full px-3 py-1.5 text-left hover:bg-gray-50',
                  value === allValue ? 'font-semibold text-[#1B2A6B]' : 'text-gray-700',
                )}
              >
                {allLabel}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => select(o.value)}
                  className={cn(
                    'block w-full px-3 py-1.5 text-left hover:bg-gray-50',
                    value === o.value ? 'font-semibold text-[#1B2A6B]' : 'text-gray-700',
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-gray-400">No matches found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
