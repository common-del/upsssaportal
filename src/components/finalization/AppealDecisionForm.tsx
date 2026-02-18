'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { decideAppeal } from '@/lib/actions/finalization';

type Item = {
  id: string; parameterId: string; code: string;
  titleEn: string; titleHi: string;
  domainTitleEn: string; domainTitleHi: string;
  schoolSelectedOptionKey: string; verifierSelectedOptionKey: string;
  schoolJustification: string | null; decision: string;
  options: { key: string; labelEn: string; labelHi: string }[];
};

export default function AppealDecisionForm({
  appealId, items, appealStatus, actorUserId,
}: {
  appealId: string; items: Item[]; appealStatus: string; actorUserId: string;
}) {
  const t = useTranslations('finalization');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [decisions, setDecisions] = useState<Record<string, 'ACCEPT_SCHOOL' | 'KEEP_VERIFIER'>>(
    Object.fromEntries(items.map((i) => [i.id, (i.decision === 'ACCEPT_SCHOOL' || i.decision === 'KEEP_VERIFIER') ? i.decision : 'KEEP_VERIFIER'])),
  );
  const [msg, setMsg] = useState('');

  const isDecided = appealStatus === 'DECIDED';
  const label = (en: string, hi: string) => (locale === 'hi' ? hi || en : en);

  const optLabel = (options: Item['options'], key: string) => {
    const opt = options.find((o) => o.key === key);
    return opt ? label(opt.labelEn, opt.labelHi) : key.replace(/_/g, ' ');
  };

  const handleSubmit = () => {
    if (!confirm(t('decideConfirm'))) return;
    setMsg('');
    startTransition(async () => {
      const decs = Object.entries(decisions).map(([appealItemId, decision]) => ({ appealItemId, decision }));
      const res = await decideAppeal(actorUserId, appealId, decs);
      if (res.success) { setMsg(t('decisionSaved')); router.refresh(); }
      else setMsg(res.error ?? 'Error');
    });
  };

  return (
    <div className="mt-6 space-y-4">
      {isDecided && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <Lock size={16} /> {t('alreadyDecided')}
        </div>
      )}
      {msg && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{msg}</div>}

      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-white p-4">
          <div className="text-xs font-medium text-indigo-600">{label(item.domainTitleEn, item.domainTitleHi)}</div>
          <p className="mt-1 text-sm font-semibold text-navy-900">{item.titleHi}</p>
          <p className="text-xs text-text-secondary">{item.titleEn}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md bg-surface p-2.5">
              <p className="text-[10px] font-semibold uppercase text-text-secondary">{t('schoolChoice')}</p>
              <p className="mt-0.5 text-xs font-medium text-navy-900">{optLabel(item.options, item.schoolSelectedOptionKey)}</p>
            </div>
            <div className="rounded-md bg-indigo-50/50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-indigo-600">{t('verifierChoice')}</p>
              <p className="mt-0.5 text-xs font-medium text-navy-900">{optLabel(item.options, item.verifierSelectedOptionKey)}</p>
            </div>
          </div>

          {item.schoolJustification && (
            <div className="mt-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">
              <span className="font-semibold">{t('schoolJustification')}:</span> {item.schoolJustification}
            </div>
          )}

          <div className="mt-3 flex gap-3">
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${decisions[item.id] === 'ACCEPT_SCHOOL' ? 'border-green-400 bg-green-50 text-green-700' : 'border-border text-text-secondary hover:bg-surface'}`}>
              <input type="radio" name={`dec-${item.id}`} disabled={isDecided}
                checked={decisions[item.id] === 'ACCEPT_SCHOOL'}
                onChange={() => setDecisions((p) => ({ ...p, [item.id]: 'ACCEPT_SCHOOL' }))}
                className="accent-green-600" />
              {t('acceptSchool')}
            </label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${decisions[item.id] === 'KEEP_VERIFIER' ? 'border-navy-400 bg-navy-50 text-navy-700' : 'border-border text-text-secondary hover:bg-surface'}`}>
              <input type="radio" name={`dec-${item.id}`} disabled={isDecided}
                checked={decisions[item.id] === 'KEEP_VERIFIER'}
                onChange={() => setDecisions((p) => ({ ...p, [item.id]: 'KEEP_VERIFIER' }))}
                className="accent-navy-600" />
              {t('keepVerifier')}
            </label>
          </div>
        </div>
      ))}

      {!isDecided && (
        <button onClick={handleSubmit} disabled={isPending}
          className="rounded-lg bg-navy-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
          {isPending ? t('deciding') : t('submitDecisions')}
        </button>
      )}
    </div>
  );
}
