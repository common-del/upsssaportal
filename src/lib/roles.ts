/**
 * Every role the portal recognises, in one place.
 *
 * `User.role` is a plain String in the database with no enum and no check constraint, and
 * the codebase had accumulated several spellings for the same role — SSSA_ADMIN beside
 * admin, SCHOOL beside SCHOOL_USER, DISTRICT_OFFICIAL beside DISTRICT_ADMIN — each
 * compared against by hand in a different file. A typo when creating a user therefore
 * granted or denied the wrong access with nothing raising an error.
 *
 * The SQAAF verification pipeline adds four more roles and the brief requires their
 * separation to be enforced at the data-access layer rather than in the interface. That
 * is not safe to attempt while the set of legal values is a matter of opinion, so this
 * file is the single source of truth: the canonical list, the legacy spellings that must
 * keep working against existing rows, and one function to normalise anything read from
 * the database before it is compared.
 */

/** The canonical roles. Anything stored should be one of these. */
export const ROLES = [
  'SSSA_ADMIN',
  'DISTRICT_OFFICIAL',
  'SCHOOL',
  // Verification pipeline. VERIFIER predates the online/field split and is kept because
  // existing rows and existing assignments use it; treat it as an unspecialised verifier.
  'VERIFIER',
  'ONLINE_VERIFIER',
  'ONGROUND_VERIFIER',
  'SUPERVISOR',
  'AUDIT_CELL',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Spellings that exist in the database and must keep resolving. Kept as a map rather than
 * scattered `||` comparisons so a new alias is added once and every check sees it.
 */
const ALIASES: Record<string, Role> = {
  admin: 'SSSA_ADMIN',
  ADMIN: 'SSSA_ADMIN',
  SCHOOL_USER: 'SCHOOL',
  DISTRICT_ADMIN: 'DISTRICT_OFFICIAL',
};

/** Null when the value is not a role at all, so a caller cannot accidentally treat an
 *  unrecognised string as a valid one. */
export function normaliseRole(value: string | null | undefined): Role | null {
  if (!value) return null;
  if ((ROLES as readonly string[]).includes(value)) return value as Role;
  return ALIASES[value] ?? null;
}

export function isRole(value: string | null | undefined, ...allowed: Role[]): boolean {
  const role = normaliseRole(value);
  return role !== null && allowed.includes(role);
}

/** Roles that carry out verification work and therefore need a VerifierProfile. */
export const VERIFIER_ROLES: readonly Role[] = [
  'VERIFIER',
  'ONLINE_VERIFIER',
  'ONGROUND_VERIFIER',
  'SUPERVISOR',
  'AUDIT_CELL',
];

export function needsVerifierProfile(value: string | null | undefined): boolean {
  const role = normaliseRole(value);
  return role !== null && VERIFIER_ROLES.includes(role);
}

/** Whether a role may edit ProgrammeConfig or the risk rubric. The terms of reference are
 *  explicit that verifiers apply the rubric without modifying weights, thresholds or
 *  decision rules, so this is deliberately only SSSA PMU. */
export function canEditProgrammeConfig(value: string | null | undefined): boolean {
  return isRole(value, 'SSSA_ADMIN');
}

export const ROLE_LABELS: Record<Role, string> = {
  SSSA_ADMIN: 'SSSA PMU',
  DISTRICT_OFFICIAL: 'District',
  SCHOOL: 'School',
  VERIFIER: 'Verifier',
  ONLINE_VERIFIER: 'Online Verifier',
  ONGROUND_VERIFIER: 'On-Ground Verifier',
  SUPERVISOR: 'Supervisor',
  AUDIT_CELL: 'Audit Cell',
};
