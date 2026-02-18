'use client';

import { useState, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { bulkValidateAndCreate } from '@/lib/actions/users';

type BulkError = { row: number; field: string; message: string };

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

const TEMPLATE = 'username,password,name,role,districtCode,verifierCapacity,districtCodes\nverifier2,verifier123,Verifier Two,VERIFIER,,50,D001;D002\ndistrict2,district123,District Officer 2,DISTRICT_OFFICIAL,D002,,';

export default function BulkUploadForm({ actorId, backPath }: { actorId: string; backPath: string }) {
  const t = useTranslations('userMgmt');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<BulkError[]>([]);
  const [result, setResult] = useState<{ success: boolean; created: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(reader.result as string);
      setPreview(rows);
      setErrors([]);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    setErrors([]); setResult(null);
    startTransition(async () => {
      const rows = preview.map((r) => ({
        username: r.username ?? '', password: r.password ?? '', name: r.name,
        role: r.role ?? '', districtCode: r.districtCode, verifierCapacity: r.verifierCapacity, districtCodes: r.districtCodes,
      }));
      const res = await bulkValidateAndCreate({ userId: actorId, role: 'SSSA_ADMIN' }, rows);
      if (res.success) { setResult({ success: true, created: res.created }); setPreview([]); }
      else setErrors(res.errors);
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-navy-700 hover:bg-surface">
          <Download size={16} /> {t('downloadTemplate')}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800">
          <Upload size={16} /> {t('selectFile')}
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {result && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={16} /> {t('bulkSuccess', { count: result.created })}
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800"><AlertCircle size={16} /> {t('bulkErrors')}</div>
          <ul className="mt-2 list-inside list-disc text-xs text-red-700">
            {errors.map((e, i) => <li key={i}>Row {e.row}: {e.field} — {e.message}</li>)}
          </ul>
        </div>
      )}

      {preview.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-navy-900">{t('previewRows', { count: preview.length })}</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface text-left font-semibold text-text-secondary">
                  <th className="px-2 py-1.5">#</th>
                  {Object.keys(preview[0]).map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 text-text-secondary">{i + 1}</td>
                    {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5">{v || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleUpload} disabled={isPending}
            className="mt-3 rounded-lg bg-navy-700 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            {isPending ? t('uploading') : t('confirmUpload')}
          </button>
        </div>
      )}

      <button onClick={() => router.push(backPath)} className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-navy-700 hover:bg-surface">
        {t('cancel')}
      </button>
    </div>
  );
}
