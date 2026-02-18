'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, ArrowLeft, Search, Loader2, Star } from 'lucide-react';
import { searchSchools } from '@/lib/actions/dispute';
import { submitRating } from '@/lib/actions/rating';

interface DimensionOption {
  code: string;
  labelEn: string;
  labelHi: string;
}

interface SchoolResult {
  udise: string;
  nameEn: string;
  nameHi: string;
  category: string;
}

interface Props {
  dimensions: DimensionOption[];
  locale: string;
}

export function RateSchoolForm({ dimensions, locale }: Props) {
  const t = useTranslations('rate');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hi = locale === 'hi';

  const [step, setStep] = useState(1);

  // Step 1: school
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolResult[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2: mobile + OTP
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Step 3: ratings
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');

  const [error, setError] = useState('');

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';

  // School search
  const handleSchoolSearch = useCallback(
    async (query: string) => {
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
    },
    []
  );

  function selectSchool(school: SchoolResult) {
    setSelectedSchool(school);
    setSchoolResults([]);
    setSchoolQuery('');
  }

  function handleSendOtp() {
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setError(t('mobileRequired'));
      return;
    }
    setMobile(cleanMobile.slice(-10));
    setOtpSent(true);
    setError('');
  }

  function setDimensionRating(code: string, value: number) {
    setRatings((prev) => ({ ...prev, [code]: value }));
  }

  function canProceed() {
    if (step === 1) return !!selectedSchool;
    if (step === 2) return otpSent && otp.length >= 4;
    if (step === 3) return dimensions.every((d) => ratings[d.code] && ratings[d.code] >= 1);
    return false;
  }

  function handleSubmit() {
    if (!canProceed()) return;
    setError('');

    startTransition(async () => {
      const result = await submitRating({
        schoolUdise: selectedSchool!.udise,
        submitterMobile: mobile,
        otp,
        ratings,
        comment: comment.trim() || undefined,
      });

      if ('error' in result) {
        if (result.error === 'INVALID_OTP') setError(t('invalidOtp'));
        else if (result.error === 'ALREADY_RATED') setError(t('alreadyRated'));
        else setError(t('submitError'));
        return;
      }

      router.push(`/public/rate/success?udise=${selectedSchool!.udise}`);
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step >= s ? 'bg-navy-900 text-white' : 'bg-surface text-text-secondary'}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-0.5 w-6 ${step > s ? 'bg-navy-900' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select School */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{t('step1Title')}</h2>
            <p className="text-sm text-text-secondary">{t('step1Desc')}</p>
          </div>

          {!selectedSchool ? (
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={schoolQuery}
                  onChange={(e) => handleSchoolSearch(e.target.value)}
                  placeholder={t('schoolSearchPh')}
                  className={`${inputClass} pl-9`}
                />
                {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-secondary" />}
              </div>
              {schoolResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {schoolResults.map((s) => (
                    <button key={s.udise} type="button" onClick={() => selectSchool(s)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface">
                      <span className="font-medium text-navy-900">{hi ? s.nameHi : s.nameEn}</span>
                      <span className="text-text-secondary">({s.udise})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
              <div>
                <p className="font-medium text-navy-900">{hi ? selectedSchool.nameHi : selectedSchool.nameEn}</p>
                <p className="text-xs text-text-secondary">{selectedSchool.udise} · {selectedSchool.category}</p>
              </div>
              <button type="button" onClick={() => setSelectedSchool(null)} className="text-xs text-navy-700 hover:underline">{t('changeSchool')}</button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Mobile + OTP */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{t('step2Title')}</h2>
            <p className="text-sm text-text-secondary">{t('step2Desc')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">{t('mobileLabel')} <span className="text-red-500">*</span></label>
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder={t('mobilePh')} maxLength={10} className={`mt-1.5 ${inputClass}`} disabled={otpSent} />
          </div>
          {!otpSent ? (
            <button type="button" onClick={handleSendOtp} className="rounded-lg bg-navy-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800">{t('sendOtp')}</button>
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{t('otpSentMsg')}</p>
              <div>
                <label className="text-sm font-medium text-text-secondary">{t('otpLabel')} <span className="text-red-500">*</span></label>
                <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder={t('otpPh')} maxLength={6} className={`mt-1.5 ${inputClass}`} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Ratings */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{t('step3Title')}</h2>
            <p className="text-sm text-text-secondary">{t('step3Desc')}</p>
          </div>

          <div className="space-y-4">
            {dimensions.map((dim) => (
              <div key={dim.code} className="rounded-lg border border-border bg-white p-4">
                <p className="text-sm font-medium text-navy-900">{hi ? dim.labelHi : dim.labelEn}</p>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button key={val} type="button" onClick={() => setDimensionRating(dim.code, val)} className="p-0.5 transition-transform hover:scale-110">
                      <Star
                        size={28}
                        className={
                          (ratings[dim.code] ?? 0) >= val
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }
                      />
                    </button>
                  ))}
                  {ratings[dim.code] && (
                    <span className="ml-2 self-center text-sm font-medium text-navy-900">{ratings[dim.code]}/5</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary">{t('commentLabel')}</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder={t('commentPh')} className={`mt-1.5 ${inputClass} resize-none`} />
            <p className="mt-1 text-right text-xs text-text-secondary">{comment.length}/500</p>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button type="button" onClick={() => { setStep(step - 1); setError(''); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-surface">
            <ArrowLeft size={16} /> {t('back')}
          </button>
        ) : <span />}

        {step < 3 ? (
          <button type="button" onClick={() => { if (canProceed()) { setStep(step + 1); setError(''); } }} disabled={!canProceed()} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50">
            {t('next')} <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!canProceed() || isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            {isPending ? t('submitting') : t('submit')}
          </button>
        )}
      </div>
    </div>
  );
}
