'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upload } from '@vercel/blob/client';
import { Loader2, Paperclip, RefreshCw, ShieldCheck } from 'lucide-react';
import { createTicket, getCaptcha, getSchoolsByBlock } from '@/lib/actions/dispute';

const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 1000;
const EVIDENCE_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const EVIDENCE_MAX_SIZE = 5 * 1024 * 1024;

const ROLES = ['Parent', 'Guardian', 'Community Member', 'School Staff'] as const;
const ROLE_KEYS: Record<(typeof ROLES)[number], string> = {
  Parent: 'roleParent',
  Guardian: 'roleGuardian',
  'Community Member': 'roleCommunityMember',
  'School Staff': 'roleSchoolStaff',
};

interface CategoryOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface DistrictOption {
  code: string;
  nameEn: string;
  nameHi: string;
}

interface BlockOption {
  code: string;
  districtCode?: string;
  nameEn: string;
  nameHi: string;
}

interface SchoolOption {
  udise: string;
  nameEn: string;
  nameHi: string;
}

interface Props {
  categories: CategoryOption[];
  districts: DistrictOption[];
  blocks: BlockOption[];
  locale: string;
}

export function DisputeForm({ categories, districts, blocks, locale }: Props) {
  const t = useTranslations('dispute');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hi = locale === 'hi';

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const [submitterName, setSubmitterName] = useState('');
  const [submitterRole, setSubmitterRole] = useState('');
  const [categoryCode, setCategoryCode] = useState('');

  const [districtCode, setDistrictCode] = useState('');
  const [blockCode, setBlockCode] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolUdise, setSchoolUdise] = useState('');
  const [udiseOverride, setUdiseOverride] = useState('');

  const [description, setDescription] = useState('');

  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const loadCaptcha = useCallback(async () => {
    setCaptchaAnswer('');
    setCaptcha(await getCaptcha());
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  const blocksForDistrict = blocks.filter((b) => b.districtCode === districtCode);

  useEffect(() => {
    setBlockCode('');
    setSchools([]);
    setSchoolUdise('');
  }, [districtCode]);

  useEffect(() => {
    setSchoolUdise('');
    if (!blockCode) {
      setSchools([]);
      return;
    }
    let cancelled = false;
    setSchoolsLoading(true);
    getSchoolsByBlock(blockCode)
      .then((result) => {
        if (!cancelled) setSchools(result);
      })
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [blockCode]);

  const selectClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 disabled:bg-surface disabled:text-text-secondary';
  const errorBorder = 'border-red-400 ring-1 ring-red-400';
  const labelClass = 'text-sm font-medium text-text-secondary';

  function handleSendOtp() {
    const clean = mobile.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrors((prev) => ({ ...prev, mobile: 'required' }));
      return;
    }
    setOtpSent(true);
    setErrors((prev) => ({ ...prev, mobile: '' }));
  }

  async function handleEvidenceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceError('');

    if (!EVIDENCE_ALLOWED_TYPES.includes(file.type)) {
      setEvidenceError(t('evidenceInvalidType'));
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
      return;
    }
    if (file.size > EVIDENCE_MAX_SIZE) {
      setEvidenceError(t('evidenceTooLarge'));
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
      return;
    }

    setEvidenceUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/dispute',
      });
      setEvidenceUrl(blob.url);
      setEvidenceFileName(file.name);
    } catch {
      setEvidenceError(t('evidenceUploadError'));
      if (evidenceInputRef.current) evidenceInputRef.current.value = '';
    } finally {
      setEvidenceUploading(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!submitterName.trim()) errs.name = 'required';
    if (!submitterRole) errs.role = 'required';
    if (!categoryCode) errs.category = 'required';
    if (!udiseOverride.trim() && !schoolUdise) errs.school = 'required';
    if (!description.trim()) errs.description = 'required';
    else if (description.trim().length < MIN_DESCRIPTION_LENGTH) errs.description = 'tooShort';
    const cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) errs.mobile = 'required';
    if (!otp.trim()) errs.otp = 'required';
    if (!captchaAnswer.trim()) errs.captcha = 'required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    setSubmitError('');
    const resolvedUdise = udiseOverride.trim() || schoolUdise;
    startTransition(async () => {
      const result = await createTicket({
        schoolUdise: resolvedUdise,
        categoryCode,
        description: description.trim(),
        submitterName: submitterName.trim(),
        submitterRole,
        submitterMobile: mobile,
        evidenceUrl: evidenceUrl || undefined,
        otp: otp.trim(),
        captchaToken: captcha?.token || '',
        captchaAnswer: captchaAnswer.trim(),
      });
      if ('error' in result) {
        if (result.error === 'INVALID_OTP') {
          setSubmitError(t('invalidOtp'));
        } else if (result.error === 'CAPTCHA_FAILED') {
          setSubmitError(t('captchaError'));
          loadCaptcha();
        } else if (result.error === 'DUPLICATE_OPEN') {
          setSubmitError(t('duplicateError'));
        } else if (result.error === 'DESCRIPTION_TOO_SHORT') {
          setSubmitError(t('descTooShort'));
        } else if (result.error === 'SCHOOL_NOT_FOUND') {
          setSubmitError(t('schoolNotFound'));
        } else {
          setSubmitError(t('submitError'));
        }
        return;
      }
      router.push(`/public/dispute/success?ticketId=${result.ticketId}`);
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Mobile OTP Verification */}
      <div className="rounded-xl border border-border bg-surface/50 p-4">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
          <ShieldCheck size={16} className="text-navy-700" />
          {t('otpSectionTitle')} <span className="text-red-500">*</span>
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="tel"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
              setErrors((prev) => ({ ...prev, mobile: '' }));
            }}
            placeholder={t('mobilePh')}
            maxLength={10}
            disabled={otpSent}
            className={`${selectClass} flex-1 ${errors.mobile ? errorBorder : ''}`}
          />
          {!otpSent && (
            <button
              type="button"
              onClick={handleSendOtp}
              className="shrink-0 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
            >
              {t('sendOtp')}
            </button>
          )}
        </div>
        {errors.mobile && <span className="text-xs text-red-500">{t('mobileRequired')}</span>}

        {otpSent && (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {t('otpSentMsg')}
            </div>
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
              className={`${selectClass} max-w-48 ${errors.otp ? errorBorder : ''}`}
            />
            {errors.otp && <span className="text-xs text-red-500">{t('required')}</span>}
          </div>
        )}
      </div>

      {/* Name + Filing As */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            {t('nameLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={submitterName}
            onChange={(e) => {
              setSubmitterName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder={t('namePh')}
            className={`mt-1.5 ${selectClass} ${errors.name ? errorBorder : ''}`}
          />
          {errors.name && <span className="text-xs text-red-500">{t('required')}</span>}
        </div>
        <div>
          <label className={labelClass}>
            {t('filingAsLabel')} <span className="text-red-500">*</span>
          </label>
          <select
            value={submitterRole}
            onChange={(e) => {
              setSubmitterRole(e.target.value);
              setErrors((prev) => ({ ...prev, role: '' }));
            }}
            className={`mt-1.5 ${selectClass} ${errors.role ? errorBorder : ''}`}
          >
            <option value="">{t('selectRole')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_KEYS[r])}
              </option>
            ))}
          </select>
          {errors.role && <span className="text-xs text-red-500">{t('required')}</span>}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className={labelClass}>
          {t('categoryLabel')} <span className="text-red-500">*</span>
        </label>
        <select
          value={categoryCode}
          onChange={(e) => {
            setCategoryCode(e.target.value);
            setErrors((prev) => ({ ...prev, category: '' }));
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
        {errors.category && <span className="text-xs text-red-500">{t('required')}</span>}
      </div>

      {/* District / Block / School */}
      <div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>{t('districtLabel')}</label>
            <select
              value={districtCode}
              onChange={(e) => setDistrictCode(e.target.value)}
              className={`mt-1.5 ${selectClass}`}
            >
              <option value="">{t('selectDistrict')}</option>
              {districts.map((d) => (
                <option key={d.code} value={d.code}>
                  {hi ? d.nameHi : d.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('blockLabel')}</label>
            <select
              value={blockCode}
              onChange={(e) => setBlockCode(e.target.value)}
              disabled={!districtCode}
              className={`mt-1.5 ${selectClass}`}
            >
              <option value="">{districtCode ? t('selectBlock') : t('pickDistrictFirst')}</option>
              {blocksForDistrict.map((b) => (
                <option key={b.code} value={b.code}>
                  {hi ? b.nameHi : b.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('schoolLabel')}</label>
            <select
              value={schoolUdise}
              onChange={(e) => {
                setSchoolUdise(e.target.value);
                setErrors((prev) => ({ ...prev, school: '' }));
              }}
              disabled={!blockCode || schoolsLoading}
              className={`mt-1.5 ${selectClass} ${errors.school ? errorBorder : ''}`}
            >
              <option value="">
                {!blockCode ? t('pickBlockFirst') : schoolsLoading ? '…' : t('selectSchool')}
              </option>
              {schools.map((s) => (
                <option key={s.udise} value={s.udise}>
                  {hi ? s.nameHi : s.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>
        {errors.school && <p className="mt-1 text-xs text-red-500">{t('required')}</p>}
      </div>

      {/* UDISE override */}
      <div>
        <label className={labelClass}>{t('udiseLabel')}</label>
        <input
          type="text"
          value={udiseOverride}
          onChange={(e) => {
            setUdiseOverride(e.target.value);
            setErrors((prev) => ({ ...prev, school: '' }));
          }}
          placeholder={t('udisePh')}
          className={`mt-1.5 ${selectClass}`}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>
          {t('descriptionLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setErrors((prev) => ({ ...prev, description: '' }));
          }}
          rows={5}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder={t('descriptionPh')}
          className={`mt-1.5 ${selectClass} resize-none ${errors.description ? errorBorder : ''}`}
        />
        <p className="mt-1 text-right text-xs text-text-secondary">
          {description.length}/{MAX_DESCRIPTION_LENGTH} · {t('minDescNote')}
        </p>
        {errors.description && (
          <span className="text-xs text-red-500">
            {errors.description === 'tooShort' ? t('descTooShort') : t('required')}
          </span>
        )}
      </div>

      {/* Evidence upload */}
      <div>
        <label className={labelClass}>{t('evidenceLabel')}</label>
        <div className="mt-1.5 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface">
            {evidenceUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Paperclip size={16} />
            )}
            {t('chooseFile')}
            <input
              ref={evidenceInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleEvidenceChange}
              disabled={evidenceUploading}
              className="hidden"
            />
          </label>
          <span className="truncate text-sm text-text-secondary">
            {evidenceUploading ? t('uploading') : evidenceFileName || t('noFileChosen')}
          </span>
        </div>
        {evidenceError && <p className="mt-1 text-xs text-red-500">{evidenceError}</p>}
        <p className="mt-1 text-xs text-text-secondary">{t('evidenceNote')}</p>
      </div>

      {/* CAPTCHA */}
      <div>
        <label className={labelClass}>
          {t('captchaLabel')} <span className="text-red-500">*</span>
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-sm font-semibold tracking-wider text-navy-900">
            {captcha ? `${captcha.question} = ?` : '…'}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={captchaAnswer}
            onChange={(e) => {
              setCaptchaAnswer(e.target.value);
              setErrors((prev) => ({ ...prev, captcha: '' }));
              setSubmitError('');
            }}
            placeholder={t('captchaPh')}
            maxLength={3}
            className={`${selectClass} max-w-24 ${errors.captcha ? errorBorder : ''}`}
          />
          <button
            type="button"
            onClick={loadCaptcha}
            title={t('captchaRefresh')}
            className="rounded-lg border border-border p-2.5 text-text-secondary transition-colors hover:bg-surface"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {errors.captcha && <span className="text-xs text-red-500">{t('required')}</span>}
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !otpSent}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {t('verifyOtpToSubmit')}
      </button>
    </div>
  );
}
