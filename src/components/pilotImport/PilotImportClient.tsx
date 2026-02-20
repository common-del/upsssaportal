'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { validatePilotFile, runPilotImport } from '@/lib/actions/pilotImport';
import type { ValidationResult, ImportResult } from '@/lib/actions/pilotImport';
import { FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PilotImportClient() {
  const t = useTranslations('pilotImport');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleValidate = async () => {
    setValidating(true);
    setValidation(null);
    setImportResult(null);
    try {
      const res = await validatePilotFile();
      setValidation(res);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await runPilotImport();
      setImportResult(res);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Validate button */}
      <button
        onClick={handleValidate}
        disabled={validating || importing}
        className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {validating ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
        {validating ? t('validating') : t('validate')}
      </button>

      {/* Validation Result */}
      {validation && (
        <div className="rounded-xl border border-border bg-white p-5">
          {validation.error ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle size={18} /> <span className="text-sm font-medium">{validation.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet size={16} className="text-navy-600" />
                <span className="font-medium">{t('sheet')}: {validation.sheetName}</span>
                <span className="mx-2 text-text-secondary">|</span>
                <span>{t('rows')}: {validation.totalRows}</span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-md bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">
                  {t('excelCols')}: {validation.nExcel}
                </span>
                <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  {t('fwParams')}: {validation.nFramework}
                </span>
                {validation.matched ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 size={14} /> {t('matched')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                    <XCircle size={14} /> {t('mismatch')}
                  </span>
                )}
              </div>

              {/* Sample mapping table */}
              <div className="mt-4 overflow-x-auto">
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-secondary">
                  {validation.matched ? t('mappingPreview') : t('mismatchReport')}
                </h3>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 font-medium text-text-secondary">#</th>
                      <th className="px-2 py-1.5 font-medium text-text-secondary">{t('excelHeader')}</th>
                      <th className="px-2 py-1.5 font-medium text-text-secondary">{t('paramCode')}</th>
                      <th className="px-2 py-1.5 font-medium text-text-secondary">{t('paramTitle')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.sampleMapping.map((m) => (
                      <tr key={m.index} className="border-b border-border/50">
                        <td className="px-2 py-1 text-text-secondary">{m.index + 1}</td>
                        <td className="max-w-[200px] truncate px-2 py-1">{m.excelHeader}</td>
                        <td className="px-2 py-1 font-mono text-navy-600">{m.paramCode}</td>
                        <td className="max-w-[200px] truncate px-2 py-1">{m.paramTitleHi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import button only when matched */}
              {validation.matched && !importResult && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {importing ? t('importing') : t('runImport')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            {importResult.success ? (
              <CheckCircle2 size={16} className="text-green-600" />
            ) : (
              <XCircle size={16} className="text-red-600" />
            )}
            {t('importResult')}
          </h3>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ['rowsProcessed', importResult.rowsProcessed],
              ['schoolsCreated', importResult.schoolsCreated],
              ['districtsCreated', importResult.districtsCreated],
              ['blocksCreated', importResult.blocksCreated],
              ['submissionsCreated', importResult.submissionsCreated],
              ['submitted', importResult.submissionsSubmitted],
              ['draft', importResult.submissionsDraft],
              ['skipped', importResult.submissionsSkipped],
            ] as [string, number][]).map(([key, val]) => (
              <div key={key} className="rounded-md bg-gray-50 px-3 py-2">
                <div className="text-lg font-bold text-navy-900">{val}</div>
                <div className="text-[10px] uppercase text-text-secondary">{t(key)}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {importResult.warnings.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
                <AlertTriangle size={13} /> {t('warnings')} ({importResult.warnings.length})
              </h4>
              <ul className="max-h-40 overflow-y-auto text-[11px] text-amber-700">
                {importResult.warnings.map((w, i) => (
                  <li key={i} className="py-0.5">Row {w.row}: {w.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                <XCircle size={13} /> {t('errorsLabel')} ({importResult.errors.length})
              </h4>
              <ul className="max-h-40 overflow-y-auto text-[11px] text-red-700">
                {importResult.errors.map((e, i) => (
                  <li key={i} className="py-0.5">
                    {e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Post-import handoff */}
          {importResult.success && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-800">{t('successHandoff')}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/app/sssa/monitoring"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
                  {t('goToMonitoring')} <ArrowRight size={14} />
                </Link>
                <Link href="/app/sssa/finalization"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                  {t('goToFinalization')} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
