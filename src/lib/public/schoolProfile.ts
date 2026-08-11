import { SCHOOLS, type SchoolRecord } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import { PERFORMANCE_COLORS, SQAAF_DOMAIN_WEIGHTAGE } from '@/lib/public/constants';

// Weightages per the UPSQAAF Overall Scoring System (5 domains, 11 sub-domains, 100% total).
export const UP_SQAAF_DOMAINS = [
  {
    id: 'infra',
    name: 'Infrastructure and Safety',
    weightage: SQAAF_DOMAIN_WEIGHTAGE['Infrastructure and Safety'],
  },
  {
    id: 'admin',
    name: 'Administration, HR and Leadership',
    weightage: SQAAF_DOMAIN_WEIGHTAGE['Administration, HR and Leadership'],
  },
  {
    id: 'pedagogy',
    name: 'Teaching and Learning',
    weightage: SQAAF_DOMAIN_WEIGHTAGE['Teaching and Learning'],
  },
  {
    id: 'assessment',
    name: 'Assessment and Learning Outcomes',
    weightage: SQAAF_DOMAIN_WEIGHTAGE['Assessment and Learning Outcomes'],
  },
  {
    id: 'inclusive',
    name: 'Inclusiveness and Community Engagement',
    weightage: SQAAF_DOMAIN_WEIGHTAGE['Inclusiveness and Community Engagement'],
  },
] as const;

// Domain Weightage Score (%) = Domain Ratio x Assigned Weightage; Final Score = sum across domains.
function weightedOverallScore(domainRawScores: { weightage: number; ourScore: number }[]): number {
  return Math.round(
    domainRawScores.reduce((sum, d) => sum + (d.ourScore / 100) * d.weightage, 0),
  );
}

export function scoreToLevel(score: number): PerformanceLevel {
  if (score <= 55) return 'Uday';
  if (score <= 80) return 'Unnat';
  return 'Utkarsh';
}

// First-cycle rating: 1 star for Uday, 2 for Unnat, 3 for Utkarsh. A simple
// tier-based scale rather than a continuous score-based one, since there's no
// prior-cycle history yet to smooth a finer-grained rating against.
export function tierStars(level: PerformanceLevel): 1 | 2 | 3 {
  switch (level) {
    case 'Uday':
      return 1;
    case 'Unnat':
      return 2;
    case 'Utkarsh':
      return 3;
  }
}

export function levelDescription(level: PerformanceLevel): string {
  switch (level) {
    case 'Uday':
      return 'Needs improvement.';
    case 'Unnat':
      return 'Performing satisfactorily.';
    case 'Utkarsh':
      return 'Exemplary performance.';
  }
}

function hashUdise(udise: string): number {
  let h = 0;
  for (let i = 0; i < udise.length; i++) {
    h = (h * 31 + udise.charCodeAt(i)) % 9973;
  }
  return h;
}

export function getDummySchoolRecord(udise: string): SchoolRecord | null {
  return SCHOOLS.find((s) => s.udise === udise) ?? null;
}

/** School.management, mapped onto the display vocabulary the directory uses. */
const MANAGEMENT_TO_TYPE: Record<string, SchoolType> = {
  GOVERNMENT: 'Government',
  AIDED: 'Aided',
  PRIVATE: 'Private',
};

/**
 * @param management  `School.management` when the caller has the record to hand.
 *   Pass it. Without it the type falls back to a hash of the UDISE, which is
 *   stable and completely made up — it was the only option before the column
 *   existed, and it is kept only so callers that genuinely have no record (the
 *   public fallback path) still render something.
 */
