'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Save, Send, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, ChevronLeft, Paperclip, Circle } from 'lucide-react';
import { saveResponses, submitSubmission } from '@/lib/actions/selfAssessment';
import { type EvidenceFile } from '@/components/evidence/EvidenceUploader';
import EvidenceChecklistModal from '@/components/evidence/EvidenceChecklistModal';
import { cn } from '@/lib/cn';

type Option = { key: string; labelEn: string; labelHi: string };
type Parameter = {
  id: string; code: string; titleEn: string; titleHi: string;
  evidenceRequired: boolean; evidenceChecklistEn: string[]; evidenceChecklistHi: string[]; options: Option[];
};
type SubDomain = { id: string; code: string; titleEn: string; titleHi: string; parameters: Parameter[] };
type Domain = { id: string; code: string; titleEn: string; titleHi: string; subDomains: SubDomain[] };
type Framework = { id: string; domains: Domain[] };
type ResponseState = Record<string, { selectedOptionKey: string; notes: string | null }>;

type EvidenceMap = Record<string, EvidenceFile[]>;

const NAVY = '#1B2A6B';

function hasHindiTranslation(labelHi: string, labelEn: string) {
  const hi = labelHi.trim();
  const en = labelEn.trim();
  return hi.length > 0 && hi !== en;
}

function DomainStatusIcon({ answered, total, active }: { answered: number; total: number; active: boolean }) {
  if (total > 0 && answered === total) {
    return (
      <CheckCircle2
        className={cn('h-5 w-5 shrink-0', active ? 'text-green-300' : 'text-green-600')}
      />
    );
  }
  if (answered === 0) {
    return (
      <Circle
        className={cn('h-5 w-5 shrink-0', active ? 'text-white/50' : 'text-gray-300')}
        strokeWidth={1.5}
      />
    );
  }
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <Circle className={cn('h-5 w-5', active ? 'text-white/40' : 'text-gray-300')} strokeWidth={1.5} />
      <span
        className={cn(
          'absolute left-0 top-0 h-5 w-2.5 overflow-hidden rounded-l-full',
          active ? 'bg-white/70' : 'bg-amber-400',
        )}
      />
    </span>
  );
}

