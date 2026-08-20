import { auth } from '@/lib/auth';
import { normaliseRole, type Role } from '@/lib/roles';

/**
 * Authorization for server actions, read from the session and never from an argument.
 *
 * Server actions are public HTTP endpoints. Middleware is not enough on its own: it
 * matches on path, it only role-gates two prefixes, and any signed-in user of any role
 * clears the rest. Seven action files here read no session at all, and `users.ts` took the
 * caller's own role as a parameter which the pages then handed to client components as a
 * prop, so the claim round-tripped through the browser.
 *
 * The rule these helpers exist to make cheap: every exported action begins by asking the
 * session who is calling, and refuses if the answer is not a role allowed to do it. An
 * action that skips this is reachable by anyone with any account.
 */

export type Actor = {
  userId: string;
  role: Role;
  /** The username. For a SCHOOL account this is the school's UDISE code. */
  username: string;
  districtCode: string | null;
};

/** The shape every guarded action returns on refusal, so callers can render it. */
export type Denied = { error: string };

export const DENIED: Denied = { error: 'Not authorised.' };

/** Null when there is no session at all. */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user) return null;

  const role = normaliseRole(session.user.role as string | undefined);
  const userId = session.user.id as string | undefined;
  const username = session.user.name as string | undefined;
  if (!role || !userId || !username) return null;

  return {
    userId,
    role,
    username,
    districtCode: (session.user as { districtCode?: string | null }).districtCode ?? null,
  };
}

/**
 * Null unless the caller holds one of `allowed`.
 *
 * Deliberately returns null rather than throwing. A thrown error inside a server action
 * surfaces to the browser as an unhandled digest and tells the caller something exists;
 * a null lets the action return its own refusal shape and say nothing more.
 */
export async function requireRole(...allowed: Role[]): Promise<Actor | null> {
  const actor = await currentActor();
  if (!actor) return null;
  return allowed.includes(actor.role) ? actor : null;
}

/**
 * A school acting on its own records. Returns the UDISE from the session, so an action can
 * never be pointed at another school by passing a different one in.
 */
export async function requireSchool(): Promise<(Actor & { schoolUdise: string }) | null> {
  const actor = await requireRole('SCHOOL');
  if (!actor) return null;
  return { ...actor, schoolUdise: actor.username };
}

/** SSSA PMU only: configuration, the risk rubric, cohort build, publication. */
export async function requireSssa(): Promise<Actor | null> {
  return requireRole('SSSA_ADMIN');
}

/** Anyone who does verification work, of any cell. Individual actions still have to scope
 *  to the caller's own assignment; this only establishes that they are a verifier. */
export async function requireVerifier(): Promise<Actor | null> {
  return requireRole(
    'VERIFIER',
    'ONLINE_VERIFIER',
    'ONGROUND_VERIFIER',
    'SUPERVISOR',
    'AUDIT_CELL',
  );
}

/** Officials who may read across schools: SSSA PMU, a district official, or a supervisor. */
export async function requireOversight(): Promise<Actor | null> {
  return requireRole('SSSA_ADMIN', 'DISTRICT_OFFICIAL', 'SUPERVISOR');
}

/**
 * A school reading its own record, or an official reading across schools.
 *
 * Several read actions legitimately serve both: a school opening its self-assessment form
 * and an officer looking at that school's progress want the same query. Callers that then
 * key off a UDISE argument still have to check it against `schoolUdise` when the actor is
 * a school, which is why that field is returned rather than just a boolean.
 */
export async function requireSchoolOrOversight(): Promise<
  (Actor & { schoolUdise: string | null }) | null
> {
  const actor = await requireRole(
    'SCHOOL',
    'SSSA_ADMIN',
    'DISTRICT_OFFICIAL',
    'SUPERVISOR',
    'VERIFIER',
    'ONLINE_VERIFIER',
    'ONGROUND_VERIFIER',
  );
  if (!actor) return null;
  return { ...actor, schoolUdise: actor.role === 'SCHOOL' ? actor.username : null };
}