export function deriveResultFields(
  udise: string,
  management?: string | null,
): {
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  feeDisclosed: boolean;
  overallScore: number;
} {
  const real = management ? MANAGEMENT_TO_TYPE[management] : undefined;
  const match = getDummySchoolRecord(udise);
  if (match) {
    return {
      type: real ?? match.type,
      performanceLevel: match.performanceLevel,
      feeDisclosed: match.feeDisclosed,
      overallScore: match.overallScore,
    };
  }
  const h = hashUdise(udise);
  const types: SchoolType[] = ['Government', 'Aided', 'Private'];
  const score = 35 + (h % 46);
  return {
    type: real ?? types[h % 3],
    performanceLevel: scoreToLevel(score),
    feeDisclosed: h % 2 === 0,
    overallScore: score,
  };
}

export type SchoolProfileBase = {
  udise: string;
  name: string;
  district: string;
  block: string;
};

/** One photograph of a school. Lives here rather than in the carousel so the data
 *  shape does not depend on the component that happens to draw it. */
export type SchoolPhoto = {
  /** Absolute or app-relative URL. */
  url: string;
  /** What the photograph shows, e.g. "Classroom". Shown under the frame. */
  caption: string;
};

export type SchoolProfileData = SchoolProfileBase & {
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  overallScore: number;
  feeDisclosed: boolean;
  /**
   * Whether a verifier has actually checked this school's assessment, and when.
   *
   * Supplied by the page from `verifiedStatus.ts`, never derived here. This replaced
   * an `accreditation` field computed as `h % 3 === 0 ? 'SQAAF Verified' : 'Pending'`
   * from a hash of the UDISE code — a public claim about a school's verification
   * decided by arithmetic on its own number.
   */
  verified: boolean;
  verifiedOn: string | null;
  recognition: string;
  board: string;
  classes: string;
  overview: {
    totalStudents: number;
    totalTeachers: number;
    pupilTeacherRatio: string;
    totalClassrooms: number;
    nonTeachingStaff: number;
    subjectTeachers: number;
    functionalToilets: number;
    drinkingWater: 'Available' | 'Not Available';
    enrolment: {
      primary: number;
      upperPrimary: number;
      secondary: number;
      higherSecondary: number;
      boys: number;
      girls: number;
      sc: number;
      st: number;
      obc: number;
      general: number;
    };
    dropout: { primary: number; upperPrimary: number; secondary: number };
    studentAttendance: { primary: number; upperPrimary: number; secondary: number };
    teacherAttendance: { primary: number; upperPrimary: number; secondary: number };
    infrastructureTags: string[];
    safetyChecks: { label: string; done: boolean; date?: string }[];
  };
  performance: {
    stateAverage: number;
    districtAverage: number;
    topScore: number;
    domains: {
      id: string;
      name: string;
      weightage: number;
      ourScore: number;
      topScore: number;
      level: PerformanceLevel;
      subDomains: { name: string; score: number }[];
    }[];
  };
  fees: {
    annualTuition: string;
    admissionFee: string;
    transportFee: string;
    otherCharges: string;
    scholarshipsAvailable: string;
    lastUpdated: string;
    scholarships: string[];
  };
  reportCard: {
    strengths: string[];
    improvements: string[];
    domainScores: { name: string; score: number }[];
    learningOutcomes: {
      grade: string;
      headerLabel: string;
      subjects: { name: string; pct: number; stateAvg: number }[];
    }[];
  };
  /**
   * Photographs of the school, for the carousel at the bottom of the Overview tab.
   *
   * Always empty today: there is no photo field on `School` and no upload flow, so
   * there is nothing to read. The field exists so the profile carries the shape a
   * photo will arrive in — when an upload flow lands, this is the only place that
   * changes, not the component. Deliberately not derived from the UDISE hash the
   * way this builder derives enrolment: a fabricated photograph of a real school
   * is a different kind of lie from a fabricated number.
   */
  photos: SchoolPhoto[];
};

const CLASS_LEVELS = ['Primary', 'Upper Primary', 'Secondary', 'Higher Secondary'] as const;
const CLASS_END_GRADE: Record<(typeof CLASS_LEVELS)[number], number> = {
  Primary: 5,
  'Upper Primary': 8,
  Secondary: 10,
  'Higher Secondary': 12,
};

