'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { upload } from '@vercel/blob/client';
import { Paperclip, X, FileText, Image, Loader2 } from 'lucide-react';
import { createEvidence, deleteEvidence } from '@/lib/actions/evidence';

export type EvidenceFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXT = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;

export default function EvidenceUploader({
  files: initialFiles,
  userId,
  kind,
  opts,
  disabled,
}: {
  files: EvidenceFile[];
  userId: string;
  kind: 'SELF_RESPONSE' | 'VERIFICATION_RESPONSE' | 'APPEAL_ITEM';
  opts: { saSubmissionId?: string; vSubmissionId?: string; parameterId?: string; appealItemId?: string };
  disabled?: boolean;
}) {
  const t = useTranslations('evidence');
  const [files, setFiles] = useState<EvidenceFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('invalidType'));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('tooLarge'));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (files.length >= MAX_FILES) {
      setError(t('maxFiles'));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob',
      });

      const res = await createEvidence(
        userId, blob.url, file.name, file.type, file.size, kind, opts,
      );

      if (res.success && res.file) {
        setFiles((prev) => [...prev, res.file!]);
      } else {
        setError(res.error ?? t('uploadError'));
      }
    } catch {
      setError(t('uploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (assetId: string) => {
    const res = await deleteEvidence(userId, assetId);
    if (res.success) setFiles((prev) => prev.filter((f) => f.id !== assetId));
    else setError(res.error ?? t('deleteError'));
  };

  const fileIcon = (type: string) =>
    type === 'application/pdf' ? <FileText size={14} className="text-red-500" /> : <Image size={14} className="text-blue-500" />;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-2">
      {files.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-xs">
              {fileIcon(f.fileType)}
              <a href={f.blobUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 truncate font-medium text-navy-700 hover:underline">{f.fileName}</a>
              <span className="text-text-secondary">{formatSize(f.fileSize)}</span>
              {!disabled && (
                <button onClick={() => handleDelete(f.id)} className="text-text-secondary hover:text-red-600" title={t('remove')}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && files.length < MAX_FILES && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-text-secondary hover:border-navy-400 hover:text-navy-700 transition">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {uploading ? t('uploading') : t('attach')}
          <input ref={inputRef} type="file" accept={ALLOWED_EXT} onChange={handleUpload}
            disabled={uploading} className="hidden" />
        </label>
      )}

      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}

      {!disabled && files.length === 0 && (
        <p className="mt-0.5 text-[10px] text-text-secondary">{t('hint')}</p>
      )}
    </div>
  );
}
