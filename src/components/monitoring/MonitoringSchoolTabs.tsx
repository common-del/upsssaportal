'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList, UserCheck, GitCompare } from 'lucide-react';

type Option = { key: string; labelEn: string; labelHi: string };
type Parameter = { id: string; code: string; titleEn: string; titleHi: string; options: Option[] };
type SubDomain = { id: string; titleEn: string; titleHi: string; parameters: Parameter[] };
type Domain = { id: string; code: string; titleEn: string; titleHi: string; subDomains: SubDomain[] };
type ResponseMap = Record<string, { selectedOptionKey: string; notes: string | null }>;

export default function MonitoringSchoolTabs({
  domains, saResponses, vResponses, saStatus, vStatus,
}: {
  domains: Domain[]; saResponses: ResponseMap; vResponses: ResponseMap; saStatus: string; vStatus: string;
}) {
  const t = useTranslations('monitoring');
  const [tab, setTab] = useState<'sa' | 'verification' | 'comparison'>('sa');

  const tabBtn = (key: typeof tab, icon: React.ReactNode, label: string) => (
    <button onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-navy-700 text-white' : 'bg-surface text-text-secondary hover:bg-navy-100'}`}
    >{icon} {label}</button>
  );

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {tabBtn('sa', <ClipboardList size={16} />, t('tabSelfAssessment'))}
        {tabBtn('verification', <UserCheck size={16} />, t('tabVerification'))}
        {tabBtn('comparison', <GitCompare size={16} />, t('tabComparison'))}
      </div>

      <div className="mt-4">
        {tab === 'sa' && <ResponseView domains={domains} responses={saResponses} status={saStatus} emptyMsg={t('noResponses')} />}
        {tab === 'verification' && <ResponseView domains={domains} responses={vResponses} status={vStatus} emptyMsg={t('noVerifierResponses')} />}
        {tab === 'comparison' && <ComparisonView domains={domains} saResponses={saResponses} vResponses={vResponses} />}
      </div>
    </div>
  );
}

