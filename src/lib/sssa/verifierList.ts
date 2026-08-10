import { prisma } from '@/lib/db';

/**
 * Every verifier in one row.
 *
 * These numbers were spread across three places that each held half the picture:
 * Verification's Verifiers tab knew the caseload, Appeals' By verifier tab knew
 * the appeal rate, and a page at /app/sssa/users/verifiers-by-district that
 * nothing linked to knew neither. All three linked to the same profile.
 *
 * Caseload and appeal rate describe the same person and answer one question
 * together — is this verifier working, and is their scoring holding up — so they
 * belong in one row. A verifier is also a user, and their profile already lives
 * under /app/sssa/users, which is why this is the page that keeps them.
 */

export type VerifierListRow = {
  id: string;
  name: string;
  districtCode: string | null;
  district: string | null;
  /** Schools on their plate, whether or not they have started. */
  assigned: number;
  /** Verifications they have submitted. */
  checked: number;
  capacity: number;
  /** Null below the sample floor: a rate over three verifications is noise. */
  appealRate: number | null;
  appealed: number;
  /** Appeals where at least one indicator went the school's way. */
  upheld: number;
};

/** Below this an appeal rate says more about the sample than the verifier, so it is
 *  withheld rather than shown with a caveat nobody reads. One appeal against three
 *  verifications is 33% and means nothing. */
const MIN_FOR_RATE = 20;
const DEFAULT_CAPACITY = 50;

export async function buildVerifierList(): Promise<VerifierListRow[]> {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });

  const [verifiers, assignments, completed, appeals, districts] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'VERIFIER', active: true },
      select: { id: true, name: true, username: true, districtCode: true, verifierCapacity: true },
    }),
    cycle
      ? prisma.verifierAssignment.findMany({
          where: { cycleId: cycle.id },
          select: { verifierUserId: true },
        })
      : Promise.resolve([]),
    cycle
      ? prisma.verificationSubmission.findMany({
          where: { cycleId: cycle.id, status: 'SUBMITTED' },
          select: { schoolUdise: true, verifierUserId: true },
        })
      : Promise.resolve([]),
    cycle
      ? prisma.appeal.findMany({
          where: { cycleId: cycle.id, status: { notIn: ['DRAFT'] } },
          select: { schoolUdise: true, items: { select: { decision: true } } },
        })
      : Promise.resolve([]),
    prisma.district.findMany({ select: { code: true, nameEn: true } }),
  ]);

  const districtName = new Map(districts.map((d) => [d.code, d.nameEn]));

  const assignedBy = new Map<string, number>();
  for (const a of assignments) {
    assignedBy.set(a.verifierUserId, (assignedBy.get(a.verifierUserId) ?? 0) + 1);
  }

  const checkedBy = new Map<string, number>();
  // Which verifier scored which school, so an appeal can be attributed to them.
  const verifierOfSchool = new Map<string, string>();
  for (const c of completed) {
    checkedBy.set(c.verifierUserId, (checkedBy.get(c.verifierUserId) ?? 0) + 1);
    verifierOfSchool.set(c.schoolUdise, c.verifierUserId);
  }

  const appealsBy = new Map<string, { appealed: number; upheld: number }>();
  for (const a of appeals) {
    const vid = verifierOfSchool.get(a.schoolUdise);
    if (!vid) continue;
    const cur = appealsBy.get(vid) ?? { appealed: 0, upheld: 0 };
    cur.appealed += 1;
    // Upheld means the school was right about something, so any accepted
    // indicator counts — the appeal did not have to succeed on all of them.
    if (a.items.some((i) => i.decision === 'ACCEPT_SCHOOL')) cur.upheld += 1;
    appealsBy.set(vid, cur);
  }

  return verifiers
    .map((v) => {
      const checked = checkedBy.get(v.id) ?? 0;
      const a = appealsBy.get(v.id) ?? { appealed: 0, upheld: 0 };
      return {
        id: v.id,
        name: v.name ?? v.username,
        districtCode: v.districtCode,
        district: v.districtCode ? (districtName.get(v.districtCode) ?? null) : null,
        assigned: assignedBy.get(v.id) ?? 0,
        checked,
        capacity: v.verifierCapacity ?? DEFAULT_CAPACITY,
        appealRate: checked >= MIN_FOR_RATE ? a.appealed / checked : null,
        appealed: a.appealed,
        upheld: a.upheld,
      };
    })
    // Busiest first. The old list put the emptiest at the top to answer "who has
    // room", but assignment no longer happens here — the picker on Verification
    // shows each verifier's load at the point of choosing. What this list is for
    // is spotting whose scoring is being contested, and that needs the people
    // carrying real caseloads at the top.
    .sort((a, b) => b.checked - a.checked || a.name.localeCompare(b.name));
}
