import type { ScholarshipScheme } from '@prisma/client';

export const NAVY = '#1B2A6B';
export const YELLOW = '#F5B731';

export const GOVERNMENT_SCHOOL_TYPES = ['GOVT', 'GOVERNMENT'] as const;
export const FEE_DISCLOSURE_TYPES = ['PRIVATE', 'PRIVATE_AIDED', 'GOVT_AIDED', 'GOVERNMENT_AIDED'] as const;

export const SCHOLARSHIP_SCHEMES: ScholarshipScheme[] = [
  'MERIT',
  'EWS',
  'SPORTS',
  'SC_ST',
  'MINORITY',
  'DIFFERENTLY_ABLED',
];

export const SCHOLARSHIP_LABELS: Record<ScholarshipScheme, string> = {
  MERIT: 'Merit Scholarship',
  EWS: 'EWS Scholarship',
  SPORTS: 'Sports Scholarship',
  SC_ST: 'SC/ST Scholarship',
  MINORITY: 'Minority Scholarship',
  DIFFERENTLY_ABLED: 'Differently Abled Scholarship',
};

export const BASE_MANDATORY_DOCS = [
  'Fire Safety Certificate',
  'Building Safety Certificate',
  'SMC Constitution Order',
  'Sanitation & Drinking Water Certificate',
  'Boundary Wall & Playground Certificate',
] as const;

export const PRIVATE_MANDATORY_DOCS = ['RTE Compliance Certificate'] as const;

export type AssessmentStatus =
  | 'NOT_STARTED'
  | 'IN_DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED';

export function normalizeSchoolCategory(category: string) {
  return category.toUpperCase().replace(/\s+/g, '_');
}

export function isGovernmentSchool(category: string) {
  const c = normalizeSchoolCategory(category);
  return GOVERNMENT_SCHOOL_TYPES.includes(c as (typeof GOVERNMENT_SCHOOL_TYPES)[number]);
}

export function isFeeDisclosureEligible(category: string) {
  const c = normalizeSchoolCategory(category);
  return FEE_DISCLOSURE_TYPES.includes(c as (typeof FEE_DISCLOSURE_TYPES)[number]);
}

export function mandatoryDocTypesForSchool(category: string): string[] {
  const docs: string[] = [...BASE_MANDATORY_DOCS];
  if (!isGovernmentSchool(category)) {
    docs.push(...PRIVATE_MANDATORY_DOCS);
  }
  return docs;
}

export function schoolInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UP';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export function assessmentStatusLabel(status: AssessmentStatus) {
  const map: Record<AssessmentStatus, string> = {
    NOT_STARTED: 'Not Started',
    IN_DRAFT: 'In Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    VERIFIED: 'Verified',
  };
  return map[status];
}

export function assessmentStatusColor(status: AssessmentStatus) {
  const map: Record<AssessmentStatus, string> = {
    NOT_STARTED: 'bg-gray-100 text-gray-700',
    IN_DRAFT: 'bg-amber-100 text-amber-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    UNDER_REVIEW: 'bg-purple-100 text-purple-800',
    VERIFIED: 'bg-green-100 text-green-800',
  };
  return map[status];
}
