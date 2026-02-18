'use client';

import { useTranslations } from 'next-intl';
import { FileText, Image, ExternalLink } from 'lucide-react';

export type EvidenceFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
};

export default function EvidenceViewer({ files, label }: { files: EvidenceFile[]; label?: string }) {
  const t = useTranslations('evidence');

  if (files.length === 0) return null;

  const fileIcon = (type: string) =>
    type === 'application/pdf' ? <FileText size={12} className="text-red-500" /> : <Image size={12} className="text-blue-500" />;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-1.5">
      {label && <p className="mb-1 text-[10px] font-semibold uppercase text-text-secondary">{label}</p>}
      <div className="space-y-0.5">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-1.5 text-[11px]">
            {fileIcon(f.fileType)}
            <a href={f.blobUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 truncate text-navy-700 hover:underline">{f.fileName}</a>
            <span className="text-text-secondary">{formatSize(f.fileSize)}</span>
            <a href={f.blobUrl} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-navy-700">
              <ExternalLink size={12} />
            </a>
          </div>
        ))}
      </div>
      {files.length === 0 && <p className="text-[10px] text-text-secondary italic">{t('noFiles')}</p>}
    </div>
  );
}
