'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowLeft, Search } from 'lucide-react';
import { computeAge, ageToGrade, gradeLabel } from '@/lib/age-to-grade';

interface GeoOption {
  code: string;
  nameEn: string;
  nameHi: string;
  districtCode?: string;
}

interface Props {
  districts: GeoOption[];
  allBlocks: GeoOption[];
  locale: string;
}

const FACILITIES = [
  'library',
  'computerLab',
  'playground',
  'scienceLab',
  'drinkingWater',
  'toilets',
  'smartClassroom',
  'boundaryWall',
  'rampDisabled',
] as const;

export function FindSchoolsForm({ districts, allBlocks, locale }: Props) {
  const t = useTranslations('findSchools');
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('no');
  const [feesMin, setFeesMin] = useState('');
  const [feesMax, setFeesMax] = useState('');

  // Step 2 fields (UI only)
  const [coEd, setCoEd] = useState('any');
  const [schoolType, setSchoolType] = useState('both');
  const [medium, setMedium] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);

  // Step 1 validation
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const getName = (item: GeoOption) =>
    locale === 'hi' ? item.nameHi : item.nameEn;

  const blocksForDistrict = useMemo(() => {
    if (!district) return [];
    return allBlocks.filter((b) => b.districtCode === district);
  }, [allBlocks, district]);

  // Computed grade
  const computedGrade = useMemo(() => {
    if (!dob) return null;
    const date = new Date(dob);
    if (isNaN(date.getTime())) return null;
    const age = computeAge(date);
    return ageToGrade(age);
  }, [dob]);

  function validateStep1(): boolean {
    const errs: Record<string, boolean> = {};
    if (!district) errs.district = true;
    if (!block) errs.block = true;
    if (!dob) errs.dob = true;
    if (!sex) errs.sex = true;
    if (!feesMin && !feesMax) {
      // fees range is required per spec but both can be 0
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validateStep1()) {
      setStep(2);
    }
  }

  function handleSubmit() {
    const params = new URLSearchParams();
    params.set('district', district);
    params.set('block', block);
    params.set('dob', dob);
    params.set('sex', sex);
    params.set('specialNeeds', specialNeeds);
    if (feesMin) params.set('feesMin', feesMin);
    if (feesMax) params.set('feesMax', feesMax);
    if (coEd !== 'any') params.set('coEd', coEd);
    if (schoolType !== 'both') params.set('schoolType', schoolType);
    if (medium.length > 0) params.set('medium', medium.join(','));
    if (facilities.length > 0) params.set('facilities', facilities.join(','));
    router.push(`/public/find/results?${params.toString()}`);
  }

  function toggleMedium(val: string) {
    setMedium((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    );
  }

  function toggleFacility(val: string) {
    setFacilities((prev) =>
      prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val]
    );
  }

  const selectClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';
  const errorBorder = 'border-red-400 ring-1 ring-red-400';
  const labelClass = 'text-sm font-medium text-text-secondary';

  return (
    <div className="mt-8">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            step === 1
              ? 'bg-navy-900 text-white'
              : 'bg-navy-100 text-navy-700'
          }`}
        >
          1
        </div>
        <div className="h-px flex-1 bg-border" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            step === 2
              ? 'bg-navy-900 text-white'
              : 'bg-navy-100 text-navy-700'
          }`}
        >
          2
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-navy-900">
            {t('step1Title')}
          </h2>
          <p className="text-sm text-text-secondary">{t('step1Desc')}</p>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* District */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {t('district')} <span className="text-red-500">*</span>
              </label>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setBlock('');
                  setErrors((prev) => ({ ...prev, district: false }));
                }}
                className={`${selectClass} ${errors.district ? errorBorder : ''}`}
              >
                <option value="">{t('selectDistrict')}</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {getName(d)}
                  </option>
                ))}
              </select>
              {errors.district && (
                <span className="text-xs text-red-500">{t('required')}</span>
              )}
            </div>

            {/* Block */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {t('block')} <span className="text-red-500">*</span>
              </label>
              <select
                value={block}
                onChange={(e) => {
                  setBlock(e.target.value);
                  setErrors((prev) => ({ ...prev, block: false }));
                }}
                className={`${selectClass} ${errors.block ? errorBorder : ''}`}
                disabled={!district}
              >
                <option value="">{t('selectBlock')}</option>
                {blocksForDistrict.map((b) => (
                  <option key={b.code} value={b.code}>
                    {getName(b)}
                  </option>
                ))}
              </select>
              {errors.block && (
                <span className="text-xs text-red-500">{t('required')}</span>
              )}
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {t('dob')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setErrors((prev) => ({ ...prev, dob: false }));
                }}
                className={`${selectClass} ${errors.dob ? errorBorder : ''}`}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.dob && (
                <span className="text-xs text-red-500">{t('required')}</span>
              )}
              {computedGrade !== null && (
                <span className="text-xs font-medium text-emerald-700">
                  {t('eligibleGrade')}: {gradeLabel(computedGrade, locale)}
                </span>
              )}
              {dob && computedGrade === null && (
                <span className="text-xs text-amber-600">
                  {t('ageOutOfRange')}
                </span>
              )}
            </div>

            {/* Sex */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {t('sex')} <span className="text-red-500">*</span>
              </label>
              <select
                value={sex}
                onChange={(e) => {
                  setSex(e.target.value);
                  setErrors((prev) => ({ ...prev, sex: false }));
                }}
                className={`${selectClass} ${errors.sex ? errorBorder : ''}`}
              >
                <option value="">{t('selectSex')}</option>
                <option value="M">{t('sexMale')}</option>
                <option value="F">{t('sexFemale')}</option>
                <option value="T">{t('sexOther')}</option>
              </select>
              {errors.sex && (
                <span className="text-xs text-red-500">{t('required')}</span>
              )}
            </div>

            {/* Special Needs */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                {t('specialNeeds')} <span className="text-red-500">*</span>
              </label>
              <select
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value)}
                className={selectClass}
              >
                <option value="no">{t('specialNeedsNo')}</option>
                <option value="yes">{t('specialNeedsYes')}</option>
              </select>
              {specialNeeds === 'yes' && (
                <span className="text-xs text-amber-600">
                  {t('specialNeedsNote')}
                </span>
              )}
            </div>

            {/* Fees Range */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('feesRange')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={t('feesMinPh')}
                  value={feesMin}
                  onChange={(e) => setFeesMin(e.target.value)}
                  className={`${selectClass} w-1/2`}
                />
                <span className="text-text-secondary">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder={t('feesMaxPh')}
                  value={feesMax}
                  onChange={(e) => setFeesMax(e.target.value)}
                  className={`${selectClass} w-1/2`}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
            >
              {t('next')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-navy-900">
            {t('step2Title')}
          </h2>
          <p className="text-sm text-text-secondary">{t('step2Desc')}</p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('step2Note')}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Co-Ed Preference */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('coEd')}</label>
              <select
                value={coEd}
                onChange={(e) => setCoEd(e.target.value)}
                className={selectClass}
              >
                <option value="any">{t('coEdAny')}</option>
                <option value="co-ed">{t('coEdCoEd')}</option>
                <option value="boys">{t('coEdBoys')}</option>
                <option value="girls">{t('coEdGirls')}</option>
              </select>
            </div>

            {/* Private / Public */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('schoolType')}</label>
              <select
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
                className={selectClass}
              >
                <option value="both">{t('schoolTypeBoth')}</option>
                <option value="private">{t('schoolTypePrivate')}</option>
                <option value="public">{t('schoolTypePublic')}</option>
              </select>
            </div>

            {/* Medium of Instruction */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass}>{t('medium')}</label>
              <div className="flex flex-wrap gap-3">
                {['english', 'hindi', 'multilingual', 'other'].map((m) => (
                  <label
                    key={m}
                    className="inline-flex items-center gap-2 text-sm text-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={medium.includes(m)}
                      onChange={() => toggleMedium(m)}
                      className="rounded border-border text-navy-900 focus:ring-navy-600"
                    />
                    {t(`medium_${m}`)}
                  </label>
                ))}
              </div>
            </div>

            {/* Facilities */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass}>{t('facilities')}</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FACILITIES.map((f) => (
                  <label
                    key={f}
                    className="inline-flex items-center gap-2 text-sm text-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={facilities.includes(f)}
                      onChange={() => toggleFacility(f)}
                      className="rounded border-border text-navy-900 focus:ring-navy-600"
                    />
                    {t(`facility_${f}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-surface"
            >
              <ArrowLeft size={16} />
              {t('back')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
            >
              <Search size={16} />
              {t('searchSchools')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
