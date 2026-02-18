'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  toggleParameter,
  deleteParameter,
  updateParameter,
  updateOptionLabels,
} from '@/lib/actions/framework';
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';

type Option = { id: string; key: string; labelEn: string; labelHi: string; isActive: boolean };
type RubricMap = { id: string; optionKey: string; score: number };

type Param = {
  id: string;
  code: string;
  titleEn: string;
  titleHi: string;
  order: number;
  applicability: unknown;
  evidenceRequired: boolean;
  dataSources: unknown;
  isActive: boolean;
  options: Option[];
  rubricMappings: RubricMap[];
};

const APP_LABELS: Record<string, string> = {
  PRIMARY: 'PS',
  UPPER_PRIMARY: 'UPS',
  SECONDARY: 'Sec',
};

const DATA_SOURCE_OPTIONS = ['UDISE', 'Prerna', 'NIPUN+ App'];

const LEVEL_KEYS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
const LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
};

export default function ParameterTable({
  parameters,
  readonly,
}: {
  parameters: Param[];
  readonly: boolean;
}) {
  const t = useTranslations('framework');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string) {
    startTransition(() => toggleParameter(id));
  }

  function handleDelete(id: string) {
    if (!confirm(t('deleteConfirm'))) return;
    startTransition(() => deleteParameter(id));
  }

  if (parameters.length === 0) {
    return <p className="py-4 text-sm text-text-secondary">{t('noParameters')}</p>;
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="hidden sm:grid sm:grid-cols-[2rem_5rem_1fr_7rem_4rem_5rem_6rem] gap-2 border-b pb-2 text-xs font-medium text-text-secondary">
        <span>#</span>
        <span>{t('paramCode')}</span>
        <span>{t('paramTitle')}</span>
        <span>{t('paramApplicability')}</span>
        <span>{t('paramEvidence')}</span>
        <span>{t('paramStatus')}</span>
        {!readonly && <span>{t('paramActions')}</span>}
      </div>

      {parameters.map((p) => {
        const isExpanded = expandedId === p.id;
        const isEditing = editId === p.id;
        const ds = (p.dataSources as string[]) || [];

        return (
          <div
            key={p.id}
            className={`border-b last:border-b-0 ${!p.isActive ? 'opacity-50' : ''}`}
          >
            {/* Main row */}
            <div className="grid grid-cols-[2rem_5rem_1fr_7rem_4rem_5rem_6rem] items-center gap-2 py-2 text-sm">
              <span className="text-text-secondary">{p.order}</span>
              <span className="font-mono text-xs">{p.code}</span>
              <div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="flex items-center gap-1 text-left text-navy-900 hover:text-navy-700"
                >
                  <ChevronRight
                    size={14}
                    className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span>{p.titleEn}</span>
                </button>
                {ds.length > 0 && (
                  <div className="ml-5 mt-0.5 flex gap-1">
                    {ds.map((s) => (
                      <span key={s} className="rounded bg-blue-50 px-1.5 py-0 text-[9px] text-blue-600">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {(p.applicability as string[]).map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy-700"
                  >
                    {APP_LABELS[a] || a}
                  </span>
                ))}
              </div>
              <span>{p.evidenceRequired ? '✓' : '–'}</span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${
                  p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.isActive ? t('active') : t('inactive')}
              </span>
              {!readonly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditId(isEditing ? null : p.id);
                      setExpandedId(p.id);
                    }}
                    className="rounded p-1 hover:bg-surface"
                    title={t('edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleToggle(p.id)}
                    disabled={isPending}
                    className="rounded p-1 hover:bg-surface"
                    title={p.isActive ? t('disable') : t('enable')}
                  >
                    {p.isActive ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title={t('delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Expanded: level descriptors + edit form */}
            {isExpanded && (
              <div className="mb-3 ml-7 space-y-3">
                {/* Level descriptors (always visible when expanded) */}
                <LevelDescriptors options={p.options} readonly={readonly || !isEditing} />

                {/* Edit form (only when editing) */}
                {isEditing && !readonly && (
                  <ParameterEditForm
                    param={p}
                    onClose={() => setEditId(null)}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Level Descriptors display/edit ── */
function LevelDescriptors({
  options,
  readonly,
}: {
  options: Option[];
  readonly: boolean;
}) {
  const [editing, setEditing] = useState<Record<string, { labelEn: string; labelHi: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function startEdit(opt: Option) {
    setEditing((prev) => ({ ...prev, [opt.id]: { labelEn: opt.labelEn, labelHi: opt.labelHi } }));
  }

  async function saveOption(optId: string) {
    const vals = editing[optId];
    if (!vals) return;
    setSaving(optId);
    await updateOptionLabels(optId, vals);
    setEditing((prev) => {
      const next = { ...prev };
      delete next[optId];
      return next;
    });
    setSaving(null);
  }

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="border-b bg-surface/50 px-3 py-1.5 text-xs font-semibold text-navy-700">
        Level Descriptors
      </div>
      <div className="divide-y">
        {LEVEL_KEYS.map((key) => {
          const opt = options.find((o) => o.key === key);
          if (!opt) return null;
          const isEditingThis = !!editing[opt.id];

          return (
            <div key={key} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-navy-600">{LEVEL_LABELS[key]}</span>
                {!readonly && !isEditingThis && (
                  <button
                    onClick={() => startEdit(opt)}
                    className="text-[10px] text-navy-500 hover:text-navy-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingThis ? (
                <div className="mt-1 space-y-1">
                  <div>
                    <label className="text-[10px] text-text-secondary">English</label>
                    <textarea
                      rows={2}
                      value={editing[opt.id].labelEn}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [opt.id]: { ...prev[opt.id], labelEn: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-border px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary">हिंदी</label>
                    <textarea
                      rows={2}
                      value={editing[opt.id].labelHi}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [opt.id]: { ...prev[opt.id], labelHi: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-border px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveOption(opt.id)}
                      disabled={saving === opt.id}
                      className="rounded bg-navy-700 px-2 py-0.5 text-[10px] text-white hover:bg-navy-800 disabled:opacity-50"
                    >
                      {saving === opt.id ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() =>
                        setEditing((prev) => {
                          const next = { ...prev };
                          delete next[opt.id];
                          return next;
                        })
                      }
                      className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-0.5 space-y-0.5">
                  <p className="text-xs leading-relaxed text-text-secondary">
                    <span className="font-medium text-navy-800">EN:</span>{' '}
                    {opt.labelEn || <span className="italic text-red-400">Empty</span>}
                  </p>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    <span className="font-medium text-navy-800">HI:</span>{' '}
                    {opt.labelHi || <span className="italic text-red-400">Empty</span>}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Parameter Edit Form (title, applicability, evidence, data sources) ── */
function ParameterEditForm({
  param,
  onClose,
}: {
  param: Param;
  onClose: () => void;
}) {
  const t = useTranslations('framework');
  const [titleEn, setTitleEn] = useState(param.titleEn);
  const [titleHi, setTitleHi] = useState(param.titleHi);
  const [app, setApp] = useState<string[]>(param.applicability as string[]);
  const [evidence, setEvidence] = useState(param.evidenceRequired);
  const [ds, setDs] = useState<string[]>((param.dataSources as string[]) || []);
  const [saving, setSaving] = useState(false);

  const allApps = ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'];

  async function handleSave() {
    setSaving(true);
    await updateParameter(param.id, {
      titleEn,
      titleHi,
      applicability: app,
      evidenceRequired: evidence,
      dataSources: ds,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="space-y-2 rounded-lg border border-navy-200 bg-navy-50/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary">{t('titleEn')}</label>
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary">{t('titleHi')}</label>
          <input
            type="text"
            value={titleHi}
            onChange={(e) => setTitleHi(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary">{t('applicability')}</label>
          <div className="flex gap-3 mt-1">
            {allApps.map((a) => (
              <label key={a} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={app.includes(a)}
                  onChange={(e) => {
                    if (e.target.checked) setApp([...app, a]);
                    else setApp(app.filter((x) => x !== a));
                  }}
                />
                {APP_LABELS[a]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary">{t('dataSources')}</label>
          <div className="flex flex-wrap gap-3 mt-1">
            {DATA_SOURCE_OPTIONS.map((s) => (
              <label key={s} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={ds.includes(s)}
                  onChange={(e) => {
                    if (e.target.checked) setDs([...ds, s]);
                    else setDs(ds.filter((x) => x !== s));
                  }}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={evidence}
            onChange={(e) => setEvidence(e.target.checked)}
          />
          {t('evidenceRequired')}
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-navy-700 px-3 py-1 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? '…' : t('save')}
        </button>
        <button onClick={onClose} className="rounded border border-border px-3 py-1 text-xs hover:bg-surface">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
