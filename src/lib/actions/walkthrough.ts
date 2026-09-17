'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireSchool, requireOnlineVerifier } from '@/lib/authz';
import { maskSchool } from '@/lib/verification/masking';
import {
  canResolve,
  clipCapturedAt,
  connectivityAfter,
  fenceReading,
  GUIDED_CAPTURE_HOURS,
  isFreshCapture,
} from '@/lib/verification/walkthroughRules';
import { publishIfCohortAlreadyDrawn } from '@/lib/verification/publishQueue';
import { transitionRun } from '@/lib/verification/stateMachine';
import type { WalkthroughOutcome } from '@prisma/client';

/**
 * The video walkthrough: the online track's last instrument before a case either joins the
 * census queue or forces a field visit.
 *
 * Anonymity here is one-way and the code says which way. The school never learns the
 * verifier: they hear a voice and see a pseudonym, and nothing in the school-side payload
 * carries a name. (The ToR's text-only protocol went further and muted the verifier; SSSA
 * reversed that for usability on 24 August 2026, BRIEF_REVIEW section 9.) The verifier
 * does learn the school, at a recorded moment, after a conflict declaration, because a
 * live camera shows the building whatever a masked code says; BRIEF_REVIEW section 3
 * records why this is disclosed rather than pretended away.
 *
 * The live video transport itself is not wired in this environment. Everything around the
 * pane is real: the session lifecycle, the geofence arithmetic, the connectivity rule that
 * drops to guided capture, the prompt queue, the observations and the routing.
 */

async function myOnlineProfile() {
  const actor = await requireOnlineVerifier();
  if (!actor) return null;
  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true, cell: true, certification: true, deEmpanelledAt: true, pseudonym: true },
  });
  if (!profile || profile.cell !== 'ONLINE') return null;
  if (profile.certification !== 'CERTIFIED' || profile.deEmpanelledAt) return null;
  return { profileId: profile.id, userId: actor.userId, pseudonym: profile.pseudonym };
}

async function walkthroughConfig() {
  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { videoWalkthroughTurnaroundDays: true },
  });
  return { turnaroundDays: config?.videoWalkthroughTurnaroundDays ?? 7 };
}

/** Every indicator the desk screening left in dispute: manual decisions that did not accept
 *  the claim, plus every automated mismatch. This list is the walkthrough's agenda. */
async function disputedParameterIds(runId: string): Promise<string[]> {
  const [decisions, mismatches] = await Promise.all([
    prisma.deskScreeningDecision.findMany({
      where: { runId, decision: { not: 'EVIDENCE_SUPPORTS_LEVEL' } },
      select: { parameterId: true },
    }),
    prisma.autoCheckResult.findMany({
      where: { runId, outcome: 'MISMATCH' },
      select: { parameterId: true },
    }),
  ]);
  return [...new Set([...decisions.map((d) => d.parameterId), ...mismatches.map((m) => m.parameterId)])];
}

// ─────────────────────────────────────────────────────────────────────────────
// Verifier: queue and console
// ─────────────────────────────────────────────────────────────────────────────

export type WalkthroughQueueRow = {
  runId: string;
  maskedCode: string;
  /** Which grades the school teaches, as a label. Was `category`, which for a bulk-register
   *  school held the ownership type and put "Govt" in front of a screener. */
  stage: string;
  enteredStateAt: string;
  /** enteredStateAt plus the configured turnaround. */
  dueBy: string;
  overdue: boolean;
  mine: boolean;
  sessionState: 'NOT_STARTED' | 'SCHEDULED' | 'LIVE' | 'GUIDED_CAPTURE' | 'ENDED';
  scheduledFor: string | null;
  /** When a live session began, so a row can say how long the call has been running. */
  startedAt: string | null;
  /** The walkthrough's agenda: indicators desk screening left in dispute. */
  disputed: number;
  /** How many of those already carry an observation, so a row shows progress. */
  observed: number;
  /** Recording cases only: clips the school has returned, against the disputed count above,
   *  and when the most recent one arrived. */
  clipsReturned: number | null;
  lastClipAt: string | null;
  /** Recording cases only: the school's 48 hour window and what is left of it. This is the
   *  second clock in the queue, and the reason a row states its own rather than reading a
   *  shared deadline column that would be wrong for half the list. */
  hoursLeft: number | null;
  windowClosed: boolean;
  /** The score that pushed this case over the threshold, for an unclaimed row to justify
   *  itself. Null when no score was stored, which older demo rows can be. */
  riskScore: number | null;
  /** The indicators in dispute, and whether each has been checked. Shown on the focused case
   *  so a verifier knows what they are walking into before the console opens. Framework text
   *  only: a code and a title identify an indicator, never a school. */
  agenda: { code: string; titleEn: string; checked: boolean }[];
};