function ResponseView({ domains, responses, emptyMsg }: {
  domains: Domain[]; responses: ResponseMap; status?: string; emptyMsg: string;
}) {
  const t = useTranslations('monitoring');
  if (Object.keys(responses).length === 0) {
    return <div className="rounded-lg border border-border bg-white p-6 text-center text-text-secondary">{emptyMsg}</div>;
  }

  return (
    <div className="space-y-4">
      {domains.map((domain) => (
        <div key={domain.id} className="rounded-xl border border-border bg-white">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-navy-900">{domain.titleHi}</h2>
            <p className="text-xs text-text-secondary">{domain.titleEn}</p>
          </div>
          <div className="px-5 pb-4">
            {domain.subDomains.map((sd) => (
              <div key={sd.id} className="mt-3">
                <h3 className="mb-2 text-xs font-semibold text-navy-800">
                  {sd.titleHi} <span className="font-normal text-text-secondary">/ {sd.titleEn}</span>
                </h3>
                <div className="space-y-2">
                  {sd.parameters.map((param) => {
                    const resp = responses[param.id];
                    const selectedOpt = resp ? param.options.find((o) => o.key === resp.selectedOptionKey) : null;
                    return (
                      <div key={param.id} className={`rounded-lg border p-3 ${resp ? 'border-green-200 bg-green-50/30' : 'border-border'}`}>
                        <p className="text-xs font-medium text-navy-900">{param.titleHi}</p>
                        <p className="text-xs text-text-secondary">{param.titleEn}</p>
                        {resp ? (
                          <div className="mt-1.5">
                            <p className="text-xs">
                              <span className="font-medium text-navy-700">{resp.selectedOptionKey.replace(/_/g, ' ')}:</span>{' '}
                              <span className="text-navy-900">{selectedOpt?.labelHi}</span>
                            </p>
                            {selectedOpt && <p className="text-xs text-text-secondary">{selectedOpt.labelEn}</p>}
                            {resp.notes && <p className="mt-1 rounded bg-surface px-2 py-1 text-xs italic text-text-secondary">{resp.notes}</p>}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs italic text-text-secondary">— {t('notAnswered')} —</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonView({ domains, saResponses, vResponses }: {
  domains: Domain[]; saResponses: ResponseMap; vResponses: ResponseMap;
}) {
  const t = useTranslations('monitoring');
  let matches = 0;
  let diffs = 0;
  let total = 0;

  // Pre-compute counts
  for (const domain of domains) {
    for (const sd of domain.subDomains) {
      for (const param of sd.parameters) {
        const sa = saResponses[param.id]?.selectedOptionKey;
        const v = vResponses[param.id]?.selectedOptionKey;
        if (sa || v) {
          total++;
          if (sa && v) {
            if (sa === v) matches++;
            else diffs++;
          }
        }
      }
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-4 text-sm">
        <span className="rounded-lg border border-border bg-white px-3 py-2">
          {t('compTotal')}: <span className="font-bold">{total}</span>
        </span>
        <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-700">
          {t('compMatch')}: <span className="font-bold">{matches}</span>
        </span>
        <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {t('compDiff')}: <span className="font-bold">{diffs}</span>
        </span>
      </div>

      <div className="space-y-4">
        {domains.map((domain) => (
          <div key={domain.id} className="rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-navy-900">{domain.titleHi}</h2>
              <p className="text-xs text-text-secondary">{domain.titleEn}</p>
            </div>
            <div className="px-5 pb-4">
              {domain.subDomains.map((sd) => (
                <div key={sd.id} className="mt-3">
                  <h3 className="mb-2 text-xs font-semibold text-navy-800">
                    {sd.titleHi} <span className="font-normal text-text-secondary">/ {sd.titleEn}</span>
                  </h3>
                  <div className="space-y-2">
                    {sd.parameters.map((param) => {
                      const sa = saResponses[param.id];
                      const v = vResponses[param.id];
                      const saOpt = sa ? param.options.find((o) => o.key === sa.selectedOptionKey) : null;
                      const vOpt = v ? param.options.find((o) => o.key === v.selectedOptionKey) : null;
                      const isDiff = sa && v && sa.selectedOptionKey !== v.selectedOptionKey;

                      return (
                        <div key={param.id} className={`rounded-lg border p-3 ${isDiff ? 'border-red-200 bg-red-50/30' : 'border-border'}`}>
                          <p className="text-xs font-medium text-navy-900">{param.titleHi}</p>
                          <p className="text-xs text-text-secondary">{param.titleEn}</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md bg-surface p-2">
                              <p className="text-[10px] font-semibold uppercase text-text-secondary">{t('selfAssessment')}</p>
                              {sa ? (
                                <>
                                  <p className="mt-0.5 text-xs font-medium text-navy-900">{sa.selectedOptionKey.replace(/_/g, ' ')}</p>
                                  <p className="text-[11px] text-navy-800">{saOpt?.labelHi}</p>
                                  <p className="text-[11px] text-text-secondary">{saOpt?.labelEn}</p>
                                </>
                              ) : <p className="mt-0.5 text-xs italic text-text-secondary">—</p>}
                            </div>
                            <div className="rounded-md bg-indigo-50/50 p-2">
                              <p className="text-[10px] font-semibold uppercase text-indigo-600">{t('verification')}</p>
                              {v ? (
                                <>
                                  <p className="mt-0.5 text-xs font-medium text-navy-900">{v.selectedOptionKey.replace(/_/g, ' ')}</p>
                                  <p className="text-[11px] text-navy-800">{vOpt?.labelHi}</p>
                                  <p className="text-[11px] text-text-secondary">{vOpt?.labelEn}</p>
                                </>
                              ) : <p className="mt-0.5 text-xs italic text-text-secondary">—</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
