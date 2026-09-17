'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/authz';
import {
  eligibleFor,
  loadFieldVerifiers,
  openVisitCounts,
  placeReplacement,
} from '@/lib/verification/placement';

/**
 * Schools in this year's cohort with nobody going to them, and the two ways to fix that.
 *
 * This list is the counterpart to the recusal path. A school lands on it when the draw found
 * nobody eligible in its district, or when the verifier who was sent stood down and there was
 * nobody left to hand it to. Both were previously invisible: the draw reported a number once, in
 * a green box that vanished on the next page load, and a recusal reported nothing at all.
 *
 * Deliberately not paginated. If this list is long enough to need paging, the answer is not a
 * pager, it is that the field cell is too small for the cohort that was drawn, and that belongs
 * on the screen as a number rather than behind a next button.
 */

export type StrandedSchool = {
  runId: string;
  udise: string;
  schoolName: string;
  districtCode: string;
  districtName: string;
  blockName: string;
  /** What left it without anybody. */
  reason: 'STOOD_DOWN' | 'NEVER_ALLOCATED';
  /** Who stood down, and when, for the STOOD_DOWN case. */
  stoodDownBy: string | null;
  stoodDownAt: string | null;
  /** Verifiers who may take it now: rostered, certified, not excluded, and not one of the people
   *  who has already stood down from this school. */
  options: { profileId: string; name: string; openVisits: number }[];
};

export async function getStrandedSchools(): Promise<StrandedSchool[]> {
  if (!(await requireRole('SSSA_ADMIN'))) return [];

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!cycle) return [];

  const runs = await prisma.assessmentCycleRun.findMany({
    // In the cohort, and holding no visit that is still live. The second condition is the whole
    // definition of stranded: a run with only recused visits, or with none at all.
    where: {
      cycleId: cycle.id,
      state: 'FIELD_COHORT',
      fieldVisits: { none: { recusedAt: null } },
    },
    select: {
      id: true,
      school: {
        select: {
          udise: true,
          nameEn: true,
          districtCode: true,
          blockCode: true,
          block: { select: { nameEn: true } },
        },
      },
      fieldVisits: {
        orderBy: { recusedAt: 'desc' },
        select: {
          profileId: true,
          recusedAt: true,
          profile: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  if (runs.length === 0) return [];

  const districts = await prisma.district.findMany({ select: { code: true, nameEn: true } });
  const districtName = new Map(districts.map((d) => [d.code, d.nameEn]));

  const verifiers = await loadFieldVerifiers();
  const names = await prisma.verifierProfile.findMany({
    where: { id: { in: verifiers.map((v) => v.id) } },
    select: { id: true, user: { select: { name: true } } },
  });
  const verifierName = new Map(names.map((n) => [n.id, n.user.name]));
  const counts = await openVisitCounts(verifiers.map((v) => v.id));

  return runs.map((run) => {
    const school = run.school;
    const barred = new Set(run.fieldVisits.map((v) => v.profileId));
    const last = run.fieldVisits.find((v) => v.recusedAt !== null) ?? null;

    return {
      runId: run.id,
      udise: school.udise,
      schoolName: school.nameEn,
      districtCode: school.districtCode,
      districtName: districtName.get(school.districtCode) ?? school.districtCode,
      blockName: school.block.nameEn,
      reason: last ? ('STOOD_DOWN' as const) : ('NEVER_ALLOCATED' as const),
      stoodDownBy: last?.profile.user.name ?? null,
      stoodDownAt: last?.recusedAt?.toISOString() ?? null,
      options: eligibleFor(verifiers, {
        udise: school.udise,
        districtCode: school.districtCode,
        blockCode: school.blockCode,
      })
        .filter((v) => !barred.has(v.id))
        .map((v) => ({
          profileId: v.id,
          name: verifierName.get(v.id) ?? v.id,
          openVisits: counts.get(v.id) ?? 0,
        }))
        .sort((a, b) => a.openVisits - b.openVisits || a.name.localeCompare(b.name)),
    };
  });
}

export type ReallocateResult = { success: boolean; error?: string; outsideWindow?: boolean };

/**
 * Send somebody to a stranded school.
 *
 * `profileId` omitted means "whoever is carrying least", the same rule the recusal path applies
 * on its own. Named means the Authority chose a person, and that person is still checked against
 * the roster and the exclusions: choosing within the rule is a decision this screen offers, and
 * overriding the rule is not.
 */
export async function reallocateSchool(
  runId: string,
  profileId?: string,
): Promise<ReallocateResult> {
  if (!(await requireRole('SSSA_ADMIN'))) return { success: false, error: 'Not authorised.' };

  const placement = await placeReplacement(runId, profileId ? { profileId } : {});

  revalidatePath('/app/sssa/workforce');
  revalidatePath('/app/verifier/assignments');

  if (placement.placed) return { success: true, outsideWindow: placement.outsideWindow };

  const message: Record<typeof placement.reason, string> = {
    'already-placed': 'Somebody is already going to this school.',
    'run-not-found': 'That school is not in this year’s cohort.',
    'no-travel-window': 'This year has no travel window yet, so there is no date to send anyone on.',
    'no-eligible-verifier':
      'Nobody is eligible for this school. Empanel a verifier for the district, or lift an exclusion.',
    'not-eligible': 'That verifier cannot take this school.',
  };
  return { success: false, error: message[placement.reason] };
}