export async function getWalkthroughQueue(): Promise<WalkthroughQueueRow[]> {
  const me = await myOnlineProfile();
  if (!me) return [];
  const { turnaroundDays } = await walkthroughConfig();

  const runs = await prisma.assessmentCycleRun.findMany({
    where: {
      state: 'VIDEO_WALKTHROUGH',
      OR: [{ deskAssigneeProfileId: me.profileId }, { deskAssigneeProfileId: null }],
    },
    select: {
      id: true,
      enteredStateAt: true,
      deskAssigneeProfileId: true,
      school: { select: { udise: true, stage: true } },
      riskScores: { orderBy: { computedAt: 'desc' }, take: 1, select: { score: true } },
      deskDecisions: {
        where: { decision: { not: 'EVIDENCE_SUPPORTS_LEVEL' } },
        select: { parameterId: true },
      },
      autoChecks: { where: { outcome: 'MISMATCH' }, select: { parameterId: true } },
      walkthroughs: {
        where: { recusedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          scheduledFor: true,
          startedAt: true,
          endedAt: true,
          mode: true,
          guidedCaptureDeadline: true,
          observations: { select: { parameterId: true } },
          clips: { select: { capturedAt: true }, orderBy: { capturedAt: 'desc' } },
        },
      },
    },
    orderBy: { enteredStateAt: 'asc' },
    take: 200,
  });

  // Every indicator any case disputes, fetched once rather than per row.
  const allDisputed = new Set<string>();
  for (const r of runs) {
    for (const d of r.deskDecisions) allDisputed.add(d.parameterId);
    for (const a of r.autoChecks) allDisputed.add(a.parameterId);
  }
  const parameters = allDisputed.size
    ? await prisma.parameter.findMany({
        where: { id: { in: [...allDisputed] } },
        select: { id: true, code: true, titleEn: true },
      })
    : [];
  const parameterBy = new Map(parameters.map((p) => [p.id, p]));

  const now = Date.now();
  return runs.map((r) => {
    const session = r.walkthroughs[0];
    const dueBy = new Date(r.enteredStateAt.getTime() + turnaroundDays * 86_400_000);
    // The agenda, counted the same way the console derives it: non-accepting desk decisions
    // plus automated mismatches, deduplicated because one indicator can be both.
    const disputed = new Set([
      ...r.deskDecisions.map((d) => d.parameterId),
      ...r.autoChecks.map((a) => a.parameterId),
    ]);
    const observed = new Set(
      (session?.observations ?? []).map((o) => o.parameterId).filter((id) => disputed.has(id)),
    );
    const guided = session?.mode === 'GUIDED_CAPTURE';
    return {
      runId: r.id,
      ...maskSchool(r.school),
      enteredStateAt: r.enteredStateAt.toISOString(),
      dueBy: dueBy.toISOString(),
      overdue: dueBy.getTime() < now,
      mine: r.deskAssigneeProfileId === me.profileId,
      sessionState: !session
        ? 'NOT_STARTED'
        : session.endedAt
          ? 'ENDED'
          : session.mode === 'GUIDED_CAPTURE'
            ? 'GUIDED_CAPTURE'
            : session.startedAt
              ? 'LIVE'
              : session.scheduledFor
                ? 'SCHEDULED'
                : 'NOT_STARTED',
      scheduledFor: session?.scheduledFor?.toISOString() ?? null,
      startedAt: session?.startedAt?.toISOString() ?? null,
      disputed: disputed.size,
      observed: observed.size,
      clipsReturned: guided ? (session?.clips.length ?? 0) : null,
      lastClipAt: guided ? (session?.clips[0]?.capturedAt.toISOString() ?? null) : null,
      hoursLeft:
        guided && session?.guidedCaptureDeadline
          ? Math.max(0, Math.ceil((session.guidedCaptureDeadline.getTime() - now) / 3_600_000))
          : null,
      windowClosed:
        guided &&
        session?.guidedCaptureDeadline !== null &&
        session?.guidedCaptureDeadline !== undefined &&
        session.guidedCaptureDeadline.getTime() <= now,
      riskScore: r.riskScores[0]?.score ?? null,
      agenda: [...disputed]
        .map((id) => parameterBy.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        .map((p) => ({ code: p.code, titleEn: p.titleEn, checked: observed.has(p.id) })),
    };
  });
}

/** Take over a case whose conductor recused or was never set. */
export async function claimWalkthrough(runId: string): Promise<{ success: boolean; error?: string }> {
  const me = await myOnlineProfile();
  if (!me) return { success: false, error: 'Not authorised.' };
  const result = await prisma.assessmentCycleRun.updateMany({
    where: { id: runId, state: 'VIDEO_WALKTHROUGH', deskAssigneeProfileId: null },
    data: { deskAssigneeProfileId: me.profileId },
  });
  if (result.count === 0) return { success: false, error: 'This case is already assigned.' };
  revalidatePath('/app/verifier/walkthroughs');
  return { success: true };
}

async function mySession(runId: string) {
  const me = await myOnlineProfile();
  if (!me) return null;
  const run = await prisma.assessmentCycleRun.findFirst({
    where: { id: runId, state: 'VIDEO_WALKTHROUGH', deskAssigneeProfileId: me.profileId },
    select: { id: true },
  });
  if (!run) return null;
  let session = await prisma.walkthroughSession.findFirst({
    where: { runId, profileId: me.profileId, recusedAt: null },
  });
  session ??= await prisma.walkthroughSession.create({
    data: { runId, profileId: me.profileId },
  });
  return { session, me };
}

export type DisputedIndicator = {
  parameterId: string;
  code: string;
  titleEn: string;
  titleHi: string;
  claimedLevel: number | null;
  claimedLabelEn: string | null;
  /** Why it is disputed: the desk decision, the auto mismatch, or both. */
  disputeSources: string[];
  /** The framework's own text for each level, so the verifier reads the rubric on the call
   *  rather than recalling it. The same descriptors the field workspace shows on site. */
  levels: { order: number; labelEn: string; labelHi: string }[];
  /** The level this walkthrough settled on, when it settled one. */
  observedLevel: number | null;
  /** The call could not check this indicator, so it stays unsettled. */
  couldNotCheck: boolean;
  /** Free text from before the level picker replaced it, shown read-only where it exists. */
  observationNote: string | null;
};

export type WalkthroughConsole = {
      runId: string;
      /** The disclosure is made and recorded at console open; the declaration then blocks
       *  all work until answered, because a person can only declare a conflict about a
       *  school they can name. */
      needsDeclaration: boolean;
      sessionId: string;
      pseudonym: string;
      schoolName: string;
      schoolUdise: string;
      districtName: string;
      mode: 'LIVE' | 'GUIDED_CAPTURE';
      scheduledFor: string | null;
      startedAt: string | null;
      endedAt: string | null;
      outcome: string | null;
      outcomeNote: string | null;
      connectivityFailures: number;
      lastGeofenceMetres: number | null;
      geofenceHeld: boolean | null;
      geofenceAnchored: boolean;
      guidedCaptureDeadline: string | null;
      dueBy: string;
      indicators: DisputedIndicator[];
      clips: {
        id: string;
        /** Which disputed indicator this clip was recorded for; null on older clips. */
        parameterId: string | null;
        taskLabel: string;
        blobUrl: string;
        lat: number | null;
        lng: number | null;
        capturedAt: string;
        freshCapture: boolean;
      }[];
    };

export async function getWalkthroughConsole(runId: string): Promise<WalkthroughConsole | null> {
  const mine = await mySession(runId);
  if (!mine) return null;
  const { session, me } = mine;
  const { turnaroundDays } = await walkthroughConfig();

  const run = await prisma.assessmentCycleRun.findUnique({
    where: { id: runId },
    select: {
      cycleId: true,
      schoolUdise: true,
      enteredStateAt: true,
      school: {
        select: { udise: true, nameEn: true, geoLat: true, geoLng: true, district: { select: { nameEn: true } } },
      },
    },
  });
  if (!run) return null;

  // Opening the console is the disclosure moment, and it is stamped. The masking held
  // through the whole desk queue; a walkthrough shows the building on camera, so the
  // identity is disclosed here, recorded, and immediately followed by the conflict
  // question, which blocks every working action until answered.
  if (!session.identityDisclosedAt) {
    await prisma.walkthroughSession.update({
      where: { id: session.id },
      data: { identityDisclosedAt: new Date() },
    });
  }

  const disputed = await disputedParameterIds(runId);
  const [parameters, submission, observations, clips] = await Promise.all([
    prisma.parameter.findMany({
      where: { id: { in: disputed } },
      include: { options: { orderBy: { order: 'asc' } } },
    }),
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
      select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.walkthroughObservation.findMany({ where: { sessionId: session.id } }),
    prisma.walkthroughClip.findMany({ where: { sessionId: session.id }, orderBy: { capturedAt: 'asc' } }),
  ]);

  const [decisions, mismatches] = await Promise.all([
    prisma.deskScreeningDecision.findMany({
      where: { runId, decision: { not: 'EVIDENCE_SUPPORTS_LEVEL' } },
      select: { parameterId: true, decision: true },
    }),
    prisma.autoCheckResult.findMany({
      where: { runId, outcome: 'MISMATCH' },
      select: { parameterId: true, source: true },
    }),
  ]);
  const decisionBy = new Map(decisions.map((d) => [d.parameterId, d.decision as string]));
  const mismatchBy = new Map(mismatches.map((m) => [m.parameterId, m.source as string | null]));
  const claimBy = new Map((submission?.responses ?? []).map((r) => [r.parameterId, r.selectedOptionKey]));
  const observationBy = new Map(observations.map((o) => [o.parameterId, o]));

  const indicators: DisputedIndicator[] = parameters
    .map((p) => {
      const claimedKey = claimBy.get(p.id);
      const claimed = p.options.find((o) => o.key === claimedKey);
      const sources: string[] = [];
      const decision = decisionBy.get(p.id);
      if (decision) sources.push(`Desk: ${decision.replaceAll('_', ' ').toLowerCase()}`);
      const source = mismatchBy.get(p.id);
      if (mismatchBy.has(p.id)) sources.push(`Mismatch against ${source ?? 'external source'}`);
      return {
        parameterId: p.id,
        code: p.code,
        titleEn: p.titleEn,
        titleHi: p.titleHi,
        claimedLevel: claimed?.order ?? null,
        claimedLabelEn: claimed?.labelEn ?? null,
        disputeSources: sources,
        levels: p.options.map((o) => ({ order: o.order, labelEn: o.labelEn, labelHi: o.labelHi })),
        observedLevel: observationBy.get(p.id)?.observedLevel ?? null,
        couldNotCheck: observationBy.get(p.id)?.couldNotCheck ?? false,
        observationNote: observationBy.get(p.id)?.note ?? null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return {
    runId,
    needsDeclaration: session.conflictDeclaredAt === null,
    sessionId: session.id,
    pseudonym: me.pseudonym,
    schoolName: run.school.nameEn,
    schoolUdise: run.school.udise,
    districtName: run.school.district.nameEn,
    mode: session.mode,
    scheduledFor: session.scheduledFor?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    outcome: session.outcome,
    outcomeNote: session.outcomeNote,
    connectivityFailures: session.connectivityFailures,
    lastGeofenceMetres: session.lastGeofenceMetres,
    geofenceHeld: session.geofenceHeld,
    geofenceAnchored: run.school.geoLat !== null && run.school.geoLng !== null,
    guidedCaptureDeadline: session.guidedCaptureDeadline?.toISOString() ?? null,
    dueBy: new Date(run.enteredStateAt.getTime() + turnaroundDays * 86_400_000).toISOString(),
    indicators,
    clips: clips.map((c) => ({
      id: c.id,
      parameterId: c.parameterId,
      taskLabel: c.taskLabel,
      blobUrl: c.blobUrl,
      lat: c.lat,
      lng: c.lng,
      capturedAt: c.capturedAt.toISOString(),
      freshCapture: c.freshCapture,
    })),
  };
}

export async function declareWalkthroughConflict(
  runId: string,
  hasConflict: boolean,
): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.conflictDeclaredAt) return { success: false, error: 'Already declared.' };

  const now = new Date();
  if (hasConflict) {
    // Stand down and put the case back in the pool for another online verifier.
    await prisma.$transaction([
      prisma.walkthroughSession.update({
        where: { id: mine.session.id },
        data: { conflictDeclaredAt: now, recusedAt: now },
      }),
      prisma.assessmentCycleRun.update({
        where: { id: runId },
        data: { deskAssigneeProfileId: null },
      }),
    ]);
    revalidatePath('/app/verifier/walkthroughs');
    return { success: true };
  }

  await prisma.walkthroughSession.update({
    where: { id: mine.session.id },
    data: { conflictDeclaredAt: now },
  });
  revalidatePath(`/app/verifier/walkthrough/${runId}`);
  return { success: true };
}

export async function scheduleWalkthrough(
  runId: string,
  whenIso: string,
): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.endedAt) return { success: false, error: 'This session has ended.' };
  if (!mine.session.conflictDeclaredAt) return { success: false, error: 'Declare conflicts first.' };

  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
    return { success: false, error: 'Pick a time in the future.' };
  }
  await prisma.walkthroughSession.update({
    where: { id: mine.session.id },
    data: { scheduledFor: when },
  });
  revalidatePath(`/app/verifier/walkthrough/${runId}`);
  return { success: true };
}

