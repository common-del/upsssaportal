'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireVerifier } from '@/lib/authz';
import { isRevealed } from '@/lib/verification/reveal';
import {
  drawSpotCheckSample,
  isSameISTDay,
  perClassEstimate,
  spotCheckSize,
  type SpotCheckSlot,
} from '@/lib/verification/spotCheck';
import { transitionRun } from '@/lib/verification/stateMachine';

/**
 * The field visit: what the verifier records on site, and what happens when they sign off.
 *
 * Every action here re-checks the reveal gate rather than trusting that the page would not have
 * rendered. These are HTTP endpoints; the gate belongs on each one, not on the screen that
 * usually precedes them.
 *
 * All writes are upserts keyed on the thing being written about, which is what lets the offline
 * queue on the device retry blindly. A verifier who loses signal mid-visit and syncs an hour later
 * must not create a second finding for the same indicator.
 */

async function myFieldProfile() {
  const actor = await requireVerifier();
  if (!actor) return null;
  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, cell: true, certification: true, deEmpanelledAt: true },
  });
  if (!profile || profile.cell !== 'FIELD') return null;
  if (profile.certification !== 'CERTIFIED' || profile.deEmpanelledAt) return null;
  return { profileId: profile.id, userId: actor.userId };
}

/** The visit, if it is this verifier's and the reveal has passed. */
async function myRevealedVisit(visitId: string) {
  const me = await myFieldProfile();
  if (!me) return null;
  const visit = await prisma.fieldVisit.findFirst({
    where: { id: visitId, profileId: me.profileId, recusedAt: null },
    select: { id: true, runId: true, revealAt: true, arrivedAt: true, signedOffAt: true },
  });
  if (!visit) return null;
  if (!isRevealed(visit.revealAt)) return null;
  return { ...visit, ...me };
}

export type FieldIndicator = {
  parameterId: string;
  code: string;
  titleEn: string;
  titleHi: string;
  domainTitleEn: string;
  claimedLevel: number | null;
  claimedLabelEn: string | null;
  /** The framework's text for each level, so the verifier grades against the rubric on site. */
  levels: { order: number; labelEn: string; labelHi: string }[];
  observedLevel: number | null;
  note: string | null;
  photoBlobUrl: string | null;
};

export type FieldVisitCase = {
  visitId: string;
  schoolName: string;
  schoolUdise: string;
  blockName: string;
  districtName: string;
  arrivedAt: string | null;
  signedOffAt: string | null;
  indicators: FieldIndicator[];
  spotCheck: {
    size: number;
    slots: SpotCheckSlot[];
    substitutes: SpotCheckSlot[];
    recorded: {
      classLevel: number;
      rollPosition: number;
      readingScore: number | null;
      writingScore: number | null;
      numeracyScore: number | null;
      note: string | null;
    }[];
  };
  /** Indicators where what was seen differs from what was claimed. */
  discrepancyCount: number;
};

