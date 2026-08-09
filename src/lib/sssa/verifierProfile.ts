import { prisma } from '@/lib/db';

/**
 * Everything about one verifier, gathered for their profile page.
 *
 * The numbers that matter here are not "how many schools do they hold" — that is
 * on every list already — but how their marking compares with everyone else's and
 * how long schools wait on them. Both are computable from data the portal already
 * has, and neither appears anywhere in the product today.
 */

export type ProfileSchool = {
  udise: string;
  name: string;
  block: string;
  status: 'Verified' | 'In progress' | 'Waiting';
  daysWaiting: number | null;
  score: number | null;
};

export type VerifierProfile = {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
  mobile: string | null;
  email: string | null;
  photoUrl: string | null;
  districts: string[];
  joined: Date;
  cyclesWorked: number;

  capacity: number | null;
  assigned: number;
  verified: number;
  queue: number;
  oldestWaitDays: number | null;
  /** Mean days from assignment to a completed verification. Null until they have
   *  finished at least one, because an average of nothing is not zero. */
  avgDaysToVerify: number | null;
  /** Mean (verifier score − school self-score) across their completed
   *  verifications. Negative means they mark below what schools claim. */
  avgGap: number | null;
  gapSample: number;
  appealed: number;
  upheld: number;

  schools: ProfileSchool[];
};

/** Below this, a rate or an average says more about the sample than the person. */
const MIN_SAMPLE = 5;
const SCHOOL_LIMIT = 25;

export async function buildVerifierProfile(userId: string): Promise<VerifierProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
      mobile: true,
      email: true,
      photoUrl: true,
      districtCode: true,
      verifierCapacity: true,
      createdAt: true,
      verifierDistricts: { select: { districtCode: true } },
    },
  });
  if (!user) return null;

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });

  // Districts come from two places: the single districtCode on the account and the
  // VerifierDistrict join for anyone covering more than one. Merged and de-duped so
  // a verifier listed in both does not appear twice.
  const districtCodes = [
    ...new Set(
      [user.districtCode, ...user.verifierDistricts.map((d) => d.districtCode)].filter(
        (c): c is string => !!c,
      ),
    ),
  ];
  const districtRows = districtCodes.length
    ? await prisma.district.findMany({
        where: { code: { in: districtCodes } },
        select: { nameEn: true },
      })
    : [];

  const base: VerifierProfile = {
    id: user.id,
    name: user.name ?? user.username,
    username: user.username,
    role: user.role,
    active: user.active,
    mobile: user.mobile,
    email: user.email,
    photoUrl: user.photoUrl,
    districts: districtRows.map((d) => d.nameEn),
    joined: user.createdAt,
    cyclesWorked: 0,
    capacity: user.verifierCapacity,
    assigned: 0,
    verified: 0,
    queue: 0,
    oldestWaitDays: null,
    avgDaysToVerify: null,
    avgGap: null,
    gapSample: 0,
    appealed: 0,
    upheld: 0,
    schools: [],
  };

  const [allAssignments, cyclesWorked] = await Promise.all([
    prisma.verifierAssignment.findMany({
      where: { verifierUserId: user.id, ...(cycle ? { cycleId: cycle.id } : {}) },
      select: {
        schoolUdise: true,
        createdAt: true,
        school: { select: { nameEn: true, block: { select: { nameEn: true } } } },
      },
    }),
    prisma.verifierAssignment
      .findMany({
        where: { verifierUserId: user.id },
        distinct: ['cycleId'],
        select: { cycleId: true },
      })
      .then((r) => r.length),
  ]);

  base.cyclesWorked = cyclesWorked;
  base.assigned = allAssignments.length;
  if (!cycle) return base;

  const udises = allAssignments.map((a) => a.schoolUdise);

  const [verifications, selfSubs, results, appeals] = await Promise.all([
    prisma.verificationSubmission.findMany({
      where: { cycleId: cycle.id, verifierUserId: user.id },
      select: { schoolUdise: true, status: true, submittedAt: true },
    }),
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: 'SUBMITTED' },
      select: { schoolUdise: true, submittedAt: true },
    }),
    prisma.result.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises } },
      select: { schoolUdise: true, selfScorePercent: true, verifierScorePercent: true },
    }),
    prisma.appeal.findMany({
      where: { cycleId: cycle.id, schoolUdise: { in: udises }, status: { notIn: ['DRAFT'] } },
      select: { schoolUdise: true, items: { select: { decision: true } } },
    }),
  ]);

  const doneBy = new Map(verifications.filter((v) => v.status === 'SUBMITTED').map((v) => [v.schoolUdise, v]));
  const startedSet = new Set(verifications.filter((v) => v.status !== 'SUBMITTED').map((v) => v.schoolUdise));
  const selfBy = new Map(selfSubs.map((s) => [s.schoolUdise, s]));
  const resultBy = new Map(results.map((r) => [r.schoolUdise, r]));
  const now = Date.now();

  base.verified = doneBy.size;
  base.queue = allAssignments.filter((a) => !doneBy.has(a.schoolUdise)).length;

  // Days to verify runs from when the school submitted, not from when the verifier
  // was assigned — a school does not care which of those happened first, and
  // measuring from assignment would let a late assignment hide a long wait.
  const durations: number[] = [];
  for (const [udise, v] of doneBy) {
    const self = selfBy.get(udise);
    if (!self?.submittedAt || !v.submittedAt) continue;
    durations.push(Math.max(0, (v.submittedAt.getTime() - self.submittedAt.getTime()) / 86_400_000));
  }
  base.avgDaysToVerify = durations.length
    ? Math.round((durations.reduce((a, d) => a + d, 0) / durations.length) * 10) / 10
    : null;

  const gaps: number[] = [];
  for (const r of results) {
    if (r.selfScorePercent == null || r.verifierScorePercent == null) continue;
    gaps.push(r.verifierScorePercent - r.selfScorePercent);
  }
  base.gapSample = gaps.length;
  base.avgGap =
    gaps.length >= MIN_SAMPLE
      ? Math.round((gaps.reduce((a, g) => a + g, 0) / gaps.length) * 10) / 10
      : null;

  base.appealed = appeals.length;
  base.upheld = appeals.filter((a) => a.items.some((i) => i.decision === 'ACCEPT_SCHOOL')).length;

  base.schools = allAssignments
    .map((a): ProfileSchool => {
      const done = doneBy.has(a.schoolUdise);
      const self = selfBy.get(a.schoolUdise);
      const waiting = !done && !!self?.submittedAt;
      return {
        udise: a.schoolUdise,
        name: a.school?.nameEn ?? a.schoolUdise,
        block: a.school?.block?.nameEn ?? '—',
        status: done ? 'Verified' : startedSet.has(a.schoolUdise) ? 'In progress' : 'Waiting',
        daysWaiting:
          waiting && self?.submittedAt
            ? Math.max(0, Math.floor((now - self.submittedAt.getTime()) / 86_400_000))
            : null,
        score: resultBy.get(a.schoolUdise)?.verifierScorePercent ?? null,
      };
    })
    // Longest wait first: the point of this list is finding what is stuck, and a
    // verified school is history.
    .sort((a, b) => (b.daysWaiting ?? -1) - (a.daysWaiting ?? -1));

  base.oldestWaitDays = base.schools[0]?.daysWaiting ?? null;
  base.schools = base.schools.slice(0, SCHOOL_LIMIT);

  return base;
}
