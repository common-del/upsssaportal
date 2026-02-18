'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ParameterTable from './ParameterTable';
import DomainWeightsEditor from './DomainWeightsEditor';
import LevelLabelsEditor from './LevelLabelsEditor';
import GradeBandsEditor from './GradeBandsEditor';
import PublishPanel from './PublishPanel';
import { ChevronRight } from 'lucide-react';

type FrameworkData = {
  id: string;
  status: string;
  cycle: { name: string };
  domains: {
    id: string;
    code: string;
    titleEn: string;
    titleHi: string;
    order: number;
    weightPercent: number | null;
    isActive: boolean;
    subDomains: {
      id: string;
      code: string;
      titleEn: string;
      titleHi: string;
      order: number;
      isActive: boolean;
      parameters: {
        id: string;
        code: string;
        titleEn: string;
        titleHi: string;
        order: number;
        applicability: unknown;
        evidenceRequired: boolean;
        dataSources: unknown;
        isActive: boolean;
        options: { id: string; key: string; labelEn: string; labelHi: string; isActive: boolean }[];
        rubricMappings: { id: string; optionKey: string; score: number }[];
      }[];
    }[];
  }[];
  levels: { id: string; key: string; labelEn: string; labelHi: string; order: number }[];
  gradeBands: {
    id: string;
    key: string;
    labelEn: string;
    labelHi: string;
    minPercent: number;
    maxPercent: number;
    order: number;
  }[];
};

type Tab = 'parameters' | 'weights' | 'levels' | 'gradeBands' | 'publish';

export default function FrameworkEditor({
  framework,
  userId,
}: {
  framework: FrameworkData;
  userId: string;
}) {
  const t = useTranslations('framework');
  const readonly = framework.status === 'PUBLISHED';
  const [selectedDomainIdx, setSelectedDomainIdx] = useState(0);
  const [selectedSubDomainIdx, setSelectedSubDomainIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('parameters');

  const domain = framework.domains[selectedDomainIdx];
  const subDomain = domain?.subDomains[selectedSubDomainIdx];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'parameters', label: t('parameters') },
    { key: 'weights', label: t('domainWeights') },
    { key: 'levels', label: t('levelLabels') },
    { key: 'gradeBands', label: t('gradeBands') },
    { key: 'publish', label: t('publish') },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Left sidebar: domains & subdomains */}
      <div className="w-full shrink-0 lg:w-64">
        <div className="rounded-xl border border-border bg-white">
          {framework.domains.map((d, dIdx) => (
            <div key={d.id}>
              <button
                onClick={() => {
                  setSelectedDomainIdx(dIdx);
                  setSelectedSubDomainIdx(0);
                  setActiveTab('parameters');
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                  dIdx === selectedDomainIdx
                    ? 'bg-navy-50 font-semibold text-navy-900'
                    : 'hover:bg-surface text-text-secondary'
                } ${dIdx > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs text-navy-500">{d.code}</span>
                  <p className="truncate text-sm">{d.titleEn}</p>
                  {d.weightPercent !== null && (
                    <span className="text-[10px] text-text-secondary">{d.weightPercent}%</span>
                  )}
                </div>
                <ChevronRight size={14} className="shrink-0" />
              </button>

              {/* Subdomains when domain is selected */}
              {dIdx === selectedDomainIdx && (
                <div className="border-t border-border bg-surface/50">
                  {d.subDomains.map((sd, sdIdx) => (
                    <button
                      key={sd.id}
                      onClick={() => {
                        setSelectedSubDomainIdx(sdIdx);
                        setActiveTab('parameters');
                      }}
                      className={`block w-full px-6 py-2 text-left text-xs transition ${
                        sdIdx === selectedSubDomainIdx
                          ? 'bg-navy-100/50 font-semibold text-navy-900'
                          : 'text-text-secondary hover:bg-surface'
                      }`}
                    >
                      <span className="font-mono">{sd.code}</span> – {sd.titleEn}
                      <span className="ml-1 text-text-secondary">({sd.parameters.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Tab bar */}
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                activeTab === tab.key
                  ? 'bg-navy-700 font-medium text-white'
                  : 'text-text-secondary hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'parameters' && subDomain && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-navy-900">
              {domain.code} → {subDomain.code} – {subDomain.titleEn}
            </h3>
            <ParameterTable parameters={subDomain.parameters} readonly={readonly} />
          </div>
        )}

        {activeTab === 'weights' && (
          <DomainWeightsEditor domains={framework.domains} readonly={readonly} />
        )}

        {activeTab === 'levels' && (
          <LevelLabelsEditor levels={framework.levels} readonly={readonly} />
        )}

        {activeTab === 'gradeBands' && (
          <GradeBandsEditor bands={framework.gradeBands} readonly={readonly} />
        )}

        {activeTab === 'publish' && (
          <PublishPanel frameworkId={framework.id} userId={userId} readonly={readonly} />
        )}
      </div>
    </div>
  );
}