export async function getFieldVisit(visitId: string): Promise<FieldVisitCase | null> {
  const visit = await myRevealedVisit(visitId);
  if (!visit) return null;

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: visit.runId },
    select: {
      cycleId: true,
      schoolUdise: true,
      school: {
        select: {
          udise: true,
          nameEn: true,
          block: { select: { nameEn: true } },
          district: { select: { nameEn: true } },
          profileDetail: { select: { totalStudents: true, classesFrom: true, classesTo: true } },
        },
      },
    },
  });
  if (!run) return null;

  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
    include: {
      responses: {
        include: {
          parameter: {
            include: {
              options: { orderBy: { order: 'asc' } },
              subDomain: { include: { domain: true } },
            },
          },
        },
      },
    },
  });

  const [findings, spotChecks, config] = await Promise.all([
    prisma.fieldFinding.findMany({ where: { visitId } }),
    prisma.studentSpotCheck.findMany({ where: { visitId }, orderBy: [{ classLevel: 'asc' }, { rollPosition: 'asc' }] }),
    prisma.programmeConfig.findUnique({
      where: { id: 'current' },
      select: {
        spotCheckMode: true,
        spotCheckFixedCount: true,
        spotCheckPercentage: true,
        spotCheckMinimum: true,
      },
    }),
  ]);

  const findingBy = new Map(findings.map((f) => [f.parameterId, f]));

  // A non-submitter has no responses, and it is one of the reasons a school is visited. The
  // indicator list then comes from the framework itself, with nothing claimed against any of
  // them, so the verifier still grades all 89 rather than being shown an empty page whose
  // sign-off would pass trivially.
  const parameters =
    submission && submission.responses.length > 0
      ? submission.responses.map((r) => ({ parameter: r.parameter, selectedKey: r.selectedOptionKey }))
      : (
          await prisma.parameter.findMany({
            include: {
              options: { orderBy: { order: 'asc' } },
              subDomain: { include: { domain: true } },
            },
          })
        ).map((parameter) => ({ parameter, selectedKey: null as string | null }));

  // "1.10.1" must sort after "1.9.1", which a string comparison gets wrong, so compare the code
  // segments as numbers.
  const codeOrder = (a: string, b: string) => {
    const as = a.split('.').map(Number);
    const bs = b.split('.').map(Number);
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
      const diff = (as[i] ?? 0) - (bs[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  const indicators: FieldIndicator[] = parameters
    .map(({ parameter: p, selectedKey }) => {
      const claimed = p.options.find((o) => o.key === selectedKey);
      const f = findingBy.get(p.id);
      return {
        parameterId: p.id,
        code: p.code,
        titleEn: p.titleEn,
        titleHi: p.titleHi,
        domainTitleEn: p.subDomain.domain.titleEn,
        claimedLevel: claimed?.order ?? null,
        claimedLabelEn: claimed?.labelEn ?? null,
        levels: p.options.map((o) => ({ order: o.order, labelEn: o.labelEn, labelHi: o.labelHi })),
        observedLevel: f?.observedLevel ?? null,
        note: f?.note ?? null,
        photoBlobUrl: f?.photoBlobUrl ?? null,
      };
    })
    .sort((a, b) => codeOrder(a.code, b.code));

  const detail = run.school.profileDetail;
  const enrolment = detail?.totalStudents ?? 0;
  const classFrom = Number.parseInt(detail?.classesFrom ?? '1', 10) || 1;
  const classTo = Number.parseInt(detail?.classesTo ?? '8', 10) || 8;

  const size = spotCheckSize(
    {
      mode: config?.spotCheckMode ?? 'FIXED_COUNT',
      fixedCount: config?.spotCheckFixedCount ?? 10,
      percentage: config?.spotCheckPercentage ?? 10,
      minimum: config?.spotCheckMinimum ?? 5,
    },
    enrolment,
  );

  // Drawn from the visit id, so it is the same list every time this page loads and the same list
  // an auditor derives months later. Not stored, because storing it would let it be edited.
  const sample =
    size > 0
      ? drawSpotCheckSample(
          visitId,
          classFrom,
          classTo,
          size,
          perClassEstimate(enrolment, classFrom, classTo),
        )
      : { slots: [], substitutes: [] };

  return {
    visitId,
    schoolName: run.school.nameEn,
    schoolUdise: run.school.udise,
    blockName: run.school.block.nameEn,
    districtName: run.school.district.nameEn,
    arrivedAt: visit.arrivedAt?.toISOString() ?? null,
    signedOffAt: visit.signedOffAt?.toISOString() ?? null,
    indicators,
    spotCheck: {
      size,
      slots: sample.slots,
      substitutes: sample.substitutes,
      recorded: spotChecks.map((s) => ({
        classLevel: s.classLevel,
        rollPosition: s.rollPosition,
        readingScore: s.readingScore,
        writingScore: s.writingScore,
        numeracyScore: s.numeracyScore,
        note: s.note,
      })),
    },
    discrepancyCount: indicators.filter(
      (i) => i.observedLevel !== null && i.claimedLevel !== null && i.observedLevel !== i.claimedLevel,
    ).length,
  };
}

/** Records arrival, which is what starts the same-day clock. */
export async function startVisit(visitId: string): Promise<{ success: boolean; error?: string }> {
  const visit = await myRevealedVisit(visitId);
  if (!visit) return { success: false, error: 'Visit not available.' };
  if (visit.signedOffAt) return { success: false, error: 'This visit is already signed off.' };

  if (!visit.arrivedAt) {
    await prisma.fieldVisit.update({ where: { id: visitId }, data: { arrivedAt: new Date() } });
    await transitionRun(visit.runId, 'FIELD_VISIT', { actorUserId: visit.userId });
  }
  revalidatePath(`/app/verifier/visit/${visitId}`);
  return { success: true };
}

export async function saveFieldFinding(
  visitId: string,
  parameterId: string,
  observedLevel: number,
  note: string,
  photo?: { blobUrl: string; lat: number | null; lng: number | null },
): Promise<{ success: boolean; error?: string }> {
  const visit = await myRevealedVisit(visitId);
  if (!visit) return { success: false, error: 'Visit not available.' };
  if (visit.signedOffAt) return { success: false, error: 'This visit is signed off and cannot be changed.' };

  const param = await prisma.parameter.findUnique({
    where: { id: parameterId },
    select: { options: { select: { order: true } } },
  });
  if (!param) return { success: false, error: 'Indicator not found.' };
  const valid = param.options.map((o) => o.order);
  if (!valid.includes(observedLevel)) {
    return { success: false, error: `Level ${observedLevel} is not defined for this indicator.` };
  }

  await prisma.fieldFinding.upsert({
    where: { visitId_parameterId: { visitId, parameterId } },
    create: {
      visitId,
      parameterId,
      observedLevel,
      note: note.trim() || null,
      photoBlobUrl: photo?.blobUrl ?? null,
      photoLat: photo?.lat ?? null,
      photoLng: photo?.lng ?? null,
      capturedAt: photo ? new Date() : null,
    },
    update: {
      observedLevel,
      note: note.trim() || null,
      // A retry that carries no photo must not erase one already stored: the offline queue can
      // replay a level change made before the photo was taken.
      ...(photo
        ? {
            photoBlobUrl: photo.blobUrl,
            photoLat: photo.lat,
            photoLng: photo.lng,
            capturedAt: new Date(),
          }
        : {}),
    },
  });

  revalidatePath(`/app/verifier/visit/${visitId}`);
  return { success: true };
}

export async function saveSpotCheck(
  visitId: string,
  classLevel: number,
  rollPosition: number,
  scores: { reading: number | null; writing: number | null; numeracy: number | null },
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const visit = await myRevealedVisit(visitId);
  if (!visit) return { success: false, error: 'Visit not available.' };
  if (visit.signedOffAt) return { success: false, error: 'This visit is signed off and cannot be changed.' };

  const inRange = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 3);
  if (!inRange(scores.reading) || !inRange(scores.writing) || !inRange(scores.numeracy)) {
    return { success: false, error: 'Task scores run from 0 to 3.' };
  }

  await prisma.studentSpotCheck.upsert({
    where: { visitId_rollPosition_classLevel: { visitId, rollPosition, classLevel } },
    create: {
      visitId,
      classLevel,
      rollPosition,
      readingScore: scores.reading,
      writingScore: scores.writing,
      numeracyScore: scores.numeracy,
      note: note.trim() || null,
    },
    update: {
      readingScore: scores.reading,
      writingScore: scores.writing,
      numeracyScore: scores.numeracy,
      note: note.trim() || null,
    },
  });

  revalidatePath(`/app/verifier/visit/${visitId}`);
  return { success: true };
}

export type SignOffResult = {
  success: boolean;
  error?: string;
  discrepanciesRaised?: number;
  routedTo?: string;
};

/**
 * Same-day digital sign-off.
 *
 * Raises a Discrepancy row for every indicator where what was seen differs from what was claimed,
 * then routes the run. Discrepancies are created here rather than as findings are entered, because
 * a verifier revising an observation mid-visit should not leave a trail of raised and withdrawn
 * discrepancies against a school; the discrepancy is what the verifier finally asserts.
 */
export async function signOffVisit(
  visitId: string,
  geo: { lat: number | null; lng: number | null },
): Promise<SignOffResult> {
  const visit = await myRevealedVisit(visitId);
  if (!visit) return { success: false, error: 'Visit not available.' };
  if (visit.signedOffAt) return { success: false, error: 'This visit is already signed off.' };
  if (!visit.arrivedAt) return { success: false, error: 'Record your arrival before signing off.' };

  // The terms of reference require sign-off on the day of the visit. Enforced rather than
  // recommended, because a report written days later is the thing the requirement exists to stop.
  const now = new Date();
  if (!isSameISTDay(visit.arrivedAt, now)) {
    return {
      success: false,
      error:
        'Sign-off has to happen on the day of the visit. This visit began on a different day, so a supervisor has to complete it.',
    };
  }

  const deskCase = await getFieldVisit(visitId);
  if (!deskCase) return { success: false, error: 'Visit not available.' };

  const undecided = deskCase.indicators.filter((i) => i.observedLevel === null);
  if (undecided.length > 0) {
    return {
      success: false,
      error: `${undecided.length} indicator(s) have no observed level yet.`,
    };
  }

  let raised = 0;
  for (const i of deskCase.indicators) {
    if (i.claimedLevel === null || i.observedLevel === null) continue;
    if (i.observedLevel === i.claimedLevel) continue;
    await prisma.discrepancy.upsert({
      where: { runId_parameterId: { runId: visit.runId, parameterId: i.parameterId } },
      create: {
        runId: visit.runId,
        parameterId: i.parameterId,
        claimedLevel: i.claimedLevel,
        proposedLevel: i.observedLevel,
        basis: i.note ?? 'Observed on site during physical verification.',
        raisedByProfileId: visit.profileId,
      },
      update: {
        proposedLevel: i.observedLevel,
        basis: i.note ?? 'Observed on site during physical verification.',
      },
    });
    raised += 1;
  }

  await prisma.fieldVisit.update({
    where: { id: visitId },
    data: { signedOffAt: now, signOffLat: geo.lat, signOffLng: geo.lng },
  });

  // A clean visit publishes. A visit with discrepancies goes to review; whether that then opens
  // the school's response window or publishes directly is decided there, by
  // schoolResponseWindowEnabled, not here.
  const next = raised > 0 ? 'DISCREPANCY_REVIEW' : 'PUBLISHED';
  const moved = await transitionRun(visit.runId, next, { actorUserId: visit.userId });
  if (!moved?.ok) {
    return {
      success: false,
      error: moved?.ok === false ? moved.reason : 'Could not route the visit.',
    };
  }

  revalidatePath('/app/verifier/assignments');
  return { success: true, discrepanciesRaised: raised, routedTo: next };
}
