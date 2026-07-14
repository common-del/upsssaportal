'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { upload } from '@vercel/blob/client';
import { Paperclip, X, FileText, Image, Loader2, Check } from 'lucide-react';
import { createEvidence, deleteEvidence } from '@/lib/actions/evidence';
import type { EvidenceFile } from './EvidenceUploader';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXT = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE = 10 * 1024 * 1024;

type ChecklistItem = { en: string; hi: string };

export default function EvidenceChecklistModal({
  parameterId,
  titleEn,
  titleHi,
  checklist,
  existingFiles,
  userId,
  saSubmissionId,
  disabled,
  onClose,
  onFilesChange,
}: {
  parameterId: string;
  titleEn: string;
  titleHi: string;
  checklist: ChecklistItem[];
  existingFiles: EvidenceFile[];
  userId: string;
  saSubmissionId: string;
  disabled?: boolean;
  onClose: () => void;
  onFilesChange: (files: EvidenceFile[]) => void;
}) {
  const t = useTranslations('evidence');
  const [staged, setStaged] = useState<Record<number, File>>({});
  const [files, setFiles] = useState<EvidenceFile[]>(existingFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function stageFile(idx: number, file: File | undefined) {
    if (!file) return;
    setError('');
    setSuccess(false);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('invalidType'));
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('tooLarge'));
      return;
    }
    setStaged((prev) => ({ ...prev, [idx]: file }));
  }

  function unstageFile(idx: number) {
    setStaged((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  async function handleUploadAll() {
    const entries = Object.entries(staged);
    if (entries.length === 0) return;
    setUploading(true);
    setError('');
    setSuccess(false);

    const uploaded: EvidenceFile[] = [];
    let failed = false;
    for (const [, file] of entries) {
      try {
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/blob' });
        const res = await createEvidence(userId, blob.url, file.name, file.type, file.size, 'SELF_RESPONSE', {
          saSubmissionId,
          parameterId,
        });
        if (res.success && res.file) {
          uploaded.push(res.file);
        } else {
          failed = true;
        }
      } catch {
        failed = true;
      }
    }

    setUploading(false);
    if (uploaded.length > 0) {
      const next = [...files, ...uploaded];
      setFiles(next);
      onFilesChange(next);
      setStaged({});
    }
    if (failed) setError(t('uploadError'));
    else setSuccess(true);
  }

  async function handleDelete(assetId: string) {
    const res = await deleteEvidence(userId, assetId);
    if (res.success) {
      const next = files.filter((f) => f.id !== assetId);
      setFiles(next);
      onFilesChange(next);
    } else {
      setError(res.error ?? t('deleteError'));
    }
  }

  const fileIcon = (type: string) =>
    type === 'application/pdf' ? <FileText size={14} className="text-red-500" /> : <Image size={14} className="text-blue-500" />;

  const stagedCount = Object.keys(staged).length;

  return (
    <>
      <button type="button" className="fixed inset-0 z-50 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('checklistTitle')}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{titleEn}</p>
              {titleHi.trim() && titleHi.trim() !== titleEn.trim() && (
                <p className="text-xs text-gray-400">{titleHi}</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 rounded-md bg-green-50 px-2.5 py-1.5 text-xs">
                    {fileIcon(f.fileType)}
                    <a href={f.blobUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-navy-700 hover:underline">
                      {f.fileName}
                    </a>
                    <span className="text-[10px] font-medium text-green-700">{t('checklistUploaded')}</span>
                    {!disabled && (
                      <button onClick={() => handleDelete(f.id)} className="text-gray-400 hover:text-red-600" title={t('remove')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {checklist.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noChecklist')}</p>
            ) : (
              <ol className="space-y-2">
                {checklist.map((item, idx) => {
                  const stagedFile = staged[idx];
                  return (
                    <li key={idx} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">{item.en}</p>
                        {item.hi.trim() && item.hi.trim() !== item.en.trim() && (
                          <p className="mt-0.5 text-xs text-gray-400">{item.hi}</p>
                        )}
                        {stagedFile && (
                          <div className="mt-1.5 flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            {fileIcon(stagedFile.type)}
                            <span className="flex-1 truncate">{stagedFile.name}</span>
                            {!disabled && (
                              <button onClick={() => unstageFile(idx)} className="text-blue-400 hover:text-red-600">
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {!disabled && !stagedFile && (
                        <label className="shrink-0 cursor-pointer rounded-md border border-dashed border-gray-300 p-2 text-gray-500 hover:border-navy-400 hover:text-navy-700" title={t('attach')}>
                          <Paperclip size={16} />
                          <input
                            type="file"
                            accept={ALLOWED_EXT}
                            className="hidden"
                            onChange={(e) => stageFile(idx, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && !error && (
              <p className="flex items-center gap-1 text-xs text-green-700">
                <Check size={13} /> {t('uploadSuccess')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
              {t('close')}
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={stagedCount === 0 || uploading}
                className="flex items-center gap-2 rounded-lg bg-[#1B2A6B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('uploadAll')}{stagedCount > 0 ? ` (${stagedCount})` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
