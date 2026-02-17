'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowLeft, Search, Loader2 } from 'lucide-react';
import { searchSchools, createTicket } from '@/lib/actions/dispute';

interface CategoryOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface SchoolResult {
  udise: string;
  nameEn: string;
  nameHi: string;
  category: string;
}

interface Props {
  categories: CategoryOption[];
  locale: string;
}

export function DisputeForm({ categories, locale }: Props) {
  const t = useTranslations('dispute');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: School selection
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null);

  // Step 2: Category
  const [categoryCode, setCategoryCode] = useState('');

  // Step 3: Description
  const [description, setDescription] = useState('');

  // Step 4: Mobile + OTP
  const [submitterName, setSubmitterName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const hi = locale === 'hi';

  const selectClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';
  const errorBorder = 'border-red-400 ring-1 ring-red-400';
  const labelClass = 'text-sm font-medium text-text-secondary';

  // Debounced school search
  const handleSchoolSearch = useCallback(async (query: string) => {
    setSchoolQuery(query);
    if (query.length < 2) {
      setSchoolResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchSchools(query);
      setSchoolResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSelectSchool(school: SchoolResult) {
    setSelectedSchool(school);
    setSchoolResults([]);
    setSchoolQuery(hi ? school.nameHi : school.nameEn);
    setErrors((prev) => ({ ...prev, school: '' }));
  }

  function goToStep(target: number) {
    // Validate current step before advancing
    if (target > step) {
      const errs: Record<string, string> = {};
      if (step === 1 && !selectedSchool) errs.school = 'required';
      if (step === 2 && !categoryCode) errs.category = 'required';
      if (step === 3 && !description.trim()) errs.description = 'required';
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    setErrors({});
    setStep(target);
  }

  function handleSendOtp() {
    const clean = mobile.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrors({ mobile: 'required' });
      return;
    }
    setOtpSent(true);
    setErrors({});
  }

  function handleSubmit() {
    if (!otp.trim()) {
      setErrors({ otp: 'required' });
      return;
    }
    setSubmitError('');
    startTransition(async () => {
      const result = await createTicket({
        schoolUdise: selectedSchool!.udise,
        categoryCode,
        description: description.trim(),
        submitterName: submitterName.trim(),
        submitterMobile: mobile,
        otp: otp.trim(),
      });
      if ('error' in result) {
        if (result.error === 'INVALID_OTP') {
          setSubmitError(t('invalidOtp'));
        } else {
          setSubmitError(t('submitError'));
        }
        return;
      }
      router.push(`/public/dispute/success?ticketId=${result.ticketId}`);
    });
  }

  // Step indicator
  const stepIndicator = (
    <div className="mb-8 flex items-center gap-2">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              s === step
                ? 'bg-navy-900 text-white'
                : s < step
                  ? 'bg-emerald-600 text-white'
                  : 'bg-navy-100 text-navy-700'
            }`}
          >
            {s < step ? '✓' : s}
          </div>
          {s < 4 && <div className="h-px w-6 bg-border sm:w-10" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-6">
      {stepIndicator}

      {/* Step 1: Select School */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">{t('step1Title')}</h2>
          <p className="text-sm text-text-secondary">{t('step1Desc')}</p>

          <div className="relative">
            <label className={labelClass}>
              {t('schoolLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                type="text"
                value={schoolQuery}
                onChange={(e) => handleSchoolSearch(e.target.value)}
                placeholder={t('schoolSearchPh')}
                className={`${selectClass} pr-10 ${errors.school ? errorBorder : ''}`}
              />
              {searching && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-secondary"
                />
              )}
            </div>
            {errors.school && (
              <span className="text-xs text-red-500">{t('required')}</span>
            )}

            {/* Search results dropdown */}
            {schoolResults.length > 0 && !selectedSchool && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
                {schoolResults.map((s) => (
                  <li key={s.udise}>
                    <button
                      type="button"
                      onClick={() => handleSelectSchool(s)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface"
                    >
                      <span className="font-medium">
                        {hi ? s.nameHi : s.nameEn}
                      </span>
                      <span className="ml-2 text-xs text-text-secondary">
                        ({s.udise}) · {s.category}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedSchool && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-800">
                {hi ? selectedSchool.nameHi : selectedSchool.nameEn}
              </p>
              <p className="text-emerald-700">
                UDISE: {selectedSchool.udise} · {selectedSchool.category}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedSchool(null);
                  setSchoolQuery('');
                }}
                className="mt-1 text-xs text-emerald-600 underline"
              >
                {t('changeSchool')}
              </button>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="button" onClick={() => goToStep(2)} className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800">
              {t('next')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Category */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">{t('step2Title')}</h2>
          <p className="text-sm text-text-secondary">{t('step2Desc')}</p>

          <div>
            <label className={labelClass}>
              {t('categoryLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryCode}
              onChange={(e) => {
                setCategoryCode(e.target.value);
                setErrors({});
              }}
              className={`mt-1.5 ${selectClass} ${errors.category ? errorBorder : ''}`}
            >
              <option value="">{t('selectCategory')}</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {hi ? c.nameHi : c.nameEn}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="text-xs text-red-500">{t('required')}</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-surface">
              <ArrowLeft size={16} /> {t('back')}
            </button>
            <button type="button" onClick={() => goToStep(3)} className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800">
              {t('next')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Description */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">{t('step3Title')}</h2>
          <p className="text-sm text-text-secondary">{t('step3Desc')}</p>

          <div>
            <label className={labelClass}>
              {t('descriptionLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors({});
              }}
              rows={5}
              maxLength={2000}
              placeholder={t('descriptionPh')}
              className={`mt-1.5 ${selectClass} resize-none ${errors.description ? errorBorder : ''}`}
            />
            <p className="mt-1 text-xs text-text-secondary">
              {description.length}/2000
            </p>
            {errors.description && (
              <span className="text-xs text-red-500">{t('required')}</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-surface">
              <ArrowLeft size={16} /> {t('back')}
            </button>
            <button type="button" onClick={() => goToStep(4)} className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800">
              {t('next')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Mobile + OTP */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">{t('step4Title')}</h2>
          <p className="text-sm text-text-secondary">{t('step4Desc')}</p>

          <div>
            <label className={labelClass}>{t('nameLabel')}</label>
            <input
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder={t('namePh')}
              className={`mt-1.5 ${selectClass}`}
            />
          </div>

          <div>
            <label className={labelClass}>
              {t('mobileLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setErrors((prev) => ({ ...prev, mobile: '' }));
                }}
                placeholder={t('mobilePh')}
                maxLength={10}
                className={`${selectClass} flex-1 ${errors.mobile ? errorBorder : ''}`}
                disabled={otpSent}
              />
              {!otpSent && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
                >
                  {t('sendOtp')}
                </button>
              )}
            </div>
            {errors.mobile && (
              <span className="text-xs text-red-500">{t('mobileRequired')}</span>
            )}
          </div>

          {otpSent && (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                {t('otpSentMsg')}
              </div>

              <div>
                <label className={labelClass}>
                  {t('otpLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setErrors((prev) => ({ ...prev, otp: '' }));
                    setSubmitError('');
                  }}
                  placeholder={t('otpPh')}
                  maxLength={6}
                  className={`mt-1.5 ${selectClass} max-w-48 ${errors.otp ? errorBorder : ''}`}
                />
                {errors.otp && (
                  <span className="text-xs text-red-500">{t('required')}</span>
                )}
              </div>
            </>
          )}

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-surface">
              <ArrowLeft size={16} /> {t('back')}
            </button>
            {otpSent && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                {isPending ? t('submitting') : t('submit')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