export async function startWalkthrough(runId: string): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.endedAt) return { success: false, error: 'This session has ended.' };
  if (!mine.session.conflictDeclaredAt) return { success: false, error: 'Declare conflicts first.' };

  if (!mine.session.startedAt) {
    await prisma.walkthroughSession.update({
      where: { id: mine.session.id },
      data: { startedAt: new Date() },
    });
  }
  revalidatePath(`/app/verifier/walkthrough/${runId}`);
  return { success: true };
}

/** What the walkthrough concluded about one disputed indicator. */
export type ObservationAnswer =
  | { kind: 'LEVEL'; level: number }
  | { kind: 'COULD_NOT_CHECK' };

/**
 * Record the walkthrough's answer on one indicator.
 *
 * A level rather than a paragraph, drawn from the framework's own descriptors, so the
 * walkthrough answers in the same currency as the school's claim and the field visit and the
 * three can be set side by side. "Could not check" is a real answer with a consequence: it
 * leaves the indicator unsettled, which the resolve rule then refuses to call resolved.
 */
export async function saveObservation(
  runId: string,
  parameterId: string,
  answer: ObservationAnswer,
): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.endedAt) return { success: false, error: 'This session has ended.' };
  if (!mine.session.conflictDeclaredAt) return { success: false, error: 'Declare conflicts first.' };

  if (answer.kind === 'LEVEL') {
    // The level has to be one this indicator actually defines: the framework carries three,
    // and a number from anywhere else would be a level nobody can read back.
    const param = await prisma.parameter.findUnique({
      where: { id: parameterId },
      select: { options: { where: { isActive: true }, select: { order: true } } },
    });
    if (!param) return { success: false, error: 'Indicator not found.' };
    if (!param.options.some((o) => o.order === answer.level)) {
      return { success: false, error: `Level ${answer.level} is not defined for this indicator.` };
    }
  }

  const data =
    answer.kind === 'LEVEL'
      ? { observedLevel: answer.level, couldNotCheck: false }
      : { observedLevel: null, couldNotCheck: true };

  await prisma.walkthroughObservation.upsert({
    where: { sessionId_parameterId: { sessionId: mine.session.id, parameterId } },
    create: { sessionId: mine.session.id, parameterId, ...data },
    update: data,
  });
  revalidatePath(`/app/verifier/walkthrough/${runId}`);
  return { success: true };
}

