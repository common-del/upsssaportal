'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Plus } from 'lucide-react';

export type BuilderDomain = {
  id: string;
  code: string;
  titleEn: string;
  weightPercent: number | null;
  subDomains: {
    id: string;
    code: string;
    titleEn: string;
    parameters: {
      id: string;
      code: string;
      titleEn: string;
      weightLabel: string;
      rubricSnippet: string;
      evidenceCount: number;
    }[];
  }[];
};

export function SqaafBuilder({
  frameworkLocked,
  cycleName,
  domains,
}: {
  frameworkLocked: boolean;
  cycleName: string;
  domains: BuilderDomain[];
}) {
  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(domains.map((d) => [d.id, true])),
  );
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Active cycle: <span className="font-semibold text-[#1B2A6B]">{cycleName}</span>
        </p>
        <button
          type="button"
          title="Coming soon"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#1B2A6B] shadow-sm hover:bg-gray-50"
        >
          Clone Framework for Next Cycle
        </button>
      </div>

      {frameworkLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          Framework locked because submissions exist in active cycle
        </div>
      )}

      {domains.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          No framework domains found for the active cycle. Publish a framework from cycle management
          first.
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <div key={domain.id} className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => setOpenDomains((o) => ({ ...o, [domain.id]: !o[domain.id] }))}
              >
                {openDomains[domain.id] ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
                <span className="font-semibold text-[#1B2A6B]">{domain.titleEn}</span>
                <span className="ml-auto text-xs text-gray-500">
                  Weight {domain.weightPercent ?? 20}%
                </span>
              </button>
              {openDomains[domain.id] && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <button
                    type="button"
                    disabled={frameworkLocked}
                    title={frameworkLocked ? 'Coming soon' : 'Coming soon'}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1B2A6B] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Sub-domain
                  </button>
                  {domain.subDomains.map((sub) => (
                    <div key={sub.id} className="mt-3 rounded-lg border border-gray-100 bg-gray-50/80">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-800"
                        onClick={() => setOpenSubs((o) => ({ ...o, [sub.id]: !o[sub.id] }))}
                      >
                        {openSubs[sub.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {sub.titleEn}
                      </button>
                      {openSubs[sub.id] && (
                        <div className="space-y-2 border-t border-gray-100 px-3 pb-3 pt-2">
                          <button
                            type="button"
                            disabled={frameworkLocked}
                            title="Coming soon"
                            className="inline-flex items-center gap-1 text-xs text-[#1B2A6B] disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Parameter
                          </button>
                          {sub.parameters.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-gray-900">{p.titleEn}</p>
                                  <p className="text-xs text-gray-500">{p.code}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={frameworkLocked}
                                    title="Coming soon"
                                    className="rounded border border-gray-200 px-2 py-0.5 text-xs disabled:opacity-40"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-600">{p.rubricSnippet}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                Evidence items: {p.evidenceCount} · {p.weightLabel}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
