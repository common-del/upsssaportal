'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Save, Send, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Paperclip } from 'lucide-react';
import { saveVerificationResponses, submitVerification } from '@/lib/actions/verification';
import EvidenceUploader, { type EvidenceFile } from '@/components/evidence/EvidenceUploader';

type Option = { key: string; labelEn: string; labelHi: string };
type Parameter = { id: string; code: string; titleEn: string; titleHi: string; evidenceRequired: boolean; options: Option[] };
type SubDomain = { id: string; code: string; titleEn: string; titleHi: string; parameters: Parameter[] };
type Domain = { id: string; code: string; titleEn: string; titleHi: string; subDomains: SubDomain[] };
type Framework = { id: string; domains: Domain[] };
type ResponseState = Record<string, { selectedOptionKey: string; notes: string | null }>;

type EvidenceMap = Record<string, EvidenceFile[]>;

export default function VerifierAssessmentForm({
  framework, submissionId, verifierUserId, existingResponses, existingEvidence, totalApplicable, isSubmitted: initialSubmitted,
}: {
  framework: Framework; submissionId: string; verifierUserId: string;
  existingResponses: ResponseState; existingEvidence: EvidenceMap; totalApplicable: number; isSubmitted: boolean;
}) {
  const t = useTranslations('verifierAssessment');
  const router = useRouter();
  const [responses, setResponses] = useState<ResponseState>(existingResponses);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState('');
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(initialSubmitted);
  const [activeDomainIdx, setActiveDomainIdx] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const answeredCount = Object.values(responses).filter((r) => r.selectedOptionKey).length;
  const progressPct = totalApplicable > 0 ? Math.round((answeredCount / totalApplicable) * 100) : 0;
  const activeDomain = framework.domains[activeDomainIdx];

  const getDomainProgress = useCallback((domain: Domain) => {
    const params = domain.subDomains.flatMap((sd) => sd.parameters);
    return { answered: params.filter((p) => responses[p.id]?.selectedOptionKey).length, total: params.length };
  }, [responses]);

  const setResponse = (parameterId: string, key: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [parameterId]: { ...prev[parameterId], selectedOptionKey: prev[parameterId]?.selectedOptionKey ?? '', notes: prev[parameterId]?.notes ?? null, [key]: value },
    }));
  };

  const handleSave = () => {
    setSaveMsg(''); setSubmitErrors([]);
    const payload = Object.entries(responses).filter(([, v]) => v.selectedOptionKey)
      .map(([parameterId, v]) => ({ parameterId, selectedOptionKey: v.selectedOptionKey, notes: v.notes ?? undefined }));
    startTransition(async () => {
      const res = await saveVerificationResponses(submissionId, verifierUserId, payload);
      setSaveMsg(res.success ? t('savedSuccess') : (res.message ?? t('saveError')));
      if (res.success) setTimeout(() => setSaveMsg(''), 3000);
    });
  };

  const handleSubmit = () => {
    if (!confirm(t('submitConfirm'))) return;
    setSubmitErrors([]); setSaveMsg('');
    const payload = Object.entries(responses).filter(([, v]) => v.selectedOptionKey)
      .map(([parameterId, v]) => ({ parameterId, selectedOptionKey: v.selectedOptionKey, notes: v.notes ?? undefined }));
    startTransition(async () => {
      await saveVerificationResponses(submissionId, verifierUserId, payload);
      const res = await submitVerification(submissionId, verifierUserId);
      if (res.success) { setIsSubmitted(true); router.refresh(); }
      else if (res.errors) setSubmitErrors(res.errors.map((e) => `${e.parameterCode}: ${e.message}`));
      else setSubmitErrors([res.message ?? t('submitError')]);
    });
  };

  const switchDomain = (idx: number) => {
    setActiveDomainIdx(idx);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-white p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-navy-900">{t('progress')}: {answeredCount} / {totalApplicable}</span>
          <span className={`font-semibold ${isSubmitted ? 'text-green-600' : 'text-navy-700'}`}>
            {isSubmitted ? t('statusSubmitted') : `${progressPct}%`}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
          <div className={`h-full rounded-full transition-all ${isSubmitted ? 'bg-green-500' : 'bg-indigo-600'}`}
            style={{ width: `${isSubmitted ? 100 : progressPct}%` }} />
        </div>
      </div>

      {isSubmitted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} className="shrink-0" /> {t('submittedBanner')}
        </div>
      )}

      <div className="flex gap-4">
        <nav className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-20 space-y-1">
            {framework.domains.map((domain, idx) => {
              const prog = getDomainProgress(domain);
              const isActive = idx === activeDomainIdx;
              const isComplete = prog.answered === prog.total && prog.total > 0;
              return (
                <button key={domain.id} onClick={() => switchDomain(idx)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition ${isActive ? 'bg-indigo-700 text-white' : 'text-navy-900 hover:bg-surface'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isComplete ? 'bg-green-500 text-white' : isActive ? 'bg-white/20 text-white' : 'bg-surface text-navy-700'}`}>
                    {isComplete ? '✓' : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-white' : 'text-navy-900'}`}>{domain.titleHi}</p>
                    <p className={`mt-0.5 text-[11px] leading-tight ${isActive ? 'text-white/70' : 'text-text-secondary'}`}>{domain.titleEn}</p>
                    <p className={`mt-0.5 text-[10px] ${isActive ? 'text-white/60' : 'text-text-secondary'}`}>{prog.answered}/{prog.total}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        <div ref={mainRef} className="min-w-0 flex-1">
          {activeDomain && (
            <div>
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
                <h2 className="font-bold text-navy-900">{activeDomain.titleHi}</h2>
                <p className="text-sm text-text-secondary">{activeDomain.titleEn}</p>
              </div>
              <div className="space-y-6">
                {activeDomain.subDomains.map((sd) => (
                  <div key={sd.id}>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-navy-800">{sd.titleHi}</h3>
                      <p className="text-xs text-text-secondary">{sd.titleEn}</p>
                    </div>
                    <div className="space-y-3">
                      {sd.parameters.map((param) => {
                        const resp = responses[param.id];
                        return (
                          <div key={param.id} className={`rounded-lg border p-4 ${resp?.selectedOptionKey ? 'border-green-200 bg-green-50/30' : 'border-border bg-white'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-navy-900">{param.titleHi}</p>
                                <p className="mt-0.5 text-xs text-text-secondary">{param.titleEn}</p>
                              </div>
                              {param.evidenceRequired && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  <Paperclip size={10} /> {t('evidenceReq')}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 space-y-2">
                              {param.options.map((opt) => {
                                const isSelected = resp?.selectedOptionKey === opt.key;
                                return (
                                  <label key={opt.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : 'border-border hover:border-indigo-200'} ${isSubmitted ? 'pointer-events-none opacity-70' : ''}`}>
                                    <input type="radio" name={`param-${param.id}`} value={opt.key} checked={isSelected}
                                      onChange={() => setResponse(param.id, 'selectedOptionKey', opt.key)} disabled={isSubmitted} className="mt-0.5 shrink-0 accent-indigo-700" />
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-xs leading-relaxed ${isSelected ? 'font-medium text-navy-900' : 'text-navy-800'}`}>{opt.labelHi}</p>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">{opt.labelEn}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <textarea value={resp?.notes ?? ''} onChange={(e) => setResponse(param.id, 'notes', e.target.value)}
                              disabled={isSubmitted} placeholder={t('notesPlaceholder')} maxLength={500} rows={2}
                              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm placeholder:text-text-secondary/50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60" />
                            {param.evidenceRequired && (
                              <EvidenceUploader
                                files={existingEvidence[param.id] ?? []}
                                userId={verifierUserId}
                                kind="VERIFICATION_RESPONSE"
                                opts={{ vSubmissionId: submissionId, parameterId: param.id }}
                                disabled={isSubmitted}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => switchDomain(activeDomainIdx - 1)} disabled={activeDomainIdx === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-surface disabled:opacity-40">
                  <ChevronLeft size={16} /> {t('prevDomain')}
                </button>
                <span className="text-xs text-text-secondary">{activeDomainIdx + 1} / {framework.domains.length}</span>
                <button onClick={() => switchDomain(activeDomainIdx + 1)} disabled={activeDomainIdx === framework.domains.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-surface disabled:opacity-40">
                  {t('nextDomain')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {submitErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800"><AlertCircle size={16} /> {t('submitMissing')}</div>
          <ul className="mt-2 list-inside list-disc text-xs text-red-700">
            {submitErrors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {!isSubmitted && (
        <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-md">
          <button onClick={handleSave} disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-700 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">
            <Save size={16} /> {isPending ? t('saving') : t('saveDraft')}
          </button>
          <button onClick={handleSubmit} disabled={isPending || answeredCount < totalApplicable}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-800 disabled:opacity-50">
            <Send size={16} /> {isPending ? t('submitting') : t('submitFinal')}
          </button>
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
        </div>
      )}
    </div>
  );
}