/**
 * End the session with a verdict and route the run. RESOLVED joins the census queue for its
 * normal turn; UNRESOLVED is fast-tracked into this year's field cohort, which the state
 * machine records on the transition itself.
 */
export async function resolveWalkthrough(
  runId: string,
  outcome: WalkthroughOutcome,
  outcomeNote: string,
): Promise<{ success: boolean; error?: string; routedTo?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.endedAt) return { success: false, error: 'Already resolved.' };
  if (!mine.session.startedAt) return { success: false, error: 'Start the session before resolving it.' };

  const [disputed, observations] = await Promise.all([
    disputedParameterIds(runId),
    prisma.walkthroughObservation.findMany({
      where: { sessionId: mine.session.id },
      select: { parameterId: true, observedLevel: true, couldNotCheck: true, note: true },
    }),
  ]);

  // An indicator the call could not check is answered but not settled, so it does not count
  // as observed: RESOLVED asserts every dispute was actually looked at, and this one was not.
  // The verifier is left with UNRESOLVED, which fast-tracks the case to a physical visit.
  // A legacy record carrying only free text still counts, so old sessions stay resolvable.
  const settled = observations
    .filter((o) => !o.couldNotCheck && (o.observedLevel !== null || (o.note ?? '').trim().length > 0))
    .map((o) => o.parameterId);

  const check = canResolve(outcome, disputed, settled, outcomeNote);
  if (!check.ok) return { success: false, error: check.reason ?? 'Cannot resolve yet.' };

  await prisma.walkthroughSession.update({
    where: { id: mine.session.id },
    data: { endedAt: new Date(), outcome, outcomeNote: outcomeNote.trim() || null },
  });

  const next = outcome === 'RESOLVED' ? 'CENSUS_QUEUE' : 'FIELD_COHORT';
  const moved = await transitionRun(runId, next, { actorUserId: mine.me.userId });
  if (!moved?.ok) {
    return { success: false, error: moved?.ok === false ? moved.reason : 'Could not route the case.' };
  }

  // Resolved on video after this year's cohort was already drawn: nothing further is coming, so
  // the result publishes now rather than sitting in a queue nothing will empty.
  if (next === 'CENSUS_QUEUE') {
    await publishIfCohortAlreadyDrawn(runId, { actorUserId: mine.me.userId });
  }

  revalidatePath('/app/verifier/walkthroughs');
  return { success: true, routedTo: next };
}

