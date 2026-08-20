import { createHmac } from 'crypto';

/**
 * The audit draw: which already-published verifications get independently re-checked.
 *
 * The same adversarial requirements as the student spot check, one step up the ladder. A
 * field verifier who can predict which of their visits will be audited behaves differently
 * on exactly those visits, which defeats the audit; an Audit Cell that can steer the draw
 * can shield a colleague; and the SSSA must be able to re-derive the sample later to prove
 * the draw was what it claims to have been.
 *
 * So the draw is a pure function of a seed and the candidate list, keyed on the server
 * secret: every candidate id is HMACed, the candidates are ranked by digest, and the top
 * share is the sample. Deterministic given the same candidates, unpredictable without the
 * secret, and independent of the order the candidates arrive in.
 *
 * The percentage and basis come from configuration because the source documents disagree:
 * the flowchart says 1% per district, the terms of reference say 3% to 5%. PER_DISTRICT
 * applies the share inside each district so no district escapes coverage; STATEWIDE ranks
 * the whole state as one pool.
 */

function rank(seed: string, id: string, secret: string): string {
  return createHmac('sha256', secret).update(`${seed}:${id}`).digest('hex');
}

/**
 * Deterministically pick `count` ids: rank every candidate by keyed digest and take the top.
 * Also used by the supervisor's weekly quality sampler, which wants a fixed count rather
 * than a share but the same properties: stable, order-independent, unsteerable.
 */
export function seededPick(seed: string, candidateIds: string[], count: number): string[] {
  if (candidateIds.length === 0 || count <= 0) return [];
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fails closed, like the masking and the spot check. A predictable sample is worse
    // than none: it looks like oversight while being arrangeable in advance.
    throw new Error(
      'Cannot draw a sample: AUTH_SECRET is not set, and an unkeyed draw would be predictable.',
    );
  }
  return [...candidateIds]
    .sort((a, b) => rank(seed, a, secret).localeCompare(rank(seed, b, secret)))
    .slice(0, Math.min(count, candidateIds.length));
}

/**
 * Deterministically pick `percentage`% of `candidateIds`, at least one when the pool is
 * non-empty and the percentage is above zero. Ceiling rather than rounding, because an
 * audit share that silently becomes zero for a small district is a district with no audit.
 */
export function drawAuditSample(seed: string, candidateIds: string[], percentage: number): string[] {
  if (candidateIds.length === 0 || percentage <= 0) return [];
  return seededPick(seed, candidateIds, Math.ceil((candidateIds.length * percentage) / 100));
}

/**
 * Group candidates and draw inside each group, for PER_DISTRICT mode. Each group gets its
 * own seed so adding a district never reshuffles another district's draw.
 */
export function drawGroupedSample(
  seedPrefix: string,
  groups: Map<string, string[]>,
  percentage: number,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, ids] of groups) {
    out.set(key, drawAuditSample(`${seedPrefix}:${key}`, ids, percentage));
  }
  return out;
}

/**
 * How one audit compares with the primary record, computed at submission.
 *
 * Counted, not judged: this reports on how many re-checked indicators the auditor's level
 * differs from the primary verifier's, and the human reconciliation decides what those
 * numbers prove. Indicators the auditor re-checked but the primary never recorded cannot
 * contradict anything and are excluded from both counts.
 */
export function compareAuditToPrimary(
  auditLevels: Map<string, number>,
  primaryLevels: Map<string, number>,
): { findingCount: number; contradictionCount: number } {
  let findingCount = 0;
  let contradictionCount = 0;
  for (const [parameterId, auditLevel] of auditLevels) {
    const primary = primaryLevels.get(parameterId);
    if (primary === undefined) continue;
    findingCount += 1;
    if (auditLevel !== primary) contradictionCount += 1;
  }
  return { findingCount, contradictionCount };
}
