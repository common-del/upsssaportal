import type { District, PerformanceLevel, SchoolLevel, SchoolType } from './constants';
import { DISTRICTS, SQAAF_DOMAINS } from './constants';

export type DistrictChartRow = {
  district: District;
  Government: number;
  Aided: number;
  Private: number;
};

export const DISTRICT_SCHOOL_CHART: DistrictChartRow[] = [
  { district: 'Lucknow', Government: 2520, Aided: 980, Private: 1450 },
  { district: 'Agra', Government: 2230, Aided: 720, Private: 1100 },
  { district: 'Varanasi', Government: 2910, Aided: 890, Private: 980 },
  { district: 'Kanpur', Government: 2490, Aided: 1050, Private: 1680 },
  { district: 'Prayagraj', Government: 2430, Aided: 640, Private: 920 },
  { district: 'Meerut', Government: 1970, Aided: 810, Private: 1320 },
  { district: 'Gorakhpur', Government: 3220, Aided: 550, Private: 780 },
  { district: 'Aligarh', Government: 2020, Aided: 690, Private: 890 },
  { district: 'Bareilly', Government: 2330, Aided: 760, Private: 1010 },
  { district: 'Mathura', Government: 1820, Aided: 480, Private: 720 },
];

export type SchoolRecord = {
  id: string;
  name: string;
  udise: string;
  district: District;
  block: string;
  type: SchoolType;
  level: SchoolLevel;
  feeDisclosed: boolean;
  accreditation: 'SQAAF Verified' | 'Pending';
  overallScore: number;
  domainScores: Record<(typeof SQAAF_DOMAINS)[number], number>;
  students: number;
  teachers: number;
  performanceLevel: PerformanceLevel;
};