// ─────────────────────────────────────────────────────────────────────────────
// School side
// ─────────────────────────────────────────────────────────────────────────────

/** A clip as the school sees its own: the same facts the verifier is shown, and no more. */
export type SchoolClip = {
  id: string;
  blobUrl: string;
  capturedAt: string;
  /** False means the file's own timestamp said it was not filmed in the app just now, which
   *  the verifier sees too. Shown to the school for the same reason: a mark applied in
   *  silence is a penalty nobody can answer. */
  freshCapture: boolean;
  hasLocation: boolean;
};

/**
 * One recording task, as the person holding the phone needs it.
 *
 * The framework's title alone ("4.1 Separate functional toilets for girls") is a name, not an
 * instruction, and a verifier sets a level from whatever the clip happens to show. So the task
 * also carries the level the school itself claimed and SCERT's own evidence checklist for the
 * indicator, which is the authored answer to "what has to be visible". Both already existed;
 * neither reached this screen.
 */
export type SchoolTask = {
  parameterId: string;
  /** Stored on the clip so the verifier's console can label it: "4.1 Separate toilets...". */
  label: string;
  code: string;
  titleEn: string;
  titleHi: string;
  /** What this school answered in its self assessment, which is what the clip has to show. */
  claimedLevel: number | null;
  claimedLabelEn: string | null;
  claimedLabelHi: string | null;
  /** SCERT's evidence checklist for this indicator, bilingual. Empty for indicators the
   *  checklist does not cover. */
  checklistEn: string[];
  checklistHi: string[];
  /** The clip that stands as this task's answer, and how many attempts came before it. Every
   *  attempt stays on the record; the verifier sees them all. */
  clip: SchoolClip | null;
  earlierAttempts: number;
};

