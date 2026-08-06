import Link from 'next/link';
import { cn } from '@/lib/cn';
import { DIRECTORY_LEVEL_BADGE, scoreToLevel } from '@/lib/public/schoolProfile';
import { SQAAF_DOMAINS } from '@/lib/public/constants';
import type { PerformanceLevel } from '@/lib/public/constants';

/** Extracted from the former Compare Schools page so the side-by-side card
 * outlived that page's tab shell. Typed to just the fields it renders, so both
 * the dummy SchoolRecord set and generated placeholder schools can use it. */
export type ComparableSchool = {
  udise: string;
  name: string;
  district: string;
  /** Management type - Government / Aided / Private. */
  type: string;
  /** Class range - Primary, Upper Primary, and so on. */
  level: string;
  overallScore: number;
  performanceLevel: PerformanceLevel;
  domainScores: Record<(typeof SQAAF_DOMAINS)[number], number>;
};

/** buildSchoolProfileData emits domain scores as a {name, score} list keyed by
 * UP_SQAAF_DOMAINS, whose names match SQAAF_DOMAINS one for one. Reshapes it into
 * the record the card indexes into, falling back to 0 for any domain missing. */
export function toDomainScoreRecord(
  rows: { name: string; score: number }[],
): Record<(typeof SQAAF_DOMAINS)[number], number> {
  const byName = new Map(rows.map((r) => [r.name, r.score]));
  const record = {} as Record<(typeof SQAAF_DOMAINS)[number], number>;
  SQAAF_DOMAINS.forEach((domain) => {
    record[domain] = byName.get(domain) ?? 0;
  });
  return record;
}

const DOMAIN_LABELS: Record<(typeof SQAAF_DOMAINS)[number], string> = {
  'Infrastructure and Safety': 'Infrastructure & Safety',
  'Administration, HR and Leadership': 'Admin, HR & Leadership',
  'Teaching and Learning': 'Teaching & Learning',
  'Assessment and Learning Outcomes': 'Assessment & Outcomes',
  'Inclusiveness and Community Engagement': 'Inclusiveness & Engagement',
};

const LEVEL_BAR_FILL: Record<PerformanceLevel, string> = {
  Uday: '#F9A8D4',
  Unnat: '#FDE68A',
  Utkarsh: '#86EFAC',
};

const LEVEL_PILL_LARGE: Record<PerformanceLevel, string> = {
  Uday: 'bg-[#FCE7F3] text-pink-800',
  Unnat: 'bg-[#FEF9C3] text-amber-800',
  Utkarsh: 'bg-[#DCFCE7] text-green-800',
};

export function CompareReportCard({ school }: { school: ComparableSchool }) {
  const level = school.performanceLevel;

  return (
    <article className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-md">
      <h3 className="text-lg font-bold text-[#1B2A6B]">{school.name}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {school.district} · {school.type} · {school.level}
      </p>

      <div className="mt-6 flex flex-col items-center">
        <span
          className={cn(
            'rounded-full px-5 py-2 text-base font-bold',
            LEVEL_PILL_LARGE[level],
          )}
        >
          {level}
        </span>
        <p className="mt-4 text-3xl font-bold text-[#1B2A6B]">
          {school.overallScore}
          <span className="text-xl font-semibold text-gray-400">/100</span>
        </p>
      </div>

      <div className="my-6 border-t border-gray-200" />

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Domain Performance
      </p>
      <ul className="mt-4 space-y-4">
        {SQAAF_DOMAINS.map((domain) => {
          const score = school.domainScores[domain];
          const domainLevel = scoreToLevel(score);
          return (
            <li key={domain}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{DOMAIN_LABELS[domain]}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    DIRECTORY_LEVEL_BADGE[domainLevel],
                  )}
                >
                  {domainLevel}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${score}%`, backgroundColor: LEVEL_BAR_FILL[domainLevel] }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <Link
          href={`/public/schools/${school.udise}`}
          className="text-sm font-semibold text-[#1B2A6B] hover:underline"
        >
          View Full Profile →
        </Link>
      </div>
    </article>
  );
}