function pctClamp(value: number): number {
  return Math.min(99, Math.max(30, Math.round(value)));
}

/**
 * `real` carries the facts this builder cannot invent — whether a verifier has been,
 * and the school's photographs. Everything else here is derived from the UDISE hash
 * because the columns do not exist yet; these two must not be, because one is a
 * public claim about an inspection and the other is a picture of a real place.
 */
/** What the school itself entered, from SchoolProfileDetail. Every field optional:
 *  a school that filled in enrolment but not classrooms should have its enrolment
 *  used and the rest fall back. */
export type SchoolEnteredDetail = {
  board?: string | null;
  classesFrom?: string | null;
  classesTo?: string | null;
  totalStudents?: number | null;
  totalTeachers?: number | null;
  nonTeachingStaff?: number | null;
  subjectTeachers?: number | null;
  totalClassrooms?: number | null;
  functionalToilets?: number | null;
  drinkingWater?: boolean | null;
  enrolPrimary?: number | null;
  enrolUpperPrimary?: number | null;
  enrolSecondary?: number | null;
  enrolHigherSec?: number | null;
  enrolBoys?: number | null;
  enrolGirls?: number | null;
  enrolSc?: number | null;
  enrolSt?: number | null;
  enrolObc?: number | null;
  enrolGeneral?: number | null;
  facilities?: string[] | null;
  safetyItems?: string[] | null;
};

