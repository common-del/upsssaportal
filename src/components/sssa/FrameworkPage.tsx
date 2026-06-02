'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, Pencil, Plus, Save } from 'lucide-react';
import {
  DOMAIN_WEIGHTAGES,
  FRAMEWORK_DOMAINS,
  PERFORMANCE_LEVELS,
  UP_SQAAF_OVERVIEW,
} from '@/lib/up-sqaaf-framework';
import { cn } from '@/lib/cn';

const NAVY = '#1B2A6B';

type SubDomainEntry = { code: string; name: string };
type DomainEntry = {
  id: string;
  name: string;
  weightage: number;
  subDomains: SubDomainEntry[];
};

function initDomains(): DomainEntry[] {
  return FRAMEWORK_DOMAINS.map((d, i) => ({
    id: d.id,
    name: d.name,
    weightage: DOMAIN_WEIGHTAGES[i]?.weightage ?? 0,
    subDomains: d.subDomains.map((sd) => ({ code: sd.code, name: sd.name })),
  }));
}

export function FrameworkPage({ locked }: { locked: boolean }) {
  const [editMode, setEditMode] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('1');
  const [domains, setDomains] = useState<DomainEntry[]>(initDomains);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editingSubDomain, setEditingSubDomain] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function downloadPdf() {
    const blob = new Blob(['UP-SQAAF Framework — placeholder PDF'], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UP-SQAAF-Framework.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateDomainName(id: string, name: string) {
    setDomains((ds) => ds.map((d) => d.id === id ? { ...d, name } : d));
  }
  function updateDomainWeightage(id: string, w: number) {
    setDomains((ds) => ds.map((d) => d.id === id ? { ...d, weightage: w } : d));
  }
  function updateSubDomainName(domainId: string, code: string, name: string) {
    setDomains((ds) => ds.map((d) =>
      d.id === domainId
        ? { ...d, subDomains: d.subDomains.map((sd) => sd.code === code ? { ...sd, name } : sd) }
        : d,
    ));
  }
  function addSubDomain(domainId: string) {
    setDomains((ds) => ds.map((d) => {
      if (d.id !== domainId) return d;
      const nextIdx = d.subDomains.length + 1;
      const code = `${d.id}.${nextIdx}`;
      return { ...d, subDomains: [...d.subDomains, { code, name: 'New Sub-Domain' }] };
    }));
  }
  function addDomain() {
    const nextId = String(domains.length + 1);
    setDomains((ds) => [...ds, {
      id: nextId,
      name: 'New Domain',
      weightage: 0,
      subDomains: [],
    }]);
  }
  function handleSave() {
    // In a real implementation this would write to DB or constants file
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setEditingDomain(null);
    setEditingSubDomain(null);
  }

  function requestEditMode() {
    if (editMode) return;
    if (locked) {
      setShowOverrideModal(true);
    } else {
      setEditMode(true);
    }
  }

  function confirmOverride() {
    setShowOverrideModal(false);
    setEditMode(true);
  }

  return (
    <div className="space-y-6">
      {showOverrideModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/40"
            aria-label="Close dialog"
            onClick={() => setShowOverrideModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="override-framework-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <h2 id="override-framework-title" className="text-lg font-semibold text-gray-900">
                Override Framework Lock?
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                Submissions already exist in the active cycle. Editing the framework now will affect
                comparisons across schools. Continue?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmOverride}
                  className="rounded-lg bg-[#F5B731] px-4 py-2 text-sm font-semibold text-[#1B2A6B] hover:opacity-90"
                >
                  Yes, Edit Anyway
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">SQAAF Framework Builder</h1>
          <p className="mt-1 text-sm text-gray-600">
            School Quality Assessment and Assurance Framework, Uttar Pradesh, aligned to NEP 2020
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => { setEditMode(false); setEditingDomain(null); setEditingSubDomain(null); }}
              className={cn('rounded-md px-3 py-1', !editMode && 'bg-gray-100 font-medium')}
            >
              View Mode
            </button>
            <button
              type="button"
              onClick={requestEditMode}
              className={cn(
                'rounded-md px-3 py-1',
                editMode && 'bg-gray-100 font-medium',
              )}
            >
              Edit Mode
            </button>
          </div>
          <button
            type="button"
            onClick={downloadPdf}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: NAVY }}
          >
            <Download className="h-4 w-4" />
            Download Full PDF
          </button>
        </div>
      </div>

      {editMode && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-900">
          ⚠ Edit Mode Active. Changes apply to all new assessments.
        </div>
      )}

      {locked && !editMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Framework locked. Submissions already exist in active cycle.
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          ✓ Changes saved successfully.
        </div>
      )}

      {/* Overview */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{UP_SQAAF_OVERVIEW}</p>
      </section>

      {/* Performance Levels */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Scoring Logic, Performance Levels</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PERFORMANCE_LEVELS.map((lvl) => (
            <div key={lvl.key} className={cn('rounded-xl p-5', lvl.bgClass, lvl.textClass)}>
              <p className="text-lg font-bold">{lvl.key}</p>
              <p className="mt-1 text-sm font-semibold">{lvl.range}</p>
              <p className="mt-3 text-sm opacity-95">{lvl.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Domain Weightage */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Domain Weightage</h2>
        <div className="mt-4 space-y-3">
          {domains.map((d, i) => (
            <div key={d.id} className="flex items-center gap-3">
              <span className="w-6 text-sm font-medium text-gray-500">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-800">{d.name}</span>
                  <span className="font-semibold" style={{ color: NAVY }}>
                    {d.weightage}%
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(d.weightage, 100)}%`, backgroundColor: NAVY, minWidth: d.weightage > 0 ? '2%' : 0 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Domains Accordion */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Key Domains, Sub-Domains &amp; Indicators</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {domains.map((domain) => {
            const open = expanded === domain.id;
            const isEditingThisDomain = editingDomain === domain.id;
            return (
              <div key={domain.id} className="py-2">
                <div className="flex w-full items-center gap-2 py-2">
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => setExpanded(open ? null : domain.id)}
                  >
                    {open ? (
                      <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
                    )}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: NAVY }}
                    >
                      {domain.id}
                    </span>
                  </button>
                  {isEditingThisDomain && editMode ? (
                    <div className="flex flex-1 flex-wrap gap-2">
                      <input
                        type="text"
                        value={domain.name}
                        onChange={(e) => updateDomainName(domain.id, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      />
                      <input
                        type="number"
                        value={domain.weightage}
                        min={0}
                        max={100}
                        onChange={(e) => updateDomainWeightage(domain.id, Number(e.target.value))}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        placeholder="Weight %"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingDomain(null)}
                        className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <span
                      className="flex-1 cursor-pointer font-medium text-gray-900"
                      onClick={() => setExpanded(open ? null : domain.id)}
                    >
                      {domain.name}
                      {domain.weightage > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-500">({domain.weightage}%)</span>
                      )}
                    </span>
                  )}
                  {editMode && !isEditingThisDomain && (
                    <button
                      type="button"
                      onClick={() => setEditingDomain(domain.id)}
                      className="ml-auto rounded p-1 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
                {open && (
                  <div className="ml-9 space-y-1 border-l border-gray-100 pl-4">
                    {domain.subDomains.map((sd) => {
                      const sdKey = `${domain.id}::${sd.code}`;
                      const isEditingSd = editingSubDomain === sdKey;
                      return (
                        <div
                          key={sd.code}
                          className="flex items-center justify-between py-2 text-sm text-gray-700"
                        >
                          {isEditingSd && editMode ? (
                            <div className="flex flex-1 gap-2">
                              <input
                                type="text"
                                value={sd.name}
                                onChange={(e) => updateSubDomainName(domain.id, sd.code, e.target.value)}
                                className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingSubDomain(null)}
                                className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <span>{sd.code} {sd.name}</span>
                          )}
                          <div className="ml-4 flex items-center gap-2">
                            {editMode && !isEditingSd && (
                              <button
                                type="button"
                                onClick={() => setEditingSubDomain(sdKey)}
                                className="rounded p-1 hover:bg-gray-100"
                              >
                                <Pencil className="h-3 w-3 text-gray-400" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              View Indicators
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => addSubDomain(domain.id)}
                        className="flex items-center gap-1 py-2 text-xs font-medium text-[#1B2A6B] hover:underline"
                      >
                        <Plus className="h-3 w-3" /> Add Sub-Domain
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {editMode && (
          <button
            type="button"
            onClick={addDomain}
            className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#1B2A6B] px-4 py-2 text-sm font-medium text-[#1B2A6B] hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> Add Domain
          </button>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Reference: Final Draft UP-SQAAF, 2026. Indicator details available in the full PDF.
        </p>
      </section>

      {editMode && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-[#1B2A6B] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
