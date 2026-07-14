'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { Trash2, RefreshCw, Search, Paperclip, Loader2 } from 'lucide-react';
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
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const uploadedParamIds = new Set(rows.map((r) => r.parameterId));

  const filteredRows = rows.filter((r) => {
    const param = parameters.find((p) => p.id === r.parameterId);
    if (domainFilter && param?.domainId !== domainFilter) return false;
    if (subDomainFilter && param?.subDomainLabel !== subDomainFilter) return false;
    if (search && !r.fileName.toLowerCase().includes(search.toLowerCase()) &&
        !r.parameterLabel.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const missingParams = parameters.filter((p) => {
    if (uploadedParamIds.has(p.id)) return false;
    if (domainFilter && p.domainId !== domainFilter) return false;
    if (subDomainFilter && p.subDomainLabel !== subDomainFilter) return false;
    if (search && !p.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const showMissing = statusFilter === 'missing' || statusFilter === 'all';
  const showUploaded = statusFilter === 'uploaded' || statusFilter === 'all';

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

  function handlePickFile(parameterId: string) {
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
              <th className="px-4 py-3">File name</th>
              <th className="px-4 py-3">Uploaded date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {showUploaded && filteredRows.map((row) => (
              <tr key={row.assetId}>
                <td className="px-4 py-3 text-gray-700">{row.domainLabel}</td>
                <td className="px-4 py-3 text-gray-700">{row.subDomainLabel}</td>
                <td className="px-4 py-3 text-gray-900">{row.parameterLabel}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.fileName}</td>
                <td className="px-4 py-3 text-gray-500">{row.uploadedAt}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {!disabled && (
                      <>
                        <button
                          type="button"
                          disabled={busyParamId === row.parameterId || busyParamId === row.assetId}
                          onClick={() => handlePickFile(row.parameterId)}
                          className="text-xs font-medium text-[#1B2A6B] hover:underline disabled:opacity-50"
                        >
                          {busyParamId === row.parameterId ? (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 inline h-3 w-3" />
                          )}
                          Replace
                        </button>
                        <input
                          ref={(el) => { fileInputs.current[row.parameterId] = el; }}
                          type="file"
                          accept={ALLOWED_EXT}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            handleFileSelected(row.parameterId, file, row.assetId);
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          disabled={busyParamId === row.assetId}
                          onClick={() => handleDelete(row.assetId)}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          {busyParamId === row.assetId ? (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1 inline h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {showMissing && missingParams.map((p) => (
              <tr key={`missing-${p.id}`} className="bg-amber-50/30">
                <td className="px-4 py-3 text-gray-700">{p.domainLabel}</td>
                <td className="px-4 py-3 text-gray-700">{p.subDomainLabel}</td>
                <td className="px-4 py-3 text-gray-900">{p.label}</td>
                <td className="px-4 py-3 text-gray-400 italic">—</td>
                <td className="px-4 py-3 text-gray-400">—</td>
                <td className="px-4 py-3">
                  {!disabled && (
                    <>
                      <button
                        type="button"
                        disabled={busyParamId === p.id}
                        onClick={() => handlePickFile(p.id)}
                        className="text-xs font-medium text-[#1B2A6B] hover:underline disabled:opacity-50"
                      >
                        {busyParamId === p.id ? (
                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        ) : (
                          <Paperclip className="mr-1 inline h-3 w-3" />
                        )}
                        Upload
                      </button>
                      <input
                        ref={(el) => { fileInputs.current[p.id] = el; }}
                        type="file"
                        accept={ALLOWED_EXT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          handleFileSelected(p.id, file);
                          e.target.value = '';
                        }}
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