export type SchoolWalkthroughView = {
  sessionId: string;
  /** The verifier as the school sees them: a pseudonym, never a name or a face. */
  verifierId: string;
  mode: 'LIVE' | 'GUIDED_CAPTURE';
  scheduledFor: string | null;
  startedAt: string | null;
  guidedCaptureDeadline: string | null;
  /** Nothing more can be sent, whatever is still missing. */
  windowClosed: boolean;
  geofenceAnchored: boolean;
  /** Guided capture tasks: one per disputed indicator, plus what has been recorded. */
  tasks: SchoolTask[];
};

export async function getMySchoolWalkthrough(): Promise<SchoolWalkthroughView | null> {
  const actor = await requireSchool();
  if (!actor) return null;

  const session = await prisma.walkthroughSession.findFirst({
    where: {
      recusedAt: null,
      endedAt: null,
      conflictDeclaredAt: { not: null },
      run: { schoolUdise: actor.schoolUdise, state: 'VIDEO_WALKTHROUGH' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      profile: { select: { pseudonym: true } },
      clips: {
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          parameterId: true,
          blobUrl: true,
          capturedAt: true,
          freshCapture: true,
          lat: true,
          lng: true,
        },
      },
      run: {
        select: {
          id: true,
          cycleId: true,
          schoolUdise: true,
          school: { select: { geoLat: true, geoLng: true } },
        },
      },
    },
  });
  if (!session) return null;

  const disputed = await disputedParameterIds(session.run.id);
  const [parameters, submission] = await Promise.all([
    disputed.length
      ? prisma.parameter.findMany({
          where: { id: { in: disputed } },
          select: {
            id: true,
            code: true,
            titleEn: true,
            titleHi: true,
            evidenceChecklistEn: true,
            evidenceChecklistHi: true,
            options: { where: { isActive: true }, orderBy: { order: 'asc' } },
          },
          orderBy: { code: 'asc' },
        })
      : Promise.resolve([]),
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: session.run.cycleId, schoolUdise: session.run.schoolUdise } },
      select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
  ]);
  const claimBy = new Map((submission?.responses ?? []).map((r) => [r.parameterId, r.selectedOptionKey]));

  // Latest attempt per task, with the earlier ones counted rather than hidden.
  const clipsBy = new Map<string, (typeof session.clips)[number][]>();
  for (const clip of session.clips) {
    if (!clip.parameterId) continue;
    clipsBy.set(clip.parameterId, [...(clipsBy.get(clip.parameterId) ?? []), clip]);
  }

  return {
    sessionId: session.id,
    verifierId: session.profile.pseudonym,
    mode: session.mode,
    scheduledFor: session.scheduledFor?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    guidedCaptureDeadline: session.guidedCaptureDeadline?.toISOString() ?? null,
    windowClosed:
      session.guidedCaptureDeadline !== null && Date.now() > session.guidedCaptureDeadline.getTime(),
    geofenceAnchored: session.run.school.geoLat !== null && session.run.school.geoLng !== null,
    tasks: parameters.map((p) => {
      const attempts = clipsBy.get(p.id) ?? [];
      const latest = attempts[attempts.length - 1];
      const claimed = p.options.find((o) => o.key === claimBy.get(p.id));
      return {
        parameterId: p.id,
        label: `${p.code} ${p.titleEn}`,
        code: p.code,
        titleEn: p.titleEn,
        titleHi: p.titleHi,
        claimedLevel: claimed?.order ?? null,
        claimedLabelEn: claimed?.labelEn ?? null,
        claimedLabelHi: claimed?.labelHi ?? null,
        checklistEn: (p.evidenceChecklistEn as string[]) ?? [],
        checklistHi: (p.evidenceChecklistHi as string[]) ?? [],
        clip: latest
          ? {
              id: latest.id,
              blobUrl: latest.blobUrl,
              capturedAt: latest.capturedAt.toISOString(),
              freshCapture: latest.freshCapture,
              hasLocation: latest.lat !== null && latest.lng !== null,
            }
          : null,
        earlierAttempts: Math.max(0, attempts.length - 1),
      };
    }),
  };
}

