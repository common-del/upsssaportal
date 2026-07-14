'use client';

import { Fragment, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Trash2, RefreshCw, Search, Paperclip, Loader2, ChevronDown, ChevronRight, FileText, Image as ImageIcon } from 'lucide-react';
import { createEvidence, deleteEvidence } from '@/lib/actions/evidence';

const NAVY = '#1B2A6B';
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXT = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE = 10 * 1024 * 1024;

type ParamOption = { id: string; code: string; label: string; domainId: string; domainLabel: string; subDomainLabel: string };
type EvidenceRow = {
  assetId: string;
  fileName: string;
  uploadedAt: string;
  parameterId: string;
  domainLabel: string;
  subDomainLabel: string;
  parameterLabel: string;
};

type Props = {
  saSubmissionId: string;
  userId: string;
  parameters: ParamOption[];
  rows: EvidenceRow[];
  disabled?: boolean;
  initialParameterFilter?: string;
};

export function EvidenceManagerClient({
  saSubmissionId,
  userId,
  parameters,
  rows: initialRows,
  disabled,
  initialParameterFilter,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [domainFilter, setDomainFilter] = useState('');
  const [subDomainFilter, setSubDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uploaded' | 'missing'>('all');
  const [search, setSearch] = useState(initialParameterFilter ? '' : '');
  const [busyParamId, setBusyParamId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedParamIds, setExpandedParamIds] = useState<Set<string>>(new Set());
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const replaceTargets = useRef<Record<string, string | undefined>>({});

  const domains = useMemo(() => {
    const map = new Map<string, string>();
    parameters.forEach((p) => map.set(p.domainId, p.domainLabel));
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [parameters]);

  const subDomains = useMemo(() => {
    const map = new Map<string, string>();
    parameters
      .filter((p) => !domainFilter || p.domainId === domainFilter)
      .forEach((p) => map.set(p.subDomainLabel, p.subDomainLabel));
    return Array.from(map.keys());
  }, [parameters, domainFilter]);

  const filesByParam = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>();
    for (const row of rows) {
      const list = map.get(row.parameterId) ?? [];
      list.push(row);
      map.set(row.parameterId, list);
    }
    return map;
  }, [rows]);

  const filteredParams = parameters.filter((p) => {
    const files = filesByParam.get(p.id) ?? [];
    if (domainFilter && p.domainId !== domainFilter) return false;
    if (subDomainFilter && p.subDomainLabel !== subDomainFilter) return false;
    if (statusFilter === 'uploaded' && files.length === 0) return false;
    if (statusFilter === 'missing' && files.length > 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesParam = p.label.toLowerCase().includes(q);
      const matchesFile = files.some((f) => f.fileName.toLowerCase().includes(q));
      if (!matchesParam && !matchesFile) return false;
    }
    return true;
  });

  function toggleExpanded(parameterId: string) {
    setExpandedParamIds((prev) => {
      const next = new Set(prev);
      if (next.has(parameterId)) next.delete(parameterId);
      else next.add(parameterId);
      return next;
    });
  }

  const fileIcon = (fileName: string) =>
    /\.pdf$/i.test(fileName) ? <FileText size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-500" />;

  async function uploadFor(parameterId: string, file: File) {
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed.');
      return null;
    }
    if (file.size > MAX_SIZE) {
      setError('File too large. Maximum 10 MB.');
      return null;
    }
    const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/blob' });
    const res = await createEvidence(userId, blob.url, file.name, file.type, file.size, 'SELF_RESPONSE', {
      saSubmissionId,
      parameterId,
    });
    if (!res.success || !res.file) {
      setError(res.error ?? 'Upload failed. Please try again.');
      return null;
    }
    return res.file;
  }

  function handlePickFile(parameterId: string, replacingAssetId?: string) {
    replaceTargets.current[parameterId] = replacingAssetId;
    fileInputs.current[parameterId]?.click();
  }

  async function handleFileSelected(parameterId: string, file: File | undefined, replacingAssetId?: string) {
    if (!file) return;
    setBusyParamId(parameterId);
    const uploaded = await uploadFor(parameterId, file);
    if (uploaded) {
      if (replacingAssetId) {
        await deleteEvidence(userId, replacingAssetId);
        setRows((prev) => prev.filter((r) => r.assetId !== replacingAssetId));
      }
      const param = parameters.find((p) => p.id === parameterId);
      setRows((prev) => [
        {
          assetId: uploaded.id,
          fileName: uploaded.fileName,
          uploadedAt: new Date().toLocaleDateString('en-IN'),
          parameterId,
          domainLabel: param?.domainLabel ?? '',
          subDomainLabel: param?.subDomainLabel ?? '',
          parameterLabel: param?.label ?? '',
        },
        ...prev,
      ]);
      startTransition(() => router.refresh());
    }
    setBusyParamId(null);
  }

  function handleDelete(assetId: string) {
    setBusyParamId(assetId);
    startTransition(async () => {
      const res = await deleteEvidence(userId, assetId);
      if (res.success) {
        setRows((prev) => prev.filter((r) => r.assetId !== assetId));
        router.refresh();
      } else {
        setError(res.error ?? 'Could not delete file.');
      }
      setBusyParamId(null);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Evidence Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          View all evidence uploaded for SQAAF assessment. To submit new evidence while filling the form, use the Upload Evidence button on the SQAAF Update page — delete or replace already-uploaded files here.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <select
          value={domainFilter}
          onChange={(e) => { setDomainFilter(e.target.value); setSubDomainFilter(''); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <select
          value={subDomainFilter}
          onChange={(e) => setSubDomainFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Sub-Domains</option>
          {subDomains.map((sd) => (
            <option key={sd} value={sd}>{sd}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="uploaded">Uploaded</option>
          <option value="missing">Missing</option>
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Sub-Domain</th>
              <th className="px-4 py-3">Parameter</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredParams.map((p) => {
              const files = filesByParam.get(p.id) ?? [];
              const expanded = expandedParamIds.has(p.id);
              return (
                <Fragment key={p.id}>
                  <tr className={files.length === 0 ? 'bg-amber-50/30' : undefined}>
                    <td className="px-4 py-3 text-gray-700">{p.domainLabel}</td>
                    <td className="px-4 py-3 text-gray-700">{p.subDomainLabel}</td>
                    <td className="px-4 py-3 text-gray-900">{p.label}</td>
                    <td className="px-4 py-3">
                      {files.length > 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          {files.length} file{files.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs italic text-gray-400">No evidence</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(p.id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#1B2A6B] hover:underline"
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        View Details
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr key={`${p.id}-details`}>
                      <td colSpan={5} className="bg-gray-50 px-6 py-4">
                        <div className="space-y-3">
                          {files.length > 0 && (
                            <div className="space-y-2">
                              {files.map((f) => (
                                <div
                                  key={f.assetId}
                                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                                >
                                  {fileIcon(f.fileName)}
                                  <span className="flex-1 truncate font-mono text-xs text-gray-700">{f.fileName}</span>
                                  <span className="text-xs text-gray-400">{f.uploadedAt}</span>
                                  {!disabled && (
                                    <div className="flex shrink-0 gap-3">
                                      <button
                                        type="button"
                                        disabled={busyParamId === p.id || busyParamId === f.assetId}
                                        onClick={() => handlePickFile(p.id, f.assetId)}
                                        className="text-xs font-medium text-[#1B2A6B] hover:underline disabled:opacity-50"
                                      >
                                        {busyParamId === p.id ? (
                                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                        ) : (
                                          <RefreshCw className="mr-1 inline h-3 w-3" />
                                        )}
                                        Replace
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busyParamId === f.assetId}
                                        onClick={() => handleDelete(f.assetId)}
                                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                                      >
                                        {busyParamId === f.assetId ? (
                                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="mr-1 inline h-3 w-3" />
                                        )}
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {!disabled && (
                            <button
                              type="button"
                              disabled={busyParamId === p.id}
                              onClick={() => handlePickFile(p.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-xs font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                            >
                              {busyParamId === p.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Paperclip size={14} />
                              )}
                              Upload
                            </button>
                          )}
                          <input
                            ref={(el) => { fileInputs.current[p.id] = el; }}
                            type="file"
                            accept={ALLOWED_EXT}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              const replacingAssetId = replaceTargets.current[p.id];
                              replaceTargets.current[p.id] = undefined;
                              handleFileSelected(p.id, file, replacingAssetId);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
