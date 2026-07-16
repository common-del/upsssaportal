export const UP_SQAAF_OVERVIEW =
  'UP-SQAAF is the State\'s reference framework for evaluating school quality across 5 key Domains, broken down into sub-domains and performance indicators. Each indicator is rated on a 3-level performance scale: Uday, Unnat, and Utkarsh, backed by supportive documentation. Self-reporting by schools is verified through external evaluation, with weighted domain scoring producing the overall school score.';

export const PERFORMANCE_LEVELS = [
  {
    key: 'Uday',
    range: '0 to 50%',
    description:
      'Foundational stage. School meets basic compliance but needs significant improvement across most indicators.',
    bgClass: 'bg-red-600',
    textClass: 'text-white',
  },
  {
    key: 'Unnat',
    range: '51% to 75%',
    description:
      'Developing stage. School demonstrates steady progress with overall strong areas and identifiable gaps.',
    bgClass: 'bg-[#F5B731]',
    textClass: 'text-[#1B2A6B]',
  },
  {
    key: 'Utkarsh',
    range: '76% to 100%',
    description:
      'Advanced stage. School performs at an exemplary level and can serve as a model for others.',
    bgClass: 'bg-green-600',
    textClass: 'text-white',
  },
] as const;

export const DOMAIN_WEIGHTAGES = [
  { order: 1, name: 'Infrastructure & Safety of Students', weightage: 15 },
  { order: 2, name: 'Administration: Human Resources & Leadership', weightage: 15 },
  { order: 3, name: 'Teaching & Learning Pedagogy: Curriculum Transaction', weightage: 20 },
  { order: 4, name: 'Assessment: Learning Outcomes', weightage: 40 },
  { order: 5, name: 'Inclusiveness: Student Well-being and Community Participation', weightage: 10 },
] as const;

export const FRAMEWORK_DOMAINS = [
  {
    id: '1',
    name: 'Infrastructure & Safety of Students',
    subDomains: [
      { code: '1.1', name: 'Physical Infrastructure' },
      { code: '1.2', name: 'Safety & Security of Students' },
    ],
  },
  {
    id: '2',
    name: 'Administration: Human Resources & Leadership',
    subDomains: [
      { code: '2.1', name: 'Staffing Adequacy' },
      { code: '2.2', name: 'School Leadership Quality' },
    ],
  },
  {
    id: '3',
    name: 'Teaching & Learning Pedagogy: Curriculum Transaction',
    subDomains: [
      { code: '3.1', name: 'Curriculum & Instruction' },
      { code: '3.2', name: 'Classroom Teaching Processes' },
      { code: '3.3', name: 'Co-curricular Activities' },
    ],
  },
  {
    id: '4',
    name: 'Assessment: Learning Outcomes',
    subDomains: [
      { code: '4.1', name: 'Classroom Assessment Processes' },
      { code: '4.2', name: 'Academic Outcomes' },
    ],
  },
  {
    id: '5',
    name: 'Inclusiveness: Student Well-being and Community Participation',
    subDomains: [
      { code: '5.1', name: 'Mental and Physical Well-being of Students' },
      { code: '5.2', name: 'Parent & Community Engagement' },
    ],
  },
] as const;

/** Chart labels (shorter) */
export const DOMAIN_CHART_LABELS = [
  'Infrastructure & Safety of Students',
  'Administration / HR & Leadership',
  'Teaching & Learning Pedagogy',
  'Assessment / Learning Outcomes',
  'Inclusiveness / Student Well-being',
] as const;

export const INFRASTRUCTURE_GAPS = [
  'NO SMART CLASSROOMS',
  'NO INTERNET CONNECTIVITY',
  'NO LIBRARY FACILITY',
  'NO PLAYGROUND / SPORTS FACILITY',
  'NO SAFE DRINKING WATER',
  'NO FUNCTIONAL GIRLS TOILETS',
  'INADEQUATE CLASSROOMS',
] as const;

export const DISPUTE_CATEGORIES_CHART = [
  'Evidence Mismatch',
  'Evidence Not Considered',
  'Clarification Needed',
  'Documentation Conflict',
  'Procedural',
  'Misreporting by School',
] as const;

export const DISPUTE_CATEGORIES_TABLE = [
  'Evidence mismatch',
  'Score mismatch',
  'Missing documents',
  'Evaluator observation conflict',
  'Infrastructure claim mismatch',
] as const;

export const WORKFLOW_STAGES = [
  { key: 'submitted', label: 'Submitted Self Evaluation', color: '#3B82F6' },
  { key: 'under_review', label: 'Under External Review', color: '#14B8A6' },
  { key: 'inconsistencies', label: 'Inconsistencies Found in External Evaluation', color: '#EF4444' },
  { key: 'draft', label: 'Draft', color: '#A855F7' },
  { key: 'verified', label: 'Verified', color: '#10B981' },
  { key: 'not_started', label: 'Not Started', color: '#9CA3AF' },
] as const;