export const SCHOOLS: SchoolRecord[] = [
  { id: '1', name: 'Government Inter College, Hazratganj', udise: '09123456789', district: 'Lucknow', block: 'Hazratganj', type: 'Government', level: 'Higher Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 68, domainScores: { 'Teaching-Learning': 72, 'Assessment & Evaluation': 65, 'School Management': 74, 'Student Development': 66, Infrastructure: 63 }, students: 1240, teachers: 48, performanceLevel: 'Utkarsh' },
  { id: '2', name: 'St. Mary\'s Convent School', udise: '09123456790', district: 'Lucknow', block: 'Gomti Nagar', type: 'Private', level: 'Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 74, domainScores: { 'Teaching-Learning': 78, 'Assessment & Evaluation': 71, 'School Management': 76, 'Student Development': 73, Infrastructure: 72 }, students: 890, teachers: 42, performanceLevel: 'Utkarsh' },
  { id: '3', name: 'Aided Junior High School, Agra Cantt', udise: '09123456791', district: 'Agra', block: 'Agra Cantt', type: 'Aided', level: 'Upper Primary', feeDisclosed: false, accreditation: 'Pending', overallScore: 52, domainScores: { 'Teaching-Learning': 54, 'Assessment & Evaluation': 48, 'School Management': 58, 'Student Development': 51, Infrastructure: 49 }, students: 420, teachers: 18, performanceLevel: 'Unnat' },
  { id: '4', name: 'Government Primary School, Paharia', udise: '09123456792', district: 'Varanasi', block: 'Paharia', type: 'Government', level: 'Primary', feeDisclosed: false, accreditation: 'Pending', overallScore: 38, domainScores: { 'Teaching-Learning': 40, 'Assessment & Evaluation': 35, 'School Management': 42, 'Student Development': 36, Infrastructure: 37 }, students: 180, teachers: 8, performanceLevel: 'Uday' },
  { id: '5', name: 'Kanpur Public School', udise: '09123456793', district: 'Kanpur', block: 'Civil Lines', type: 'Private', level: 'Higher Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 71, domainScores: { 'Teaching-Learning': 70, 'Assessment & Evaluation': 73, 'School Management': 69, 'Student Development': 72, Infrastructure: 71 }, students: 1560, teachers: 62, performanceLevel: 'Utkarsh' },
  { id: '6', name: 'Government Primary School, Naini', udise: '09123456794', district: 'Prayagraj', block: 'Naini', type: 'Government', level: 'Primary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 58, domainScores: { 'Teaching-Learning': 60, 'Assessment & Evaluation': 55, 'School Management': 62, 'Student Development': 57, Infrastructure: 56 }, students: 210, teachers: 6, performanceLevel: 'Unnat' },
  { id: '7', name: 'Saraswati Vidya Mandir', udise: '09123456795', district: 'Meerut', block: 'Sardhana', type: 'Aided', level: 'Secondary', feeDisclosed: true, accreditation: 'Pending', overallScore: 61, domainScores: { 'Teaching-Learning': 63, 'Assessment & Evaluation': 59, 'School Management': 65, 'Student Development': 60, Infrastructure: 58 }, students: 680, teachers: 28, performanceLevel: 'Unnat' },
  { id: '8', name: 'Gorakhpur Model School', udise: '09123456796', district: 'Gorakhpur', block: 'Golghar', type: 'Government', level: 'Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 55, domainScores: { 'Teaching-Learning': 52, 'Assessment & Evaluation': 56, 'School Management': 58, 'Student Development': 54, Infrastructure: 55 }, students: 920, teachers: 35, performanceLevel: 'Unnat' },
  { id: '9', name: 'Aligarh Muslim University High School', udise: '09123456797', district: 'Aligarh', block: 'AMU', type: 'Aided', level: 'Higher Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 79, domainScores: { 'Teaching-Learning': 82, 'Assessment & Evaluation': 77, 'School Management': 81, 'Student Development': 78, Infrastructure: 77 }, students: 1100, teachers: 55, performanceLevel: 'Utkarsh' },
  { id: '10', name: 'Bareilly Central Academy', udise: '09123456798', district: 'Bareilly', block: 'Civil Lines', type: 'Private', level: 'Upper Primary', feeDisclosed: false, accreditation: 'Pending', overallScore: 48, domainScores: { 'Teaching-Learning': 46, 'Assessment & Evaluation': 50, 'School Management': 47, 'Student Development': 49, Infrastructure: 48 }, students: 340, teachers: 14, performanceLevel: 'Uday' },
  { id: '11', name: 'Mathura Vidyalaya', udise: '09123456799', district: 'Mathura', block: 'Krishna Nagar', type: 'Private', level: 'Primary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 64, domainScores: { 'Teaching-Learning': 66, 'Assessment & Evaluation': 62, 'School Management': 67, 'Student Development': 63, Infrastructure: 62 }, students: 280, teachers: 12, performanceLevel: 'Utkarsh' },
  { id: '12', name: 'Government Girls Inter College, Agra', udise: '09123456800', district: 'Agra', block: 'Tajganj', type: 'Government', level: 'Higher Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 66, domainScores: { 'Teaching-Learning': 68, 'Assessment & Evaluation': 64, 'School Management': 70, 'Student Development': 65, Infrastructure: 63 }, students: 980, teachers: 40, performanceLevel: 'Utkarsh' },
  { id: '13', name: 'Aided Upper Primary School, Assi', udise: '09123456801', district: 'Varanasi', block: 'Assi', type: 'Aided', level: 'Upper Primary', feeDisclosed: false, accreditation: 'Pending', overallScore: 42, domainScores: { 'Teaching-Learning': 44, 'Assessment & Evaluation': 40, 'School Management': 43, 'Student Development': 41, Infrastructure: 42 }, students: 150, teachers: 7, performanceLevel: 'Uday' },
  { id: '14', name: 'Prayagraj Kendriya Vidyalaya', udise: '09123456802', district: 'Prayagraj', block: 'Civil Lines', type: 'Government', level: 'Secondary', feeDisclosed: true, accreditation: 'SQAAF Verified', overallScore: 72, domainScores: { 'Teaching-Learning': 74, 'Assessment & Evaluation': 70, 'School Management': 75, 'Student Development': 71, Infrastructure: 70 }, students: 1350, teachers: 52, performanceLevel: 'Utkarsh' },
  { id: '15', name: 'Lucknow International School', udise: '09123456803', district: 'Lucknow', block: 'Aliganj', type: 'Private', level: 'Primary', feeDisclosed: true, accreditation: 'Pending', overallScore: 59, domainScores: { 'Teaching-Learning': 61, 'Assessment & Evaluation': 57, 'School Management': 60, 'Student Development': 58, Infrastructure: 59 }, students: 450, teachers: 22, performanceLevel: 'Unnat' },
];

export const DOMAIN_AVERAGES = [
  { domain: 'Teaching-Learning', score: 58 },
  { domain: 'Assessment & Evaluation', score: 54 },
  { domain: 'School Management', score: 61 },
  { domain: 'Student Development', score: 56 },
  { domain: 'Infrastructure', score: 47 },
];

export const PERFORMANCE_DISTRIBUTION = [
  { name: 'Uday' as PerformanceLevel, value: 28, fill: '#F9A8D4' },
  { name: 'Unnat' as PerformanceLevel, value: 39, fill: '#FDE68A' },
  { name: 'Utkarsh' as PerformanceLevel, value: 32, fill: '#86EFAC' },
];

export const DISPUTE_CATEGORIES = [
  { name: 'Infrastructure', value: 12, fill: '#1B2A6B' },
  { name: 'Teacher Attendance', value: 9, fill: '#F5B731' },
  { name: 'Student Safety', value: 8, fill: '#9CA3AF' },
  { name: 'Mid Day Meal', value: 7, fill: '#22C55E' },
  { name: 'Scholarship', value: 6, fill: '#F97316' },
  { name: 'Other', value: 5, fill: '#3B82F6' },
];

export const SQAAF_DISTRICT_TABLE = [
  { district: 'Lucknow', totalSchools: 4950, govt: 2100, aided: 980, private: 1450, students: 892000, teachers: 28400, verified: 1420, recognition: 89 },
  { district: 'Agra', totalSchools: 4050, govt: 1850, aided: 720, private: 1100, students: 720000, teachers: 22100, verified: 1180, recognition: 82 },
  { district: 'Varanasi', totalSchools: 4780, govt: 2400, aided: 890, private: 980, students: 810000, teachers: 25600, verified: 1310, recognition: 85 },
  { district: 'Kanpur', totalSchools: 5220, govt: 2200, aided: 1050, private: 1680, students: 945000, teachers: 30200, verified: 1580, recognition: 91 },
  { district: 'Prayagraj', totalSchools: 3990, govt: 1980, aided: 640, private: 920, students: 698000, teachers: 21400, verified: 1090, recognition: 78 },
  { district: 'Meerut', totalSchools: 4100, govt: 1750, aided: 810, private: 1320, students: 756000, teachers: 23800, verified: 1250, recognition: 84 },
  { district: 'Gorakhpur', totalSchools: 4550, govt: 2600, aided: 550, private: 780, students: 682000, teachers: 20900, verified: 980, recognition: 76 },
  { district: 'Aligarh', totalSchools: 3600, govt: 1680, aided: 690, private: 890, students: 612000, teachers: 19200, verified: 920, recognition: 74 },
  { district: 'Bareilly', totalSchools: 4100, govt: 1920, aided: 760, private: 1010, students: 734000, teachers: 22800, verified: 1150, recognition: 80 },
  { district: 'Mathura', totalSchools: 3020, govt: 1540, aided: 480, private: 720, students: 498000, teachers: 15600, verified: 780, recognition: 71 },
];

export const MANAGEMENT_PERFORMANCE = [
  { type: 'Government', score: 52, fill: '#1B2A6B' },
  { type: 'Aided', score: 58, fill: '#F5B731' },
  { type: 'Private', score: 62, fill: '#F97316' },
];

export const LEVEL_PERFORMANCE = [
  { level: 'Primary', score: 51 },
  { level: 'Upper Primary', score: 55 },
  { level: 'Secondary', score: 59 },
  { level: 'Higher Secondary', score: 63 },
];

export const DISTRICT_RANKINGS = [
  { district: 'Lucknow', score: 63.1 },
  { district: 'Kanpur', score: 61.4 },
  { district: 'Prayagraj', score: 59.8 },
  { district: 'Agra', score: 58.2 },
  { district: 'Meerut', score: 57.5 },
  { district: 'Varanasi', score: 56.9 },
  { district: 'Aligarh', score: 55.3 },
  { district: 'Bareilly', score: 54.7 },
  { district: 'Mathura', score: 52.1 },
  { district: 'Gorakhpur', score: 50.8 },
];

function seededScore(district: string, mgmt: string): number {
  const seed = district.length * 7 + mgmt.length * 11;
  return 35 + (seed % 45);
}

export function getHeatmapData(): {
  district: District;
  scores: Record<SchoolType, number>;
}[] {
  return DISTRICTS.map((district) => ({
    district,
    scores: {
      Government: seededScore(district, 'Government'),
      Aided: seededScore(district, 'Aided'),
      Private: seededScore(district, 'Private'),
    },
  }));
}

export function getTopSchoolsByDistrict(): {
  district: District;
  avgScore: number;
  schools: {
    rank: number;
    name: string;
    type: SchoolType;
    level: SchoolLevel;
    score: number;
  }[];
}[] {
  return DISTRICTS.map((district) => {
    const districtSchools = SCHOOLS.filter((s) => s.district === district)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3);
    const fallback = [
      {
        rank: 1,
        name: `${district} Model School`,
        type: 'Government' as SchoolType,
        level: 'Secondary' as SchoolLevel,
        score: 72,
      },
      {
        rank: 2,
        name: `${district} Public Academy`,
        type: 'Private' as SchoolType,
        level: 'Higher Secondary' as SchoolLevel,
        score: 68,
      },
      {
        rank: 3,
        name: `${district} Aided High School`,
        type: 'Aided' as SchoolType,
        level: 'Upper Primary' as SchoolLevel,
        score: 61,
      },
    ];
    const schools =
      districtSchools.length >= 3
        ? districtSchools.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            type: s.type,
            level: s.level,
            score: s.overallScore,
          }))
        : fallback;
    const avgScore =
      DISTRICT_RANKINGS.find((d) => d.district === district)?.score ?? 54;
    return { district, avgScore, schools };
  });
}

export const STATE_AVG = 54.2;

export function scoreToStars(score: number): number {
  if (score >= 75) return 5;
  if (score >= 65) return 4;
  if (score >= 55) return 3;
  if (score >= 45) return 2;
  return 1;
}

export function heatmapCellColor(score: number): string {
  if (score < 40) return '#F9A8D4';
  if (score <= 70) return '#FDE68A';
  return '#86EFAC';
}

export const COMPARE_SCHOOL_COLORS = ['#1B2A6B', '#22C55E', '#F5B731', '#F97316'] as const;

/* ── Mandals (18 administrative divisions) — illustrative, pending UDISE+ import ──
   District groupings are based on general knowledge of UP's mandal structure, not a
   verified live source; confirm against the official list before relying on this data. */
export type Mandal = {
  code: string;
  name: string;
  districts: string[];
};

export const MANDALS: Mandal[] = [
  { code: 'agra', name: 'Agra', districts: ['Agra', 'Firozabad', 'Mainpuri', 'Mathura'] },
  { code: 'aligarh', name: 'Aligarh', districts: ['Aligarh', 'Etah', 'Hathras', 'Kasganj'] },
  { code: 'azamgarh', name: 'Azamgarh', districts: ['Azamgarh', 'Ballia', 'Mau'] },
  { code: 'bareilly', name: 'Bareilly', districts: ['Bareilly', 'Badaun', 'Pilibhit', 'Shahjahanpur'] },
  { code: 'basti', name: 'Basti', districts: ['Basti', 'Sant Kabir Nagar', 'Siddharthnagar'] },
  { code: 'chitrakoot', name: 'Chitrakoot', districts: ['Banda', 'Chitrakoot', 'Hamirpur', 'Mahoba'] },
  { code: 'devipatan', name: 'Devipatan', districts: ['Balrampur', 'Bahraich', 'Gonda', 'Shrawasti'] },
  { code: 'faizabad', name: 'Ayodhya (Faizabad)', districts: ['Ayodhya', 'Ambedkar Nagar', 'Amethi', 'Barabanki', 'Sultanpur'] },
  { code: 'gorakhpur', name: 'Gorakhpur', districts: ['Deoria', 'Gorakhpur', 'Kushinagar', 'Maharajganj'] },
  { code: 'jhansi', name: 'Jhansi', districts: ['Jalaun', 'Jhansi', 'Lalitpur'] },
  { code: 'kanpur', name: 'Kanpur', districts: ['Auraiya', 'Etawah', 'Farrukhabad', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar'] },
  { code: 'lucknow', name: 'Lucknow', districts: ['Hardoi', 'Lakhimpur Kheri', 'Lucknow', 'Raebareli', 'Sitapur', 'Unnao'] },
  { code: 'meerut', name: 'Meerut', districts: ['Baghpat', 'Bulandshahr', 'Gautam Buddha Nagar', 'Ghaziabad', 'Hapur', 'Meerut'] },
  { code: 'mirzapur', name: 'Mirzapur (Vindhyachal)', districts: ['Bhadohi', 'Mirzapur', 'Sonbhadra'] },
  { code: 'moradabad', name: 'Moradabad', districts: ['Amroha', 'Bijnor', 'Moradabad', 'Rampur', 'Sambhal'] },
  { code: 'prayagraj', name: 'Prayagraj', districts: ['Fatehpur', 'Kaushambi', 'Prayagraj', 'Pratapgarh'] },
  { code: 'saharanpur', name: 'Saharanpur', districts: ['Muzaffarnagar', 'Saharanpur', 'Shamli'] },
  { code: 'varanasi', name: 'Varanasi', districts: ['Chandauli', 'Ghazipur', 'Jaunpur', 'Varanasi'] },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 1000000007;
  }
  return Math.abs(h);
}

export type SqaafStats = {
  district: string;
  totalSchools: number;
  govt: number;
  aided: number;
  private: number;
  students: number;
  teachers: number;
  verified: number;
  recognition: number;
};

/** Returns the curated row for sample districts, or a deterministic (non-random,
 * stable across renders) estimate for every other district. */
export function districtSqaafStats(district: string): SqaafStats {
  const curated = SQAAF_DISTRICT_TABLE.find((r) => r.district === district);
  if (curated) return curated;

  const seed = hashString(district);
  const totalSchools = 1800 + (seed % 3200);
  const govt = Math.round(totalSchools * (0.42 + ((seed % 17) / 100)));
  const aided = Math.round(totalSchools * (0.14 + ((seed % 11) / 100)));
  const priv = Math.round(totalSchools * (0.16 + ((seed % 13) / 100)));
  const students = totalSchools * (140 + (seed % 60));
  const teachers = Math.round(students / (28 + (seed % 10)));
  const recognition = 60 + (seed % 30);
  const verified = Math.round(totalSchools * (recognition / 100) * 0.55);
  return { district, totalSchools, govt, aided, private: priv, students, teachers, verified, recognition };
}

export function mandalSqaafStats(mandal: Mandal) {
  const rows = mandal.districts.map(districtSqaafStats);
  const totalSchools = rows.reduce((a, r) => a + r.totalSchools, 0);
  const govt = rows.reduce((a, r) => a + r.govt, 0);
  const aided = rows.reduce((a, r) => a + r.aided, 0);
  const priv = rows.reduce((a, r) => a + r.private, 0);
  const students = rows.reduce((a, r) => a + r.students, 0);
  const teachers = rows.reduce((a, r) => a + r.teachers, 0);
  const verified = rows.reduce((a, r) => a + r.verified, 0);
  const recognition = totalSchools > 0 ? Math.round((verified / totalSchools) * 100) : 0;
  return {
    code: mandal.code,
    name: mandal.name,
    districtCount: mandal.districts.length,
    totalSchools,
    govt,
    aided,
    private: priv,
    students,
    teachers,
    verified,
    recognition,
  };
}

/** Domain-wise averages for a district; deterministic offset from the state
 * baseline so the chart visibly changes per selection without real per-district
 * domain data (pending UDISE+ / SQAAF import). */
export function domainAveragesForDistrict(district: string) {
  if (district === 'All Districts') return DOMAIN_AVERAGES;
  return DOMAIN_AVERAGES.map(({ domain, score }) => {
    const offset = (hashString(district + domain) % 21) - 10;
    return { domain, score: Math.max(30, Math.min(95, score + offset)) };
  });
}

export function performanceDistributionForDistrict(district: string) {
  if (district === 'All Districts') return PERFORMANCE_DISTRIBUTION;
  const domains = domainAveragesForDistrict(district);
  const avg = domains.reduce((a, d) => a + d.score, 0) / domains.length;
  const baseAvg = DOMAIN_AVERAGES.reduce((a, d) => a + d.score, 0) / DOMAIN_AVERAGES.length;
  const delta = avg - baseAvg;
  const utkarsh = Math.max(5, Math.min(70, Math.round(32 + delta)));
  const uday = Math.max(5, Math.min(70, Math.round(28 - delta)));
  const unnat = Math.max(10, 100 - utkarsh - uday);
  return [
    { name: 'Uday' as PerformanceLevel, value: uday, fill: '#F9A8D4' },
    { name: 'Unnat' as PerformanceLevel, value: unnat, fill: '#FDE68A' },
    { name: 'Utkarsh' as PerformanceLevel, value: utkarsh, fill: '#86EFAC' },
  ];
}
