'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import {
  saveSchoolProfileDetail,
  type SchoolProfileDetailInput,
} from '@/lib/actions/schoolPortal';

const NAVY = '#1B2A6B';

/** The facilities and safety items the public profile lists. Kept here so the form
 *  offers exactly what the page displays — a checkbox for something the profile never
 *  shows is a question asked for nothing. */
export const FACILITIES = ['Library', 'Science Lab', 'Computer Lab', 'Playground'] as const;

export const SAFETY_ITEMS = [
  'Functional Toilets (Separate)',
  'Safe Drinking Water Certification',
  'Medical Room',
  'Secure Premises / Boundary Wall',
  'Fire Safety Certificate',
  'Building Safety Certificate',
] as const;

type Values = SchoolProfileDetailInput;

const NUMBER_FIELDS: { key: keyof Values; label: string }[] = [
  { key: 'totalStudents', label: 'Total students' },
  { key: 'totalTeachers', label: 'Total teachers' },
  { key: 'subjectTeachers', label: 'Subject teachers' },
  { key: 'nonTeachingStaff', label: 'Non-teaching staff' },
  { key: 'totalClassrooms', label: 'Total classrooms' },
  { key: 'functionalToilets', label: 'Functional toilets' },
];

const ENROLMENT_STAGE: { key: keyof Values; label: string }[] = [
  { key: 'enrolPrimary', label: 'Primary' },
  { key: 'enrolUpperPrimary', label: 'Upper Primary' },
  { key: 'enrolSecondary', label: 'Secondary' },
  { key: 'enrolHigherSec', label: 'Higher Secondary' },
];

const ENROLMENT_SPLIT: { key: keyof Values; label: string }[] = [
  { key: 'enrolBoys', label: 'Boys' },
  { key: 'enrolGirls', label: 'Girls' },
  { key: 'enrolSc', label: 'SC' },
  { key: 'enrolSt', label: 'ST' },
  { key: 'enrolObc', label: 'OBC' },
  { key: 'enrolGeneral', label: 'General' },
];

/**
 * Everything the public profile shows about a school, as a form the school fills in.
 *
 * Every figure here used to come from a hash of the UDISE code — pupils, teachers,
 * classrooms, enrolment, which facilities exist. Stable, plausible, invented, and
 * uncorrectable, because there was nowhere to enter the real ones.
 *
 * Nothing is required. A school knows its enrolment today and may have to ask someone
 * about its classroom count, and a form that refuses a partial save is a form that
 * gets abandoned. Blank is stored as null rather than zero: not entered is not the
 * same claim as none.
 */
export function SchoolDetailForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<Values>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleIn(list: string[], item: string): string[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const res = await saveSchoolProfileDetail(v);
      if (!res.ok) {
        setError(res.error ?? 'Could not save. Try again.');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const input =
    'mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B2A6B] focus:outline-none focus:ring-1 focus:ring-[#1B2A6B]';
  const label = 'block text-xs font-medium text-gray-700';

  const stageTotal = ENROLMENT_STAGE.reduce((a, f) => a + (Number(v[f.key]) || 0), 0);
  const genderTotal = (Number(v.enrolBoys) || 0) + (Number(v.enrolGirls) || 0);
  const declared = Number(v.totalStudents) || 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Basic information</h2>
        <p className="mt-1 text-sm text-gray-500">Shown at the top of your public page.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="board">Board</label>
            <input id="board" value={v.board} onChange={(e) => set('board', e.target.value)}
              placeholder="UP Board, CBSE, ICSE" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="classesFrom">Classes from</label>
            <input id="classesFrom" value={v.classesFrom} onChange={(e) => set('classesFrom', e.target.value)}
              placeholder="Balvatika or 1" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="classesTo">Classes to</label>
            <input id="classesTo" value={v.classesTo} onChange={(e) => set('classesTo', e.target.value)}
              placeholder="8" className={input} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Pupils, staff and rooms</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {NUMBER_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <label className={label} htmlFor={String(f.key)}>{f.label}</label>
              <input
                id={String(f.key)}
                value={v[f.key] as string}
                onChange={(e) => set(f.key, e.target.value as Values[typeof f.key])}
                inputMode="numeric"
                className={input}
              />
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2.5 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={v.drinkingWater}
            onChange={(e) => set('drinkingWater', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Safe drinking water is available
        </label>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Enrolment</h2>
        <p className="mt-1 text-sm text-gray-500">By stage, and by gender and category.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {ENROLMENT_STAGE.map((f) => (
            <div key={String(f.key)}>
              <label className={label} htmlFor={String(f.key)}>{f.label}</label>
              <input id={String(f.key)} value={v[f.key] as string}
                onChange={(e) => set(f.key, e.target.value as Values[typeof f.key])}
                inputMode="numeric" className={input} />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-6">
          {ENROLMENT_SPLIT.map((f) => (
            <div key={String(f.key)}>
              <label className={label} htmlFor={String(f.key)}>{f.label}</label>
              <input id={String(f.key)} value={v[f.key] as string}
                onChange={(e) => set(f.key, e.target.value as Values[typeof f.key])}
                inputMode="numeric" className={input} />
            </div>
          ))}
        </div>

        {/* Warns, never blocks. Stage and gender totals legitimately differ from the
            headcount mid-year, and a school should not be stopped from saving because
            its own registers disagree by three pupils. */}
        {declared > 0 && (stageTotal > 0 || genderTotal > 0) && (
          <div className="mt-4 space-y-1 text-xs text-gray-500">
            {stageTotal > 0 && stageTotal !== declared && (
              <p>Stage figures add to {stageTotal}, against a total of {declared}.</p>
            )}
            {genderTotal > 0 && genderTotal !== declared && (
              <p>Boys and girls add to {genderTotal}, against a total of {declared}.</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Facilities and safety</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tick what your school has. Unticked items show as unavailable on your public page.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {FACILITIES.map((f) => (
            <label key={f} className="flex items-center gap-2.5 text-sm text-gray-800">
              <input type="checkbox" checked={v.facilities.includes(f)}
                onChange={() => set('facilities', toggleIn(v.facilities, f))}
                className="h-4 w-4 rounded border-gray-300" />
              {f}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-2.5 border-t border-gray-100 pt-4 sm:grid-cols-2">
          {SAFETY_ITEMS.map((s) => (
            <label key={s} className="flex items-center gap-2.5 text-sm text-gray-800">
              <input type="checkbox" checked={v.safetyItems.includes(s)}
                onChange={() => set('safetyItems', toggleIn(v.safetyItems, s))}
                className="h-4 w-4 rounded border-gray-300" />
              {s}
            </label>
          ))}
        </div>
      </section>

      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: NAVY }}>
          {pending ? 'Saving…' : 'Save school information'}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#14603A]">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
        <span className="text-xs text-gray-400">
          Anything left blank stays blank on your public page — it is not counted as zero.
        </span>
      </div>
    </form>
  );
}
