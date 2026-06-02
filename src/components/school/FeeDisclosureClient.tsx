'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Pencil } from 'lucide-react';
import Link from 'next/link';
import { saveFeeDisclosure } from '@/lib/actions/schoolPortal';
import { SCHOLARSHIP_LABELS, SCHOLARSHIP_SCHEMES } from '@/lib/school/helpers';
import type { FeeDisclosure, SchoolScholarship, ScholarshipScheme } from '@prisma/client';

const NAVY = '#1B2A6B';

type Props = {
  udise: string;
  disclosure: FeeDisclosure | null;
  scholarships: SchoolScholarship[];
};

export function FeeDisclosureClient({ udise, disclosure, scholarships }: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const schMap = Object.fromEntries(
    SCHOLARSHIP_SCHEMES.map((s) => [s, scholarships.find((x) => x.scheme === s)?.available ?? false]),
  ) as Record<ScholarshipScheme, boolean>;

  const [form, setForm] = useState({
    annualTuition: disclosure?.annualTuition ?? 0,
    admissionFee: disclosure?.admissionFee ?? 0,
    transportFee: disclosure?.transportFee ?? 0,
    otherCharges: disclosure?.otherCharges ?? 0,
    scholarshipsSummary: disclosure?.scholarshipsSummary ?? '',
    scholarships: schMap,
  });

  function handleSave() {
    startTransition(async () => {
      const res = await saveFeeDisclosure(form);
      if (res.success) {
        setSaved(true);
        setEditMode(false);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const hasAvailableScholarship = Object.values(form.scholarships).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Disclosure</h1>
          <p className="mt-1 text-sm text-gray-500">UDISE {udise}</p>
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: NAVY }}
          >
            <Pencil className="h-4 w-4" /> Edit Fee Disclosure
          </button>
        )}
      </div>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Fee disclosure saved successfully.
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Fee Structure</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['annualTuition', 'Annual Tuition (₹)'],
            ['admissionFee', 'Admission Fee (₹)'],
            ['transportFee', 'Transport Fee (₹)'],
            ['otherCharges', 'Other Charges (₹)'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-medium uppercase text-gray-500">{label}</label>
              {editMode ? (
                <input
                  type="number"
                  min={0}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  ₹ {(disclosure?.[key] ?? 0).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          ))}
          <div>
            <label className="text-xs font-medium uppercase text-gray-500">Scholarships Available (summary)</label>
            {editMode ? (
              <textarea
                value={form.scholarshipsSummary}
                onChange={(e) => setForm((f) => ({ ...f, scholarshipsSummary: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{disclosure?.scholarshipsSummary || '—'}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-gray-500">Last Updated</label>
            <p className="mt-1 text-sm text-gray-800">
              {disclosure?.lastUpdated.toLocaleDateString('en-IN') ?? 'Not yet updated'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Scholarship Details</h2>
        <div className="divide-y divide-gray-100">
          {SCHOLARSHIP_SCHEMES.map((scheme) => (
            <div key={scheme} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-800">{SCHOLARSHIP_LABELS[scheme]}</span>
              {editMode ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.scholarships[scheme]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scholarships: { ...f.scholarships, [scheme]: e.target.checked },
                      }))
                    }
                    className="rounded accent-[#1B2A6B]"
                  />
                  Available
                </label>
              ) : form.scholarships[scheme] ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <X className="h-5 w-5 text-gray-300" />
              )}
            </div>
          ))}
        </div>
        {!editMode && !hasAvailableScholarship && (
          <p className="mt-4 text-sm text-gray-500">
            No scholarship schemes have been marked available yet. Use Edit to enable schemes offered by this school.
          </p>
        )}
      </div>

      {editMode && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Last Updated will be set automatically to today on save.</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: NAVY }}
            >
              Save Disclosure
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FeeDisclosureNotApplicable() {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">Fee Disclosure</h1>
      <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">
        Fee Disclosure does not apply to government schools. Public schools in Uttar Pradesh do not charge tuition fees.
      </p>
      <Link
        href="/app/school"
        className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: NAVY }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
