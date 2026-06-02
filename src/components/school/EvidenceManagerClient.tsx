'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, RefreshCw, Search } from 'lucide-react';
import { deleteStubEvidence, stubUploadEvidence } from '@/lib/actions/schoolPortal';

const NAVY = '#1B2A6B';

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
  parameters: ParamOption[];
  rows: EvidenceRow[];
  initialParameterFilter?: string;
};

export function EvidenceManagerClient({
  saSubmissionId,
  parameters,
  rows: initialRows,
  initialParameterFilter,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [domainFilter, setDomainFilter] = useState('');
  const [subDomainFilter, setSubDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uploaded' | 'missing'>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploadParamId, setUploadParamId] = useState(initialParameterFilter ?? '');

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

  function handleUpload(file: File | undefined) {
    if (!file || !uploadParamId) return;
    startTransition(async () => {
      const res = await stubUploadEvidence({
        parameterId: uploadParamId,
        fileName: file.name,
        saSubmissionId,
      });
      if (res.success) {
        setShowModal(false);
        router.refresh();
      }
    });
  }

  function handleDelete(assetId: string) {
    startTransition(async () => {
      await deleteStubEvidence(assetId);
      setRows((prev) => prev.filter((r) => r.assetId !== assetId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Central view of all evidence uploaded for SQAAF assessment.</p>
        </header>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: NAVY }}
        >
          <Plus className="h-4 w-4" /> Upload New Evidence
        </button>
      </div>

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
                  <div className="flex gap-2">
                    <button type="button" className="text-xs font-medium text-[#1B2A6B] hover:underline">
                      <RefreshCw className="mr-1 inline h-3 w-3" />Replace
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(row.assetId)}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />Delete
                    </button>
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
                  <button
                    type="button"
                    onClick={() => { setUploadParamId(p.id); setShowModal(true); }}
                    className="text-xs font-medium text-[#1B2A6B] hover:underline"
                  >
                    Upload
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload modal */}
      {showModal && (
        <>
          <button type="button" className="fixed inset-0 z-50 bg-black/40" aria-label="Close" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Upload New Evidence</h2>
              <p className="mt-1 text-xs text-gray-500">
                TODO: integrate Vercel Blob for actual file storage.
              </p>
              <div className="mt-4 space-y-3">
                <select
                  value={uploadParamId}
                  onChange={(e) => setUploadParamId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select parameter…</option>
                  {parameters.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.domainLabel} › {p.subDomainLabel} › {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleUpload(e.target.files?.[0])}
                  className="w-full text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