async function mySchoolSession(sessionId: string) {
  const actor = await requireSchool();
  if (!actor) return null;
  const session = await prisma.walkthroughSession.findFirst({
    where: { id: sessionId, recusedAt: null, run: { schoolUdise: actor.schoolUdise } },
    include: { run: { select: { id: true, school: { select: { geoLat: true, geoLng: true } } } } },
  });
  return session;
}

/**
 * The school's heartbeat during a live session: location for the fence, and whether the
 * connection is holding. The fence is a one-way ratchet within a session: once outside,
 * `geofenceHeld` stays false, because "stayed inside throughout" is the fact the record
 * keeps. Two consecutive failed checks drop the session to guided capture with its time
 * box, per the brief.
 */
export async function recordSchoolPing(
  sessionId: string,
  ping: { lat: number | null; lng: number | null; connectionOk: boolean },
): Promise<{ success: boolean; mode?: string; error?: string }> {
  const session = await mySchoolSession(sessionId);
  if (!session) return { success: false, error: 'Session not available.' };
  if (session.endedAt || session.mode !== 'LIVE' || !session.startedAt) {
    return { success: true, mode: session.mode };
  }

  const registered = { lat: session.run.school.geoLat, lng: session.run.school.geoLng };
  let lastGeofenceMetres = session.lastGeofenceMetres;
  let geofenceHeld = session.geofenceHeld;
  if (ping.lat !== null && ping.lng !== null) {
    const reading = fenceReading(registered, { lat: ping.lat, lng: ping.lng });
    if (reading.status !== 'UNANCHORED') {
      lastGeofenceMetres = reading.metres;
      if (reading.status === 'OUTSIDE') geofenceHeld = false;
      else if (geofenceHeld === null) geofenceHeld = true;
    }
  }

  const { failures, dropToGuidedCapture } = connectivityAfter(
    session.connectivityFailures,
    ping.connectionOk,
  );

  await prisma.walkthroughSession.update({
    where: { id: session.id },
    data: {
      lastGeofenceMetres,
      geofenceHeld,
      connectivityFailures: failures,
      ...(dropToGuidedCapture
        ? {
            mode: 'GUIDED_CAPTURE',
            guidedCaptureDeadline: new Date(Date.now() + GUIDED_CAPTURE_HOURS * 3_600_000),
          }
        : {}),
    },
  });

  return { success: true, mode: dropToGuidedCapture ? 'GUIDED_CAPTURE' : session.mode };
}

