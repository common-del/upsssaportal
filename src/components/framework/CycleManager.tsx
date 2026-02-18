'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Check, Circle, Trash2, FileSpreadsheet, Copy, LockOpen } from 'lucide-react';
import { createCycle, toggleActiveCycle, deleteCycle, unpublishFramework } from '@/lib/actions/framework';
import ImportButton from './ImportButton';

type CycleWithFramework = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  framework: {
    id: string;
    status: string;
    version: number;
    domainCount: number;
    typeCounts: { PRIMARY: number; UPPER_PRIMARY: number; SECONDARY: number };
  } | null;
};

export default function CycleManager({
  cycles,
  hasPublishedFramework,
}: {
  cycles: CycleWithFramework[];
  hasPublishedFramework: boolean;
}) {
  const t = useTranslations('framework');
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [error, setError] = useState('');
  const [cloneNotice, setCloneNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!cycleName.trim()) return;
    setError('');
    setCloneNotice('');
    startTransition(async () => {
      const res = await createCycle(cycleName.trim());
      if (!res.success) {
        setError(res.message);
      } else {
        if (res.clonedFrom) {
          setCloneNotice(res.clonedFrom);
        }
        setCycleName('');
        setShowForm(false);
        router.refresh();
      }
    });
  };

  const handleToggleActive = (cycleId: string) => {
    startTransition(async () => {
      await toggleActiveCycle(cycleId);
      router.refresh();
    });
  };

  const handleDelete = (cycleId: string) => {
    if (!confirm(t('deleteCycleConfirm'))) return;
    setCloneNotice('');
    startTransition(async () => {
      const res = await deleteCycle(cycleId);
      if (res && !res.success) {
        alert(res.message);
      } else {
        router.refresh();
      }
    });
  };

  const handleUnpublish = (frameworkId: string) => {
    if (!confirm(t('unpublishConfirm'))) return;
    startTransition(async () => {
      await unpublishFramework(frameworkId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with New Cycle button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy-900">{t('cycles')}</h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setCloneNotice(''); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            <Plus size={16} />
            {t('newCycle')}
          </button>
        )}
      </div>

      {/* Clone success notice */}
      {cloneNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Copy size={16} className="shrink-0" />
          <span>{t('clonedNotice', { source: cloneNotice })}</span>
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-navy-200 bg-navy-50/50 p-4">
          <label className="block text-sm font-medium text-navy-900">{t('cycleName')}</label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder={t('cycleNamePlaceholder')}
              className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={isPending || !cycleName.trim()}
              className="rounded-md bg-navy-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-navy-800 disabled:opacity-50"
            >
              {isPending ? t('creating') : t('create')}
            </button>
            <button
              onClick={() => { setShowForm(false); setCycleName(''); setError(''); }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
            >
              {t('cancel')}
            </button>
          </div>
          {hasPublishedFramework && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-navy-600">
              <Copy size={14} className="shrink-0" />
              {t('cloneHint')}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Cycle list */}
      {cycles.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-6 text-center text-text-secondary">
          <FileSpreadsheet size={24} className="mx-auto mb-2 opacity-50" />
          <p>{t('noCycles')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => (
            <div
              key={cycle.id}
              className={`rounded-xl border bg-white p-5 transition ${
                cycle.isActive ? 'border-navy-300 ring-1 ring-navy-200' : 'border-border'
              }`}
            >
              {/* Cycle header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-navy-900">{cycle.name}</h3>
                  {cycle.isActive && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {t('activeBadge')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(cycle.id)}
                    disabled={isPending}
                    title={cycle.isActive ? t('deactivate') : t('setActive')}
                    className={`rounded-md p-1.5 text-xs transition ${
                      cycle.isActive
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-surface text-text-secondary hover:bg-navy-100'
                    }`}
                  >
                    {cycle.isActive ? <Check size={16} /> : <Circle size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(cycle.id)}
                    disabled={isPending}
                    title={t('deleteCycle')}
                    className="rounded-md p-1.5 text-text-secondary transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Framework info */}
              {cycle.framework ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary">SQAAF</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cycle.framework.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {cycle.framework.status === 'PUBLISHED' ? t('statusPublished') : t('statusDraft')}
                    </span>
                    <span className="text-xs text-text-secondary">
                      v{cycle.framework.version}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
                    <span>{t('domains')}: {cycle.framework.domainCount}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs">
                      <span className="font-medium text-navy-900">{t('appPrimary')}</span>
                      <span className="font-semibold text-navy-700">{cycle.framework.typeCounts.PRIMARY}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs">
                      <span className="font-medium text-navy-900">{t('appUpperPrimary')}</span>
                      <span className="font-semibold text-navy-700">{cycle.framework.typeCounts.UPPER_PRIMARY}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs">
                      <span className="font-medium text-navy-900">{t('appSecondary')}</span>
                      <span className="font-semibold text-navy-700">{cycle.framework.typeCounts.SECONDARY}</span>
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/app/sssa/frameworks/${cycle.framework.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                    >
                      {t('openEditor')}
                    </Link>
                    {cycle.framework.status === 'DRAFT' && (
                      <ImportButton cycleId={cycle.id} label={t('reimportExcel')} />
                    )}
                    {cycle.framework.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleUnpublish(cycle.framework!.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                      >
                        <LockOpen size={16} />
                        {t('unpublish')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-text-secondary">{t('noFramework')}</p>
                  <div className="mt-2">
                    <ImportButton cycleId={cycle.id} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
