import { prisma } from '@/lib/db';

/**
 * Appeals filed against inspections this field verifier signed off.
 *
 * The order of events is fixed by the pipeline: a school can appeal only after a field visit is
 * signed off and the result published, so nothing here can exist while a visit is still open, and
 * nothing here is shown inside the visit workspace. This is the after-the-fact record: the
 * verifier learns which of their calls a school contested and how the SSSA ruled, and can change
 * none of it. Deciding appeals is the SSSA's Decisions page.
 *
 * Not a server action on purpose. It is read by the verifier's own overview page, which resolves
 * the profile from the session; exposing it as an HTTP endpoint would add a public surface for a
 * screen that already has its data.
 */

export type InspectionAppealItem = {
  code: string;
  titleEn: string;
  decision: 'PENDING' | 'ACCEPT_SCHOOL' | 'KEEP_VERIFIER';
};

export type InspectionAppeal = {
  schoolName: string;
  schoolUdise: string;
  districtName: string;
  /** When this verifier signed off the visit the appeal contests. */
  inspectedOn: string;
  filedOn: string;
  decidedOn: string | null;
  status: 'SUBMITTED' | 'DECIDED';
  items: InspectionAppealItem[];
  /** Of the decided items, how many kept the verifier's level. */
  keptCount: number;
  revisedCount: number;
};

export async function getAppealsOnMyInspections(profileId: string): Promise<InspectionAppeal[]> {
  const visits = await prisma.fieldVisit.findMany({
    where: { profileId, signedOffAt: { not: null }, recusedAt: null },
    select: { signedOffAt: true, run: { select: { cycleId: true, schoolUdise: true } } },
  });
  if (visits.length === 0) return [];

  const signedOffBy = new Map<string, Date>();
  const udisesByCycle = new Map<string, Set<string>>();
  for (const v of visits) {
    signedOffBy.set(`${v.run.cycleId}:${v.run.schoolUdise}`, v.signedOffAt!);
    const set = udisesByCycle.get(v.run.cycleId) ?? new Set<string>();
    set.add(v.run.schoolUdise);
    udisesByCycle.set(v.run.cycleId, set);
  }

  // Drafts stay invisible: until a school submits, there is no appeal, only a form it may yet
  // abandon, and showing it would tip the verifier off to a contest that never happens.
  const appeals = await prisma.appeal.findMany({
    where: {
      status: { in: ['SUBMITTED', 'DECIDED'] },
      OR: [...udisesByCycle.entries()].map(([cycleId, udises]) => ({
        cycleId,
        schoolUdise: { in: [...udises] },
      })),
    },
    select: {
      cycleId: true,
      schoolUdise: true,
      status: true,
      submittedAt: true,
      decidedAt: true,
      school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
      items: {
        select: {
          decision: true,
          parameter: { select: { code: true, titleEn: true } },
        },
      },
    },
  });

  return appeals
    .map((a) => {
      const items: InspectionAppealItem[] = a.items.map((i) => ({
        code: i.parameter.code,
        titleEn: i.parameter.titleEn,
        decision: (i.decision === 'ACCEPT_SCHOOL' || i.decision === 'KEEP_VERIFIER'
          ? i.decision
          : 'PENDING') as InspectionAppealItem['decision'],
      }));
      return {
        schoolName: a.school.nameEn,
        schoolUdise: a.schoolUdise,
        districtName: a.school.district?.nameEn ?? '',
        inspectedOn: (signedOffBy.get(`${a.cycleId}:${a.schoolUdise}`) ?? new Date(0)).toISOString(),
        filedOn: (a.submittedAt ?? new Date(0)).toISOString(),
        decidedOn: a.decidedAt?.toISOString() ?? null,
        status: (a.status === 'DECIDED' ? 'DECIDED' : 'SUBMITTED') as InspectionAppeal['status'],
        items,
        keptCount: items.filter((i) => i.decision === 'KEEP_VERIFIER').length,
        revisedCount: items.filter((i) => i.decision === 'ACCEPT_SCHOOL').length,
      };
    })
    // Waiting ones first, then newest filed first: the pending appeal is the one the verifier
    // has not heard the end of.
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === 'SUBMITTED'
          ? -1
          : 1
        : b.filedOn.localeCompare(a.filedOn),
    );
}

/** The sidebar badge: appeals against this verifier's inspections still waiting on the SSSA. */
export async function countWaitingAppealsOnMyInspections(profileId: string): Promise<number> {
  const visits = await prisma.fieldVisit.findMany({
    where: { profileId, signedOffAt: { not: null }, recusedAt: null },
    select: { run: { select: { cycleId: true, schoolUdise: true } } },
  });
  if (visits.length === 0) return 0;
  const udisesByCycle = new Map<string, Set<string>>();
  for (const v of visits) {
    const set = udisesByCycle.get(v.run.cycleId) ?? new Set<string>();
    set.add(v.run.schoolUdise);
    udisesByCycle.set(v.run.cycleId, set);
  }
  return prisma.appeal.count({
    where: {
      status: 'SUBMITTED',
      OR: [...udisesByCycle.entries()].map(([cycleId, udises]) => ({
        cycleId,
        schoolUdise: { in: [...udises] },
      })),
    },
  });
}