export async function saveWalkthroughClip(
  sessionId: string,
  clip: {
    parameterId: string | null;
    taskLabel: string;
    blobUrl: string;
    lat: number | null;
    lng: number | null;
    fileLastModifiedMs: number;
    /** When the app took hold of the file, by the device's clock. A clip that waited hours for
     *  signal is still judged on when it was filmed. Defaults to arrival for older callers. */
    filmedAtMs?: number;
  },
): Promise<{ success: boolean; error?: string }> {
  const session = await mySchoolSession(sessionId);
  if (!session) return { success: false, error: 'Session not available.' };
  if (session.mode !== 'GUIDED_CAPTURE') {
    return { success: false, error: 'Videos belong to a recording task, not a live session.' };
  }
  if (session.endedAt) return { success: false, error: 'This session has ended.' };
  if (session.guidedCaptureDeadline && Date.now() > session.guidedCaptureDeadline.getTime()) {
    return { success: false, error: 'The capture window has closed. The verifier decides on what was recorded in time.' };
  }
  if (!clip.taskLabel.trim() || !clip.blobUrl) return { success: false, error: 'Video incomplete.' };

  // The strongest pre-recording check a browser allows: the file's own modification time,
  // against the moment the app took it. A clip recorded in the app moments ago carries a
  // timestamp moments old; a gallery file carries its original one. Recorded as a flag the
  // verifier sees rather than a hard refusal, because clocks on cheap devices are wrong often
  // enough to make a hard refusal eat honest clips.
  const now = Date.now();
  const filmedAtMs = clip.filmedAtMs ?? now;

  await prisma.walkthroughClip.create({
    data: {
      sessionId: session.id,
      parameterId: clip.parameterId,
      taskLabel: clip.taskLabel.trim(),
      blobUrl: clip.blobUrl,
      lat: clip.lat,
      lng: clip.lng,
      freshCapture: isFreshCapture(clip.fileLastModifiedMs, filmedAtMs),
      capturedAt: clipCapturedAt(filmedAtMs, session.createdAt.getTime(), now),
    },
  });

  revalidatePath('/app/school/walkthrough');
  return { success: true };
}

/** Whether the school's pin is registered, for the page to offer capture before any
 *  session exists: a pin set in calm times anchors the fence better than one set mid-dispute. */
export async function getMySchoolLocationState(): Promise<{ anchored: boolean; capturedAt: string | null } | null> {
  const actor = await requireSchool();
  if (!actor) return null;
  const school = await prisma.school.findUnique({
    where: { udise: actor.schoolUdise },
    select: { geoLat: true, geoCapturedAt: true },
  });
  if (!school) return null;
  return { anchored: school.geoLat !== null, capturedAt: school.geoCapturedAt?.toISOString() ?? null };
}

/**
 * The school's registered pin, captured once. Immutable from the school's side after
 * capture: a fence anchored to a pin the school can move is not a fence. The coordinates
 * come from the browser's geolocation, which a determined actor can spoof; the honest
 * claim is "captured from a device at registration time", not "attested".
 */
export async function recordSchoolLocation(
  lat: number,
  lng: number,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireSchool();
  if (!actor) return { success: false, error: 'Not authorised.' };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { success: false, error: 'Those coordinates are not on the map.' };
  }

  const result = await prisma.school.updateMany({
    where: { udise: actor.schoolUdise, geoLat: null },
    data: { geoLat: lat, geoLng: lng, geoCapturedAt: new Date() },
  });
  if (result.count === 0) {
    return { success: false, error: 'Your school\'s location is already registered. Ask SSSA to correct it if it is wrong.' };
  }
  revalidatePath('/app/school/walkthrough');
  return { success: true };
}