export default function SelfAssessmentForm({
  framework, submissionId, schoolUdise, userId, existingResponses, existingEvidence, totalApplicable, isSubmitted: initialSubmitted,
  variant = 'sidebar',
}: {
  framework: Framework; submissionId: string; schoolUdise: string; userId: string;
  existingResponses: ResponseState; existingEvidence: EvidenceMap; totalApplicable: number; isSubmitted: boolean;
  variant?: 'sidebar' | 'accordion' | 'school';
}) {
  const t = useTranslations('selfAssessment');
  const router = useRouter();
  const [responses, setResponses] = useState<ResponseState>(existingResponses);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState('');
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(initialSubmitted);
  const [activeDomainIdx, setActiveDomainIdx] = useState(0);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(framework.domains.map((d, i) => [d.id, i === 0])),
  );
  const [evidenceMap, setEvidenceMap] = useState<EvidenceMap>(existingEvidence);
  const [evidenceModalParamId, setEvidenceModalParamId] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const allParameters = framework.domains.flatMap((d) => d.subDomains.flatMap((sd) => sd.parameters));
  const evidenceModalParam = evidenceModalParamId ? allParameters.find((p) => p.id === evidenceModalParamId) ?? null : null;

  const answeredCount = Object.values(responses).filter((r) => r.selectedOptionKey).length;
  const progressPct = totalApplicable > 0 ? Math.round((answeredCount / totalApplicable) * 100) : 0;

  const activeDomain = framework.domains[activeDomainIdx];

  const getDomainProgress = useCallback((domain: Domain) => {
    const params = domain.subDomains.flatMap((sd) => sd.parameters);
    const answered = params.filter((p) => responses[p.id]?.selectedOptionKey).length;
    return { answered, total: params.length };
  }, [responses]);

  const setResponse = (parameterId: string, key: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        selectedOptionKey: prev[parameterId]?.selectedOptionKey ?? '',
        notes: prev[parameterId]?.notes ?? null,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    setSaveMsg('');
    setSubmitErrors([]);
    const payload = Object.entries(responses)
      .filter(([, v]) => v.selectedOptionKey)
      .map(([parameterId, v]) => ({ parameterId, selectedOptionKey: v.selectedOptionKey, notes: v.notes ?? undefined }));

    startTransition(async () => {
      const res = await saveResponses(submissionId, schoolUdise, payload);
      if (res.success) {
        setSaveMsg(t('savedSuccess'));
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg(res.message ?? t('saveError'));
      }
    });
  };

  const handleSubmit = () => {
    if (!confirm(t('submitConfirm'))) return;
    setSubmitErrors([]);
    setSaveMsg('');
    const payload = Object.entries(responses)
      .filter(([, v]) => v.selectedOptionKey)
      .map(([parameterId, v]) => ({ parameterId, selectedOptionKey: v.selectedOptionKey, notes: v.notes ?? undefined }));

    startTransition(async () => {
      await saveResponses(submissionId, schoolUdise, payload);
      const res = await submitSubmission(submissionId, schoolUdise);
      if (res.success) {
        setIsSubmitted(true);
        router.refresh();
      } else if (res.errors) {
        setSubmitErrors(res.errors.map((e) => `${e.parameterCode}: ${e.message}`));
      } else {
        setSubmitErrors([res.message ?? t('submitError')]);
      }
    });
  };

  const switchDomain = (idx: number) => {
    setActiveDomainIdx(idx);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function renderParameter(param: Parameter, schoolLayout = false) {
    const resp = responses[param.id];
    return (
      <div
        key={param.id}
        className={cn(
          'rounded-xl border p-4',
          resp?.selectedOptionKey ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{param.titleEn}</p>
            {hasHindiTranslation(param.titleHi, param.titleEn) && (
              <p className="mt-0.5 text-xs text-gray-500">{param.titleHi}</p>
            )}
          </div>
          {param.evidenceRequired && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <Paperclip size={10} /> {t('evidenceReq')}
            </span>
          )}
        </div>

        <div className={cn('mt-3 space-y-2', !schoolLayout && 'flex flex-wrap gap-2')}>
          {param.options.map((opt) => {
            const isSelected = resp?.selectedOptionKey === opt.key;
            const showHindi = hasHindiTranslation(opt.labelHi, opt.labelEn);

            if (schoolLayout) {
              return (
                <label
                  key={opt.key}
                  className={cn(
                    'flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                    isSelected
                      ? 'border-green-600 bg-[#ECFDF5]'
                      : 'border-gray-200 bg-white hover:bg-gray-50',
                    isSubmitted && 'pointer-events-none opacity-70',
                  )}
                >
                  <input
                    type="radio"
                    name={`param-${param.id}`}
                    value={opt.key}
                    checked={isSelected}
                    onChange={() => setResponse(param.id, 'selectedOptionKey', opt.key)}
                    disabled={isSubmitted}
                    className="mt-1 shrink-0 accent-green-700"
                  />
                  <div className="min-w-0 flex-1">
                    {showHindi ? (
                      <>
                        <p className={cn('text-sm font-semibold leading-snug', isSelected ? 'text-green-900' : 'text-gray-900')}>
                          {opt.labelHi}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-gray-500">{opt.labelEn}</p>
                      </>
                    ) : (
                      // TODO: add Hindi translations for rating options in framework seed data
                      <p className={cn('text-sm font-medium leading-snug', isSelected ? 'text-green-900' : 'text-gray-900')}>
                        {opt.labelEn}
                      </p>
                    )}
                  </div>
                </label>
              );
            }

            return (
              <button
                key={opt.key}
                type="button"
                disabled={isSubmitted}
                onClick={() => setResponse(param.id, 'selectedOptionKey', opt.key)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium transition',
                  isSelected
                    ? 'border-[#1B2A6B] bg-[#1B2A6B] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#1B2A6B]',
                  isSubmitted && 'pointer-events-none opacity-70',
                )}
              >
                {opt.labelEn}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setEvidenceModalParamId(param.id)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-[#1B2A6B] hover:bg-gray-50"
        >
          <Paperclip size={14} /> {t('uploadEvidence')}
          {(evidenceMap[param.id]?.length ?? 0) > 0 && (
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              {evidenceMap[param.id]!.length}
            </span>
          )}
        </button>

        <textarea
          value={resp?.notes ?? ''}
          onChange={(e) => setResponse(param.id, 'notes', e.target.value)}
          disabled={isSubmitted}
          placeholder={t('notesPlaceholder')}
          maxLength={500}
          rows={2}
          className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
        />
      </div>
    );
  }

  function renderSchoolLayout() {
    return (
      <>
        <div className="mb-4 lg:hidden">
          <select
            value={activeDomainIdx}
            onChange={(e) => switchDomain(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            {framework.domains.map((domain, idx) => {
              const prog = getDomainProgress(domain);
              return (
                <option key={domain.id} value={idx}>
                  {domain.titleEn} ({prog.answered}/{prog.total})
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex gap-6">
          <nav className="hidden w-[240px] shrink-0 lg:block">
            <div className="sticky top-24 space-y-2">
              {framework.domains.map((domain, idx) => {
                const prog = getDomainProgress(domain);
                const isActive = idx === activeDomainIdx;
                const isComplete = prog.total > 0 && prog.answered === prog.total;
                const isPartial = prog.answered > 0 && !isComplete;

                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => switchDomain(idx)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition',
                      isActive
                        ? 'text-white shadow-sm'
                        : isComplete
                          ? 'bg-white text-[#1B2A6B] hover:bg-gray-50'
                          : 'bg-white text-gray-500 hover:bg-gray-50',
                    )}
                    style={isActive ? { backgroundColor: NAVY } : undefined}
                  >
                    <DomainStatusIcon answered={prog.answered} total={prog.total} active={isActive} />
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-sm font-bold leading-tight',
                        isActive ? 'text-white' : isComplete ? 'text-[#1B2A6B]' : 'text-gray-600',
                      )}>
                        {domain.titleEn}
                      </p>
                      <p className={cn(
                        'mt-0.5 text-xs leading-tight',
                        isActive ? 'text-white/70' : 'text-gray-400',
                      )}>
                        {domain.titleHi}
                      </p>
                      <p className={cn(
                        'mt-2 text-[11px] font-medium',
                        isActive ? 'text-white/80' : isComplete ? 'text-green-600' : isPartial ? 'text-amber-600' : 'text-gray-400',
                      )}>
                        {prog.answered}/{prog.total}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          <div ref={mainRef} className="min-w-0 flex-1">
            {activeDomain && (
              <div>
                <div className="mb-5 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-lg font-bold text-[#1B2A6B]">{activeDomain.titleEn}</h2>
                  <p className="mt-1 text-sm text-gray-500">{activeDomain.titleHi}</p>
                </div>

                <div className="space-y-8">
                  {activeDomain.subDomains.map((sd) => (
                    <div key={sd.id}>
                      <div className="mb-4 border-b border-gray-100 pb-2">
                        <h3 className="text-base font-semibold text-gray-900">{sd.titleEn}</h3>
                        {hasHindiTranslation(sd.titleHi, sd.titleEn) && (
                          <p className="text-sm text-gray-500">{sd.titleHi}</p>
                        )}
                      </div>
                      <div className="space-y-4">
                        {sd.parameters.map((param) => renderParameter(param, true))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-4 rounded-lg border border-border bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-navy-900">{t('progress')}: {answeredCount} / {totalApplicable}</span>
          <span className={`font-semibold ${isSubmitted ? 'text-green-600' : 'text-navy-700'}`}>
            {isSubmitted ? t('statusSubmitted') : `${progressPct}%`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
          <div className={`h-full rounded-full transition-all ${isSubmitted ? 'bg-green-500' : 'bg-navy-600'}`}
            style={{ width: `${isSubmitted ? 100 : progressPct}%` }} />
        </div>
      </div>

      {isSubmitted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} className="shrink-0" /> {t('submittedBanner')}
        </div>
      )}

      {variant === 'school' ? (
        renderSchoolLayout()
      ) : variant === 'accordion' ? (
        <div className="space-y-4">
          {framework.domains.map((domain, idx) => {
            const prog = getDomainProgress(domain);
            const open = expandedDomains[domain.id];
            return (
              <div key={domain.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedDomains((prev) => ({ ...prev, [domain.id]: !prev[domain.id] }))}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50"
                >
                  {open ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B2A6B] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{domain.titleEn}</p>
                    <p className="text-xs text-gray-500">{domain.titleHi} · {prog.answered}/{prog.total} rated</p>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-5 pb-5">
                    {domain.subDomains.map((sd) => (
                      <div key={sd.id} className="mt-4">
                        <h3 className="text-sm font-semibold text-gray-800">{sd.titleEn}</h3>
                        <p className="text-xs text-gray-500">{sd.titleHi}</p>
                        <div className="mt-3 space-y-3">
                          {sd.parameters.map((param) => renderParameter(param))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      /* Sidebar + Main layout */
      <div className="flex gap-4">
        {/* Left sidebar - domain navigation */}
        <nav className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-20 space-y-1">
            {framework.domains.map((domain, idx) => {
              const prog = getDomainProgress(domain);
              const isActive = idx === activeDomainIdx;
              const isComplete = prog.answered === prog.total && prog.total > 0;
              return (
                <button
                  key={domain.id}
                  onClick={() => switchDomain(idx)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                    isActive ? 'bg-navy-700 text-white' : 'text-navy-900 hover:bg-surface'
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isComplete ? 'bg-green-500 text-white' : isActive ? 'bg-white/20 text-white' : 'bg-surface text-navy-700'
                  }`}>
                    {isComplete ? '✓' : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-white' : 'text-navy-900'}`}>
                      {domain.titleHi}
                    </p>
                    <p className={`mt-0.5 text-[11px] leading-tight ${isActive ? 'text-white/70' : 'text-text-secondary'}`}>
                      {domain.titleEn}
                    </p>
                    <p className={`mt-0.5 text-[10px] ${isActive ? 'text-white/60' : 'text-text-secondary'}`}>
                      {prog.answered}/{prog.total}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile domain selector */}
        <div className="mb-3 md:hidden">
          <select
            value={activeDomainIdx}
            onChange={(e) => switchDomain(parseInt(e.target.value))}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            {framework.domains.map((domain, idx) => {
              const prog = getDomainProgress(domain);
              return (
                <option key={domain.id} value={idx}>
                  {domain.code}. {domain.titleHi} / {domain.titleEn} ({prog.answered}/{prog.total})
                </option>
              );
            })}
          </select>
        </div>

        {/* Main content area */}
        <div ref={mainRef} className="min-w-0 flex-1">
          {activeDomain && (
            <div>
              {/* Domain header */}
              <div className="mb-4 rounded-lg border border-navy-200 bg-navy-50/50 px-4 py-3">
                <h2 className="font-bold text-navy-900">{activeDomain.titleHi}</h2>
                <p className="text-sm text-text-secondary">{activeDomain.titleEn}</p>
              </div>

              {/* Sub-domains and parameters */}
              <div className="space-y-6">
                {activeDomain.subDomains.map((sd) => (
                  <div key={sd.id}>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-navy-800">{sd.titleHi}</h3>
                      <p className="text-xs text-text-secondary">{sd.titleEn}</p>
                    </div>
                    <div className="space-y-3">
                      {sd.parameters.map((param) => renderParameter(param))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Domain navigation buttons */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => switchDomain(activeDomainIdx - 1)}
                  disabled={activeDomainIdx === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-surface disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> {t('prevDomain')}
                </button>
                <span className="text-xs text-text-secondary">
                  {activeDomainIdx + 1} / {framework.domains.length}
                </span>
                <button
                  onClick={() => switchDomain(activeDomainIdx + 1)}
                  disabled={activeDomainIdx === framework.domains.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-surface disabled:opacity-40"
                >
                  {t('nextDomain')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Submit errors */}
      {submitErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertCircle size={16} /> {t('submitMissing')}
          </div>
          <ul className="mt-2 list-inside list-disc text-xs text-red-700">
            {submitErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            {submitErrors.length > 10 && <li>…{t('andMore', { count: submitErrors.length - 10 })}</li>}
          </ul>
        </div>
      )}

      {/* Sticky action bar */}
      {!isSubmitted && (
        <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-md">
          <button onClick={handleSave} disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-700 px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:opacity-50">
            <Save size={16} /> {isPending ? t('saving') : t('saveDraft')}
          </button>
          <button onClick={handleSubmit} disabled={isPending || answeredCount < totalApplicable}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50">
            <Send size={16} /> {isPending ? t('submitting') : t('submitFinal')}
          </button>
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
        </div>
      )}

      {evidenceModalParam && (
        <EvidenceChecklistModal
          parameterId={evidenceModalParam.id}
          titleEn={evidenceModalParam.titleEn}
          titleHi={evidenceModalParam.titleHi}
          checklist={evidenceModalParam.evidenceChecklistEn.map((en, i) => ({
            en,
            hi: evidenceModalParam.evidenceChecklistHi[i] ?? '',
          }))}
          existingFiles={evidenceMap[evidenceModalParam.id] ?? []}
          userId={userId}
          saSubmissionId={submissionId}
          disabled={isSubmitted}
          onClose={() => setEvidenceModalParamId(null)}
          onFilesChange={(files) => setEvidenceMap((prev) => ({ ...prev, [evidenceModalParam.id]: files }))}
        />
      )}
    </div>
  );
}
