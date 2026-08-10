import { prisma } from '@/lib/db';

/**
 * Whether a school's assessment has actually been checked by a verifier.
 *
 * This replaces a derived value that was never real. `deriveResultFields` used to
 * return `accreditation: h % 3 === 0 ? 'SQAAF Verified' : 'Pending'`, where `h` was a
 * hash of the UDISE number — so roughly a third of the register carried a public
 * "SQAAF Verified" badge decided by arithmetic on its own code, and schools that had
 * genuinely been verified were labelled Pending just as arbitrarily. It appeared on
 * the school profile, the public directory and the search results.
 *
 * The truth is a submitted VerificationSubmission. A Result row with a verifier score
 * would usually agree, but not always — the result is written by a separate step, so
 * a school could be checked and briefly have no Result. The submission is the event.
 *
 * Read on the server only. Any client component that needs this takes it as a prop,
 * so nothing can be tempted to derive it again.
 */

export type VerifiedState = {
  verified: boolean;
  /** ISO date of the verification, when there is one. */
  verifiedOn: string | null;
};

export const UNVERIFIED: VerifiedState = { verified: false, verifiedOn: null };

/** One school. Returns UNVERIFIED rather than throwing if there is no active cycle. */
export async function verifiedStateFor(udise: string): Promise<VerifiedState> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return UNVERIFIED;

  const submission = await prisma.verificationSubmission.findFirst({
    where: { cycleId: cycle.id, schoolUdise: udise, status: 'SUBMITTED' },
    select: { submittedAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!submission) return UNVERIFIED;

  const when = submission.submittedAt ?? submission.updatedAt;
  return { verified: true, verifiedOn: when ? when.toISOString() : null };
}

/**
 * Many schools at once, for a list. Takes the UDISEs on the page rather than loading
 * the whole table: a directory page shows a few dozen rows out of ~32,000.
 */
export async function verifiedUdises(udises: string[]): Promise<Set<string>> {
  if (udises.length === 0) return new Set();

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return new Set();

  const rows = await prisma.verificationSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED', schoolUdise: { in: udises } },
    select: { schoolUdise: true },
  });
  return new Set(rows.map((r) => r.schoolUdise));
}
