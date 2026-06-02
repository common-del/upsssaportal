'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import DownloadSchoolReportButton from '@/components/reports/DownloadSchoolReportButton';
import type { SchoolReportData } from '@/lib/reports/schoolReport';

const NAVY = '#1B2A6B';

export function SchoolReportCardView({ data }: { data: SchoolReportData }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/schools/${data.school.udise}`;

  function handleShare() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const score = data.scores.compositePercent;
  const grade = data.grade.labelEn ?? data.grade.code ?? 'Pending';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">School Report Card</h1>
          <p className="mt-1 text-sm text-gray-500">{data.cycleName} · UDISE {data.school.udise}</p>
        </header>
        <div className="flex gap-2">
          <DownloadSchoolReportButton udise={data.school.udise} />
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" />
            {copied ? 'Link copied!' : 'Share Link'}
          </button>
        </div>
      </div>

      {/* HTML Preview */}
      <div className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: NAVY }}>
        <div className="px-8 py-6 text-white" style={{ backgroundColor: NAVY }}>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">UP-SQAAF Report Card</p>
          <h2 className="mt-2 text-2xl font-bold">{data.school.nameEn}</h2>
          <p className="mt-1 text-sm opacity-80">
            UDISE {data.school.udise} · {data.school.districtNameEn}
          </p>
        </div>
        <div className="p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl bg-[#F3F4F6] p-5 text-center">
              <p className="text-xs font-medium uppercase text-gray-500">Composite Score</p>
              <p className="mt-2 text-4xl font-bold" style={{ color: NAVY }}>
                {score != null ? `${score}%` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[#F3F4F6] p-5 text-center">
              <p className="text-xs font-medium uppercase text-gray-500">Grade Band</p>
              <p className="mt-2 text-4xl font-bold" style={{ color: NAVY }}>{grade}</p>
            </div>
            <div className="rounded-xl bg-[#F3F4F6] p-5 text-center">
              <p className="text-xs font-medium uppercase text-gray-500">Assessment Cycle</p>
              <p className="mt-2 text-lg font-bold" style={{ color: NAVY }}>{data.cycleName}</p>
            </div>
          </div>

          {data.domains.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-4 font-semibold text-gray-900">Domain Scores</h3>
              <div className="divide-y divide-gray-100">
                {data.domains.map((d) => (
                  <div key={d.code} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-gray-800">{d.titleEn}</span>
                    <span className="font-semibold" style={{ color: NAVY }}>
                      {d.weightPercent != null ? `${d.weightPercent}% weight` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data.resultsPublished && (
            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Final results have not been published yet. Scores shown are preliminary.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
