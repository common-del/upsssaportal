'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { LevelBadge } from '@/components/public/LevelBadge';
import { CompareReportCard } from '@/components/public/CompareReportCard';
import { MAX_COMPARE, type CompareSchool } from '@/lib/public/stateOverviewData';

const selectClass =
  'rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

export function CompareSearchFlow({
  query,
  district,
  block,
  districts,
  blocks,
  suggestions,
  selected,
}: {
  query: string;
  district: string;
  block: string;
  districts: string[];
  blocks: string[];
  /** Search or browse hits, already narrowed server-side. */
  suggestions: CompareSchool[];
  /** Resolved from the URL, in the order they were picked. */
  selected: CompareSchool[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedUdises = selected.map((s) => s.udise);
  const atLimit = selected.length >= MAX_COMPARE;

  /** Selection lives in the URL so a comparison can be shared or reloaded, and
   * the search pool never has to reach the browser.
   *
   * Reads the live URL rather than props: props lag behind by a server
   * round-trip, so two quick clicks would both compute from the pre-click list
   * and the second would overwrite the first. */
  function navigate(next: { q?: string; district?: string; block?: string; addSel?: string; sel?: string[] }) {
    const live = new URLSearchParams(window.location.search);
    const currentSel = (live.get('sel') ?? '').split(',').filter(Boolean);

    const sel = next.sel ?? (next.addSel ? [...currentSel, next.addSel] : currentSel);
    const params = new URLSearchParams();
    const q = next.q ?? live.get('q') ?? '';
    const d = next.district ?? live.get('district') ?? '';
    const b = next.block ?? live.get('block') ?? '';
    if (q) params.set('q', q);
    if (d) params.set('district', d);
    if (b) params.set('block', b);
    if (sel.length > 0) params.set('sel', sel.slice(0, MAX_COMPARE).join(','));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: value }), 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Selected schools, always visible so the state of the comparison is obvious */}
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Selected ({selected.length} of {MAX_COMPARE})
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span
              key={s.udise}
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe1f0] bg-[#eef1f8] py-1.5 pl-3 pr-1.5 text-sm font-semibold text-[#1B2A6B]"
            >
              {s.name}
              <button
                type="button"
                onClick={() => navigate({ sel: selectedUdises.filter((u) => u !== s.udise) })}
                aria-label={`Remove ${s.name}`}
                className="grid h-5 w-5 place-items-center rounded-full bg-white text-gray-500 hover:text-gray-800"
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          {selected.length === 0 && (
            <span className="rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-sm text-gray-400">
              Nothing selected yet
            </span>
          )}
        </div>

        {/* Search first */}
        <div className="relative mt-5">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            key={query}
            defaultValue={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by school name, block or UDISE…"
            aria-label="Search schools to compare"
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]"
          />
        </div>

        {/* Geography is optional narrowing, never a gate */}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Or narrow by
          </span>
          <select
            value={district}
            onChange={(e) => navigate({ district: e.target.value, block: '' })}
            aria-label="District"
            className={selectClass}
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={block}
            onChange={(e) => navigate({ block: e.target.value })}
            aria-label="Block"
            disabled={!district}
            className={`${selectClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">{district ? 'All blocks' : 'Pick a district first'}</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {suggestions.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {suggestions.map((s) => {
              const already = selectedUdises.includes(s.udise);
              return (
                <li key={s.udise}>
                  <button
                    type="button"
                    onClick={() => navigate({ addSel: s.udise })}
                    disabled={already || atLimit}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {s.district} · {s.block} · {s.type}
                      </span>
                    </span>
                    <LevelBadge level={s.performanceLevel} />
                    <span className="shrink-0 text-xs font-semibold text-[#1B2A6B]">
                      {already ? 'Added' : atLimit ? '—' : <Plus size={15} aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {suggestions.length === 0 && (query || district) && (
          <p className="mt-4 rounded-xl border border-gray-200 p-3 text-sm text-gray-500">
            No schools match that. Try a different name, or pick a district.
          </p>
        )}

        {!query && !district && (
          <p className="mt-4 text-xs text-gray-400">
            Start typing a school name, or pick a district to browse.
          </p>
        )}
      </div>

      {selected.length > 1 ? (
        <section>
          <h2 className="text-base font-bold text-gray-900">Side by side</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selected.map((s) => (
              <CompareReportCard key={s.udise} school={s} />
            ))}
          </div>
          <p className="mt-3 max-w-2xl text-[11px] text-gray-400">
            Schools serve different intakes and differ in size, so these figures describe each school
            against the SQAAF framework rather than against each other.
          </p>
        </section>
      ) : (
        selected.length === 1 && (
          <p className="text-sm text-gray-500">Add one more school to see them side by side.</p>
        )
      )}
    </div>
  );
}