export function buildSchoolProfileData(
  base: SchoolProfileBase,
  real: {
    verified?: boolean;
    verifiedOn?: string | null;
    photos?: SchoolPhoto[];
    detail?: SchoolEnteredDetail | null;
  } = {},
): SchoolProfileData {
  // What the school entered wins over what this function derives. Everything below
  // that is still hash-derived is a placeholder for a field the school has not been
  // asked for yet, not a claim about the school.
  const d = real.detail ?? null;
  const pick = (entered: number | null | undefined, derived: number) =>
    entered == null ? derived : entered;
  const dummy = getDummySchoolRecord(base.udise);
  const derived = deriveResultFields(base.udise);
  const h = hashUdise(base.udise);
  // Seeds the per-domain jitter below; the final score/level is derived FROM the
  // domain scores via the weighted formula, not assigned independently of them.
  const jitterSeed = dummy?.overallScore ?? derived.overallScore;
  const students = dummy?.students ?? 400 + (h % 900);
  const teachers = dummy?.teachers ?? 12 + (h % 40);

  const classLevel = dummy?.level ?? CLASS_LEVELS[h % CLASS_LEVELS.length];
  const endGrade = CLASS_END_GRADE[classLevel];
  const startsAtBalvatika = h % 2 === 0;
  const classRange = startsAtBalvatika ? `Balvatika to ${endGrade}` : `1-${endGrade}`;
  const hasGrade10 = endGrade >= 10;
  const hasGrade12 = endGrade >= 12;

  const domainScores = UP_SQAAF_DOMAINS.map((d, i) => {
    const ourScore = dummy
      ? dummy.domainScores[d.name]
      : Math.min(95, Math.max(28, jitterSeed - 8 + ((h + i * 7) % 18)));
    const topScore = Math.min(98, ourScore + 12 + (i % 5));
    return {
      id: d.id,
      name: d.name,
      weightage: d.weightage,
      ourScore,
      topScore,
      level: scoreToLevel(ourScore),
      subDomains: [
        { name: 'Indicator A', score: ourScore - 3 },
        { name: 'Indicator B', score: ourScore + 2 },
        { name: 'Indicator C', score: ourScore - 1 },
      ],
    };
  });

  // Final School Score (%) = sum of each domain's (ratio x weightage) — per the UPSQAAF methodology.
  const score = weightedOverallScore(domainScores);
  const level = scoreToLevel(score);

  const boys = Math.floor(students * 0.52);
  const girls = students - boys;

  return {
    ...base,
    // Still empty from every caller: no photo field on School and no upload flow yet.
    // The carousel shows labelled placeholders for that, which is the truthful state
    // of the record. Passed in rather than hardcoded so the upload work changes the
    // page, not this builder.
    photos: real.photos ?? [],
    type: dummy?.type ?? derived.type,
    performanceLevel: level,
    overallScore: score,
    feeDisclosed: dummy?.feeDisclosed ?? derived.feeDisclosed,
    verified: real.verified ?? false,
    verifiedOn: real.verifiedOn ?? null,
    recognition: 'Recognized',
    board: d?.board?.trim() || (derived.type === 'Private' ? 'CBSE' : 'UP Board'),
    classes:
      d?.classesFrom?.trim() && d?.classesTo?.trim()
        ? `${d.classesFrom.trim()} to ${d.classesTo.trim()}`
        : classRange,
    overview: {
      totalStudents: pick(d?.totalStudents, students),
      totalTeachers: pick(d?.totalTeachers, teachers),
      pupilTeacherRatio: `${(pick(d?.totalStudents, students) / Math.max(1, pick(d?.totalTeachers, teachers))).toFixed(1)}:1`,
      totalClassrooms: pick(d?.totalClassrooms, Math.ceil(students / 40)),
      nonTeachingStaff: pick(d?.nonTeachingStaff, 4 + (h % 8)),
      subjectTeachers: pick(d?.subjectTeachers, Math.floor(teachers * 0.7)),
      functionalToilets: pick(d?.functionalToilets, 6 + (h % 10)),
      drinkingWater:
        d?.drinkingWater == null
          ? h % 5 === 0
            ? 'Not Available'
            : 'Available'
          : d.drinkingWater
            ? 'Available'
            : 'Not Available',
      enrolment: {
        primary: pick(d?.enrolPrimary, Math.floor(students * 0.35)),
        upperPrimary: pick(d?.enrolUpperPrimary, Math.floor(students * 0.25)),
        secondary: pick(d?.enrolSecondary, Math.floor(students * 0.22)),
        higherSecondary: pick(d?.enrolHigherSec, Math.floor(students * 0.18)),
        boys: pick(d?.enrolBoys, boys),
        girls: pick(d?.enrolGirls, girls),
        sc: pick(d?.enrolSc, Math.floor(students * 0.18)),
        st: pick(d?.enrolSt, Math.floor(students * 0.08)),
        obc: pick(d?.enrolObc, Math.floor(students * 0.32)),
        general: pick(d?.enrolGeneral, students - Math.floor(students * 0.58)),
      },
      dropout: {
        primary: 1.2 + (h % 3) * 0.3,
        upperPrimary: 2.1 + (h % 2) * 0.4,
        secondary: 3.4 + (h % 4) * 0.2,
      },
      studentAttendance: {
        primary: 88 + (h % 4),
        upperPrimary: 86 + (h % 5),
        secondary: 85 + (h % 3),
      },
      teacherAttendance: {
        primary: 94 + (h % 3),
        upperPrimary: 92 + (h % 4),
        secondary: 91 + (h % 5),
      },
      infrastructureTags: d?.facilities ?? ['Library', 'Science Lab', 'Computer Lab', 'Playground'],
      safetyChecks: [
        { label: 'Functional Toilets (Separate)', done: true, date: '15 Jan 2025' },
        { label: 'Safe Drinking Water Certification', done: true, date: '02 Mar 2025' },
        { label: 'Medical Room', done: h % 2 === 0, date: h % 2 === 0 ? '10 Nov 2024' : undefined },
        { label: 'Secure School Premises (Boundary Wall + CCTV)', done: true, date: '20 Aug 2024' },
        { label: 'Fire Safety Certificate', done: true, date: '05 Jun 2025' },
        { label: 'Building Safety Certificate', done: h % 3 !== 0, date: h % 3 !== 0 ? '18 Apr 2025' : undefined },
      ],
    },
    performance: {
      stateAverage: 54,
      districtAverage: 52 + (h % 8),
      topScore: 88,
      domains: domainScores,
    },
    fees: {
      annualTuition: derived.type === 'Government' ? '₹0 (Government)' : `₹${(8000 + (h % 12) * 1500).toLocaleString('en-IN')}`,
      admissionFee: `₹${(500 + (h % 5) * 200).toLocaleString('en-IN')}`,
      transportFee: `₹${(1200 + (h % 6) * 300).toLocaleString('en-IN')} / year`,
      otherCharges: `₹${(800 + (h % 4) * 250).toLocaleString('en-IN')}`,
      scholarshipsAvailable: dummy?.feeDisclosed ? 'Yes' : 'Limited',
      lastUpdated: 'March 2025',
      scholarships: ['Merit Scholarship', 'Economically Weaker Section', 'Sports Quota'],
    },
    reportCard: {
      strengths: [
        UP_SQAAF_DOMAINS[2].name,
        UP_SQAAF_DOMAINS[0].name,
        UP_SQAAF_DOMAINS[3].name,
      ],
      improvements: [
        UP_SQAAF_DOMAINS[1].name,
        UP_SQAAF_DOMAINS[4].name,
        UP_SQAAF_DOMAINS[0].name,
      ],
      domainScores: domainScores.map((d) => ({ name: d.name, score: d.ourScore })),
      learningOutcomes: [
        ...(hasGrade10
          ? [
              {
                grade: 'Grade 10',
                headerLabel: 'Board Pass %',
                subjects: [
                  { name: 'Board Pass %', pct: pctClamp(score + 20 + (h % 6)), stateAvg: pctClamp(score + 10) },
                  { name: 'Language', pct: pctClamp(score + 16 + (h % 5)), stateAvg: pctClamp(score + 2) },
                  { name: 'Mathematics', pct: pctClamp(score + 10 + (h % 8)), stateAvg: pctClamp(score - 6) },
                  { name: 'Science', pct: pctClamp(score + 12 + (h % 6)), stateAvg: pctClamp(score - 4) },
                  { name: 'Social Science', pct: pctClamp(score + 14 + (h % 4)), stateAvg: pctClamp(score - 2) },
                ],
              },
            ]
          : []),
        ...(hasGrade12
          ? [
              {
                grade: 'Grade 12',
                headerLabel: 'Overall Achievement',
                subjects: [
                  { name: 'Board Pass %', pct: pctClamp(score - 3 + (h % 6)), stateAvg: pctClamp(score - 4) },
                  {
                    name: 'Distinction %',
                    pct: Math.min(40, Math.max(5, Math.round(score * 0.18) + (h % 5))),
                    stateAvg: Math.min(38, Math.max(4, Math.round(score * 0.16))),
                  },
                  { name: 'Arts Stream Pass %', pct: pctClamp(score + 3 + (h % 6)), stateAvg: pctClamp(score) },
                  { name: 'Science Stream Pass %', pct: pctClamp(score - 11 + (h % 8)), stateAvg: pctClamp(score - 6) },
                  { name: 'Commerce Stream Pass %', pct: pctClamp(score - 6 + (h % 7)), stateAvg: pctClamp(score - 2) },
                ],
              },
            ]
          : []),
      ],
    },
  };
}

export { PERFORMANCE_COLORS };

export const DIRECTORY_LEVEL_BADGE: Record<PerformanceLevel, string> = {
  Uday: 'bg-gray-100 text-gray-700',
  Unnat: 'bg-[#F5B731] text-[#1B2A6B]',
  Utkarsh: 'bg-[#F5B731] text-[#1B2A6B]',
};
