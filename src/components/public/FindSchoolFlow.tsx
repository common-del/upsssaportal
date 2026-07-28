'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { computeAge, ageToGrade, gradeLabel } from '@/lib/age-to-grade';
import type { GeoOption } from '@/lib/public/findGeoFallback';
import { SearchableSelect } from '@/components/public/SearchableSelect';

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

interface FindSchoolFlowProps {
  districts: GeoOption[];
  blocks: GeoOption[];
}

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const step1Active = step === 1;
  const step2Active = step === 2;

  return (
    <div className="mb-8 flex items-center gap-3">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
          step1Active ? 'bg-[#1B2A6B] text-white' : 'border-2 border-gray-300 bg-white text-gray-400',
        )}
      >
        1
      </div>
      <div className="h-px flex-1 bg-gray-300" />
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
          step2Active ? 'bg-[#1B2A6B] text-white' : 'border-2 border-gray-300 bg-white text-gray-400',
        )}
      >
        2
      </div>
    </div>
  );
}

export function FindSchoolFlow({ districts, blocks }: FindSchoolFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

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

  const [errors, setErrors] = useState<Record<string, boolean>>({});

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

  function validateStep1(): boolean {
    const errs: Record<string, boolean> = {};
    if (!district) errs.district = true;
    if (!block) errs.block = true;
    if (!dob) errs.dob = true;
    if (!sex) errs.sex = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('district', district);
    params.set('block', block);
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
  const errorBorder = 'border-red-500 ring-1 ring-red-500';

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Find Schools</h1>
      <p className="mt-2 text-gray-600">
        Answer a few questions to find the right school for your child
      </p>

      <div className="mt-8">
        <ProgressBar step={step as 1 | 2} />

        {step === 1 && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  District <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={district}
                  onChange={(v) => {
                    setDistrict(v);
                    setBlock('');
                    setErrors((p) => ({ ...p, district: false }));
                  }}
                  options={districts.map((d) => ({ value: d.code, label: d.nameEn }))}
                  allLabel="Select district..."
                  allValue=""
                  searchPlaceholder="Search district..."
                  ariaLabel="District"
                  className="mt-1.5"
                  buttonClassName={cn('py-2.5', errors.district && errorBorder)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Block <span className="text-red-500">*</span>
                </label>
                <select
                  value={block}
                  onChange={(e) => {
                    setBlock(e.target.value);
                    setErrors((p) => ({ ...p, block: false }));
                  }}
                  disabled={!district}
                  className={cn('mt-1.5', selectClass, errors.block && errorBorder)}
                >
                  <option value="">Select block...</option>
                  {blocksForDistrict.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Date of Birth of Ward <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setErrors((p) => ({ ...p, dob: false }));
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="dd-mm-yyyy"
                  className={cn('mt-1.5', selectClass, errors.dob && errorBorder)}
                />
                <p className="mt-1 text-xs text-gray-500">Format: dd-mm-yyyy (use date picker)</p>
                {computedGrade !== null && (
                  <p className="mt-1 text-xs font-medium text-green-700">
                    Eligible grade: {gradeLabel(computedGrade, 'en')}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Sex of Ward <span className="text-red-500">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => {
                    setSex(e.target.value);
                    setErrors((p) => ({ ...p, sex: false }));
                  }}
                  className={cn('mt-1.5', selectClass, errors.sex && errorBorder)}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Special Needs <span className="text-red-500">*</span>
                </label>
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
                <label className="text-sm font-medium text-gray-700">
                  Desirable Fees Range (₹/year)
                </label>
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

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => validateStep1() && setStep(2)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B2A6B] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1B2A6B]">Step 2: Desirable Criteria</h2>
            <p className="mt-1 text-sm text-gray-600">
              Optionally narrow your results with these preferences.
            </p>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              These criteria are for future use. Filtering by these fields is not yet available
              in demo data.
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Co-Educational Preference</label>
                <select value={coEd} onChange={(e) => setCoEd(e.target.value)} className={cn('mt-1.5', selectClass)}>
                  <option value="any">Any</option>
                  <option value="boys">Boys Only</option>
                  <option value="girls">Girls Only</option>
                  <option value="coed">Co-Educational</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Private or Public</label>
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
                <label className="text-sm font-medium text-gray-700">Medium of Instruction</label>
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
                <label className="text-sm font-medium text-gray-700">Facilities Desired</label>
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

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B2A6B] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Search size={16} />
                {loading ? 'Searching…' : 'Search Schools 🔍'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
