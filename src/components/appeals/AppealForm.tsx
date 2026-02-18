'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Lock, Paperclip } from 'lucide-react';
import { saveAppealDraft, submitAppeal } from '@/lib/actions/finalization';
import EvidenceUploader, { type EvidenceFile } from '@/components/evidence/EvidenceUploader';

type DiffItem = {
  parameterId: string;
  code: string;
  titleEn: string;
  titleHi: string;
  domainTitleEn: string;
  domainTitleHi: string;
  schoolSelectedOptionKey: string;
  verifierSelectedOptionKey: string;
  options: { key: string; labelEn: string; labelHi: string }[];
  existingJustification: string;
  decision: string | null;
  appealItemId: string | null;
  evidenceRequired: boolean;
  evidence: EvidenceFile[];
};

export default function AppealForm({
  schoolUdise, userId, cycleId, frameworkId, diffs, appealStatus, expired,
}: {
  schoolUdise: string; userId: string; cycleId: string; frameworkId: string;
  diffs: DiffItem[]; appealStatus: string | null; expired: boolean;
}) {
  const t = useTranslations('appeal');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justifications, setJustifications] = useState<Record<string, string>>(
    Object.fromEntries(diffs.map((d) => [d.parameterId, d.existingJustification])),
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const isLocked = appealStatus === 'SUBMITTED' || appealStatus === 'DECIDED';
  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);

  const optLabel = (options: DiffItem['options'], key: string) => {
    const opt = options.find((o) => o.key === key);
    return opt ? label(opt.labelEn, opt.labelHi) : key.replace(/_/g, ' ');
  };

  const handleSave = () => {
    setMsg(''); setErr('');
    startTransition(async () => {
      const items = Object.entries(justifications).map(([parameterId, schoolJustification]) => ({
        parameterId, schoolJustification,
      }));
      const res = await saveAppealDraft(schoolUdise, cycleId, frameworkId, items);
      if (res.success) setMsg(t('savedDraft'));
      else setErr(res.error ?? t('saveError'));
    });
  };

  const handleSubmit = () => {
    if (!confirm(t('submitConfirm'))) return;
    setMsg(''); setErr('');
    startTransition(async () => {
      const items = Object.entries(justifications).map(([parameterId, schoolJustification]) => ({
        parameterId, schoolJustification,
      }));
      await saveAppealDraft(schoolUdise, cycleId, frameworkId, items);
      const res = await submitAppeal(schoolUdise, cycleId);
      if (res.success) { setMsg(t('submitted')); router.refresh(); }
      else setErr(res.error ?? t('submitError'));
    });
  };

  if (diffs.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
        <CheckCircle2 size={16} className="mr-1 inline" /> {t('noDiffs')}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          <Lock size={16} /> {appealStatus === 'DECIDED' ? t('decided') : t('lockedBanner')}
        </div>
      )}

      {msg && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

      <p className="text-sm text-text-secondary">{t('diffsCount', { count: diffs.length })}</p>

      {diffs.map((d) => (
        <div key={d.parameterId} className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-indigo-600">{label(d.domainTitleEn, d.domainTitleHi)}</div>
              <p className="mt-1 text-sm font-semibold text-navy-900">{d.titleHi}</p>
              <p className="text-xs text-text-secondary">{d.titleEn}</p>
            </div>
            {d.evidenceRequired && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Paperclip size={10} /> {t('evidenceReq')}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md bg-surface p-2.5">
              <p className="text-[10px] font-semibold uppercase text-text-secondary">{t('yourLevel')}</p>
              <p className="mt-0.5 text-xs font-medium text-navy-900">{optLabel(d.options, d.schoolSelectedOptionKey)}</p>
            </div>
            <div className="rounded-md bg-indigo-50/50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-indigo-600">{t('verifierLevel')}</p>
              <p className="mt-0.5 text-xs font-medium text-navy-900">{optLabel(d.options, d.verifierSelectedOptionKey)}</p>
            </div>
          </div>

          {d.decision && (
            <div className={`mt-2 rounded-md px-3 py-1.5 text-xs font-medium ${d.decision === 'ACCEPT_SCHOOL' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {d.decision === 'ACCEPT_SCHOOL' ? t('decisionAccepted') : t('decisionKept')}
            </div>
          )}

          {!isLocked && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-text-secondary">{t('justification')}</label>
              <textarea
                value={justifications[d.parameterId] ?? ''}
                onChange={(e) => setJustifications((prev) => ({ ...prev, [d.parameterId]: e.target.value }))}
                maxLength={1000}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
                placeholder={t('justificationPh')}
              />
            </div>
          )}

          {d.evidenceRequired && d.appealItemId && (
            <EvidenceUploader
              files={d.evidence}
              userId={userId}
              kind="APPEAL_ITEM"
              opts={{ appealItemId: d.appealItemId }}
              disabled={isLocked}
            />
          )}

          {d.evidenceRequired && !d.appealItemId && !isLocked && (
            <p className="mt-2 text-[10px] text-amber-600 italic">{t('saveBeforeEvidence')}</p>
          )}
        </div>
      ))}

      {!isLocked && !expired && (
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={isPending}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-navy-700 hover:bg-surface disabled:opacity-50">
            {isPending ? t('saving') : t('saveDraft')}
          </button>
          <button onClick={handleSubmit} disabled={isPending}
            className="rounded-lg bg-navy-700 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            {isPending ? t('submitting') : t('submitAppeal')}
          </button>
        </div>
      )}
    </div>
  );
}
