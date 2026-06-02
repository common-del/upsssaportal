'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, RefreshCw } from 'lucide-react';
import { uploadMandatoryDocument } from '@/lib/actions/schoolPortal';
import type { MandatoryDocumentStatus } from '@prisma/client';

type DocRow = {
  id: string;
  documentType: string;
  status: MandatoryDocumentStatus;
  uploadedAt: string | null;
  validTill: string | null;
};

function statusPill(status: MandatoryDocumentStatus) {
  const map: Record<MandatoryDocumentStatus, string> = {
    NOT_UPLOADED: 'bg-gray-100 text-gray-700',
    UPLOADED: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    ACKNOWLEDGED: 'bg-blue-100 text-blue-800',
  };
  const labels: Record<MandatoryDocumentStatus, string> = {
    NOT_UPLOADED: 'Not Uploaded',
    UPLOADED: 'Uploaded',
    EXPIRED: 'Expired',
    ACKNOWLEDGED: 'Acknowledged',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function actionLabel(status: MandatoryDocumentStatus) {
  if (status === 'NOT_UPLOADED') return 'Upload';
  if (status === 'EXPIRED') return 'Renew';
  return 'Replace';
}

export function MandatoryDocumentsClient({ documents }: { documents: DocRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleUpload(docId: string, file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      await uploadMandatoryDocument(docId, file.name);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Mandatory Required Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload statutory and compliance documents required for SQAAF accreditation.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{doc.documentType}</h3>
              {statusPill(doc.status)}
            </div>
            <dl className="mt-3 space-y-1 text-sm text-gray-500">
              <div>
                <span className="font-medium text-gray-700">Uploaded: </span>
                {doc.uploadedAt ?? '—'}
              </div>
              <div>
                <span className="font-medium text-gray-700">Valid till: </span>
                {doc.validTill ?? '—'}
              </div>
            </dl>
            <input
              ref={(el) => { fileRefs.current[doc.id] = el; }}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleUpload(doc.id, e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => fileRefs.current[doc.id]?.click()}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {doc.status === 'EXPIRED' ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {actionLabel(doc.status)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
