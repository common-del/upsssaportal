'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { computeAge, ageToGrade, gradeLabel } from '@/lib/age-to-grade';
import type { GeoOption } from '@/lib/public/findGeoFallback';
import { SCHOOLS } from '@/lib/public/dummyData';
import { SearchableSelect } from '@/components/public/SearchableSelect';
import { TierStars } from '@/components/public/TierStars';

const SPECIAL_NEEDS_OPTIONS = [
  { value: 'not_applicable', label: 'Not Applicable' },
  { value: 'visual', label: 'Visual Impairment' },
  { value: 'hearing', label: 'Hearing Impairment' },
  { value: 'physical', label: 'Physical Disability' },
  { value: 'learning', label: 'Learning Disability' },
] as const;

const FACILITIES = [
  { id: 'library', label: 'Library' },
  { id: 'computerLab', label: 'Computer Lab' },
  { id: 'playground', label: 'Playground' },
  { id: 'scienceLab', label: 'Science Lab' },
  { id: 'drinkingWater', label: 'Drinking Water' },
  { id: 'toilets', label: 'Toilets' },
  { id: 'smartClassroom', label: 'Smart Classroom' },
  { id: 'boundaryWall', label: 'Boundary Wall' },
  { id: 'rampDisabled', label: 'Ramp for Disabled' },
] as const;

const MEDIUM_OPTIONS = ['English', 'Hindi', 'Multilingual', 'Other'] as const;
const SEARCH_RESULT_LIMIT = 8;

interface FindSchoolFlowProps {
  districts: GeoOption[];
  blocks: GeoOption[];
}

export function FindSchoolFlow({ districts, blocks }: FindSchoolFlowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('not_applicable');
  const [feesMin, setFeesMin] = useState('');
  const [feesMax, setFeesMax] = useState('');

  const [coEd, setCoEd] = useState('any');
  const [schoolType, setSchoolType] = useState('both');
  const [medium, setMedium] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);

  const blocksForDistrict = useMemo(
    () => blocks.filter((b) => b.districtCode === district),
    [blocks, district],
  );

  const districtName = districts.find((d) => d.code === district)?.nameEn ?? '';
  const blockName = blocks.find((b) => b.code === block)?.nameEn ?? '';

  const computedGrade = useMemo(() => {
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    return ageToGrade(computeAge(date));
  }, [dob]);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SCHOOLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.udise.includes(q) ||
        s.district.toLowerCase().includes(q) ||
        s.block.toLowerCase().includes(q),
    ).slice(0, SEARCH_RESULT_LIMIT);
  }, [query]);

  function handleSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('district', district);
    if (block) params.set('block', block);
    if (districtName) params.set('districtName', districtName);
    if (blockName) params.set('blockName', blockName);
    if (dob) params.set('dob', dob);
    if (sex) params.set('sex', sex);
    if (specialNeeds !== 'not_applicable') params.set('specialNeeds', specialNeeds);
    if (feesMin) params.set('feesMin', feesMin);
    if (feesMax) params.set('feesMax', feesMax);
    router.push(`/public/find/results?${params.toString()}`);
  }

  function toggleInList(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  const selectClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Find Schools</h1>
      <p className="mt-2 text-gray-600">
        Search by name, or browse by district and block — no need to answer every question first.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2 md:items-start">
        {/* Search by name — instant, no submit needed */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <label htmlFor="find-search" className="text-sm font-semibold text-gray-900">
            Search by name
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:border-[#1B2A6B]">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              id="find-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="School name, UDISE code, or block..."
              className="min-h-[44px] w-full bg-transparent text-sm outline-none"
            />
          </div>

          {query.trim() === '' ? (
            <p className="mt-3 text-xs text-gray-500">
              Results appear as you type — matches name, UDISE code, district, or block.
            </p>
          ) : searchMatches.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No schools match &quot;{query}&quot;.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {searchMatches.map((s) => (
                <li key={s.udise}>
                  <Link
                    href={`/public/schools/${s.udise}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-[#1B2A6B]/40 hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">
                        {s.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        {s.district} · {s.block}
                        <TierStars level={s.performanceLevel} size={12} />
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Browse by district / block */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">Browse by district</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600">District</label>
              <SearchableSelect
                value={district}
                onChange={(v) => setDistrict(v)}
                options={districts.map((d) => ({ value: d.code, label: d.nameEn }))}
                allLabel="Select district..."
                allValue=""
                searchPlaceholder="Search district..."
                ariaLabel="District"
                className="mt-1.5"
                buttonClassName="py-2.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Block (optional)</label>
              <select
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                disabled={!district}
                className={cn('mt-1.5', selectClass)}
              >
                <option value="">All blocks</option>
                {blocksForDistrict.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={!district || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A6B] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? 'Searching…' : 'View Schools'}
          </button>

          <button
            type="button"
            onClick={() => setRefineOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-between text-sm font-medium text-[#1B2A6B]"
          >
            Refine for admission eligibility (optional)
            <ChevronDown size={16} className={cn('transition-transform', refineOpen && 'rotate-180')} />
          </button>

          {refineOpen && (
            <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date of Birth of Ward</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={cn('mt-1.5', selectClass)}
                  />
                  {computedGrade !== null && (
                    <p className="mt-1 text-xs font-medium text-green-700">
                      Eligible grade: {gradeLabel(computedGrade, 'en')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Sex of Ward</label>
                  <select value={sex} onChange={(e) => setSex(e.target.value)} className={cn('mt-1.5', selectClass)}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Special Needs</label>
                  <select
                    value={specialNeeds}
                    onChange={(e) => setSpecialNeeds(e.target.value)}
                    className={cn('mt-1.5', selectClass)}
                  >
                    {SPECIAL_NEEDS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Desirable Fees Range (₹/year)</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={feesMin}
                      onChange={(e) => setFeesMin(e.target.value)}
                      className={cn(selectClass, 'w-full')}
                    />
                    <span className="text-gray-500">—</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={feesMax}
                      onChange={(e) => setFeesMax(e.target.value)}
                      className={cn(selectClass, 'w-full')}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Co-ed, type, medium, and facility preferences below are for future use — filtering by
                these fields is not yet available in demo data.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Co-Educational Preference</label>
                  <select value={coEd} onChange={(e) => setCoEd(e.target.value)} className={cn('mt-1.5', selectClass)}>
                    <option value="any">Any</option>
                    <option value="boys">Boys Only</option>
                    <option value="girls">Girls Only</option>
                    <option value="coed">Co-Educational</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Private or Public</label>
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    className={cn('mt-1.5', selectClass)}
                  >
                    <option value="both">Both</option>
                    <option value="government">Government</option>
                    <option value="private">Private</option>
                    <option value="aided">Aided</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Medium of Instruction</label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {MEDIUM_OPTIONS.map((m) => (
                      <label key={m} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={medium.includes(m)}
                          onChange={() => toggleInList(medium, m, setMedium)}
                          className="rounded border-gray-300 text-[#1B2A6B]"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Facilities Desired</label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {FACILITIES.map((f) => (
                      <label key={f.id} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={facilities.includes(f.id)}
                          onChange={() => toggleInList(facilities, f.id, setFacilities)}
                          className="rounded border-gray-300 text-[#1B2A6B]"
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
