import { SCHOOLS, type SchoolRecord } from '@/lib/public/dummyData';
import type { PerformanceLevel, SchoolType } from '@/lib/public/constants';
import { PERFORMANCE_COLORS } from '@/lib/public/constants';

export const UP_SQAAF_DOMAINS = [
  {
    id: 'infra',
    name: 'Infrastructure and Safety',
    weightage: 20,
  },
  {
    id: 'admin',
    name: 'Administration, HR and Leadership',
    weightage: 20,
  },
  {
    id: 'pedagogy',
    name: 'Teaching and Learning',
    weightage: 20,
  },
  {
    id: 'assessment',
    name: 'Assessment and Learning Outcomes',
    weightage: 20,
  },
  {
    id: 'inclusive',
    name: 'Inclusiveness and Community Engagement',
    weightage: 20,
  },
] as const;

export type AccreditationStatus = 'SQAAF Verified' | 'Pending';

export function scoreToLevel(score: number): PerformanceLevel {
  if (score <= 55) return 'Uday';
  if (score <= 80) return 'Unnat';
  return 'Utkarsh';
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

export function deriveResultFields(udise: string): {
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  feeDisclosed: boolean;
  accreditation: AccreditationStatus;
  overallScore: number;
} {
  const match = getDummySchoolRecord(udise);
  if (match) {
    return {
      type: match.type,
      performanceLevel: match.performanceLevel,
      feeDisclosed: match.feeDisclosed,
      accreditation: match.accreditation,
      overallScore: match.overallScore,
    };
  }
  const h = hashUdise(udise);
  const types: SchoolType[] = ['Government', 'Aided', 'Private'];
  const score = 35 + (h % 46);
  return {
    type: types[h % 3],
    performanceLevel: scoreToLevel(score),
    feeDisclosed: h % 2 === 0,
    accreditation: h % 3 === 0 ? 'SQAAF Verified' : 'Pending',
    overallScore: score,
  };
}

export type SchoolProfileBase = {
  udise: string;
  name: string;
  district: string;
  block: string;
};

export type SchoolProfileData = SchoolProfileBase & {
  type: SchoolType;
  performanceLevel: PerformanceLevel;
  overallScore: number;
  feeDisclosed: boolean;
  accreditation: AccreditationStatus;
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

export function buildSchoolProfileData(base: SchoolProfileBase): SchoolProfileData {
  const dummy = getDummySchoolRecord(base.udise);
  const derived = deriveResultFields(base.udise);
  const h = hashUdise(base.udise);
  const score = dummy?.overallScore ?? derived.overallScore;
  const level = dummy?.performanceLevel ?? derived.performanceLevel;
  const students = dummy?.students ?? 400 + (h % 900);
  const teachers = dummy?.teachers ?? 12 + (h % 40);

  const classLevel = dummy?.level ?? CLASS_LEVELS[h % CLASS_LEVELS.length];
  const endGrade = CLASS_END_GRADE[classLevel];
  const startsAtBalvatika = h % 2 === 0;
  const classRange = startsAtBalvatika ? `Balvatika to ${endGrade}` : `1-${endGrade}`;
  const hasGrade10 = endGrade >= 10;
  const hasGrade12 = endGrade >= 12;

  const domainScores = UP_SQAAF_DOMAINS.map((d, i) => {
    const ourScore = Math.min(95, Math.max(28, score - 8 + ((h + i * 7) % 18)));
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

  const boys = Math.floor(students * 0.52);
  const girls = students - boys;

  return {
    ...base,
    type: dummy?.type ?? derived.type,
    performanceLevel: level,
    overallScore: score,
    feeDisclosed: dummy?.feeDisclosed ?? derived.feeDisclosed,
    accreditation: dummy?.accreditation ?? derived.accreditation,
    recognition: 'Recognized',
    board: derived.type === 'Private' ? 'CBSE' : 'UP Board',
    classes: classRange,
    overview: {
      totalStudents: students,
      totalTeachers: teachers,
      pupilTeacherRatio: `${(students / teachers).toFixed(1)}:1`,
      totalClassrooms: Math.ceil(students / 40),
      nonTeachingStaff: 4 + (h % 8),
      subjectTeachers: Math.floor(teachers * 0.7),
      functionalToilets: 6 + (h % 10),
      drinkingWater: h % 5 === 0 ? 'Not Available' : 'Available',
      enrolment: {
        primary: Math.floor(students * 0.35),
        upperPrimary: Math.floor(students * 0.25),
        secondary: Math.floor(students * 0.22),
        higherSecondary: Math.floor(students * 0.18),
        boys,
        girls,
        sc: Math.floor(students * 0.18),
        st: Math.floor(students * 0.08),
        obc: Math.floor(students * 0.32),
        general: students - Math.floor(students * 0.58),
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
      infrastructureTags: ['Library', 'Science Lab', 'Computer Lab', 'Playground'],
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
