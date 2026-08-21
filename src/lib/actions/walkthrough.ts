'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireSchool, requireVerifier } from '@/lib/authz';
import { maskSchool } from '@/lib/verification/masking';
import {
  canResolve,
  connectivityAfter,
  fenceReading,
  GUIDED_CAPTURE_HOURS,
} from '@/lib/verification/walkthroughRules';
import { transitionRun } from '@/lib/verification/stateMachine';
import type { WalkthroughOutcome } from '@prisma/client';

/**
 * The video walkthrough: the online track's last instrument before a case either joins the
 * census queue or forces a field visit.
 *
 * Anonymity here is one-way and the code says which way. The school never learns the
 * verifier: prompts are pushed as text under a pseudonym, and nothing in the school-side
 * payload carries a name. The verifier does learn the school, at a recorded moment, after
 * a conflict declaration, because a live camera shows the building whatever a masked code
 * says; BRIEF_REVIEW section 3 records why this is disclosed rather than pretended away.
 *
 * The live video transport itself is not wired in this environment. Everything around the
 * pane is real: the session lifecycle, the geofence arithmetic, the connectivity rule that
 * drops to guided capture, the prompt queue, the observations and the routing.
 */

async function myOnlineProfile() {
  const actor = await requireVerifier();
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
  category: string;
  enteredStateAt: string;
  /** enteredStateAt plus the configured turnaround. */
  dueBy: string;
  overdue: boolean;
  mine: boolean;
  sessionState: 'NOT_STARTED' | 'SCHEDULED' | 'LIVE' | 'GUIDED_CAPTURE' | 'ENDED';
  scheduledFor: string | null;
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
      school: { select: { udise: true, category: true } },
      walkthroughs: {
        where: { recusedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { scheduledFor: true, startedAt: true, endedAt: true, mode: true },
      },
    },
    orderBy: { enteredStateAt: 'asc' },
    take: 200,
  });

  const now = Date.now();
  return runs.map((r) => {
    const session = r.walkthroughs[0];
    const dueBy = new Date(r.enteredStateAt.getTime() + turnaroundDays * 86_400_000);
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
      prompts: { id: string; body: string; sentAt: string; acknowledgedAt: string | null }[];
      clips: {
        id: string;
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
        select: { udise: true, nameEn: true, category: true, geoLat: true, geoLng: true, district: { select: { nameEn: true } } },
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
  const [parameters, submission, observations, prompts, clips] = await Promise.all([
    prisma.parameter.findMany({
      where: { id: { in: disputed } },
      include: { options: { orderBy: { order: 'asc' } } },
    }),
    prisma.selfAssessmentSubmission.findUnique({
      where: { cycleId_schoolUdise: { cycleId: run.cycleId, schoolUdise: run.schoolUdise } },
      select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
    }),
    prisma.walkthroughObservation.findMany({ where: { sessionId: session.id } }),
    prisma.walkthroughPrompt.findMany({ where: { sessionId: session.id }, orderBy: { sentAt: 'asc' } }),
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
  const observationBy = new Map(observations.map((o) => [o.parameterId, o.note]));

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
        observationNote: observationBy.get(p.id) ?? null,
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
    prompts: prompts.map((p) => ({
      id: p.id,
      body: p.body,
      sentAt: p.sentAt.toISOString(),
      acknowledgedAt: p.acknowledgedAt?.toISOString() ?? null,
    })),
    clips: clips.map((c) => ({
      id: c.id,
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

export async function pushPrompt(runId: string, body: string): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (!mine.session.startedAt || mine.session.endedAt) {
    return { success: false, error: 'Prompts go to a running session.' };
  }
  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: 'Write the instruction.' };
  await prisma.walkthroughPrompt.create({ data: { sessionId: mine.session.id, body: trimmed } });
  revalidatePath(`/app/verifier/walkthrough/${runId}`);
  return { success: true };
}

export async function saveObservation(
  runId: string,
  parameterId: string,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const mine = await mySession(runId);
  if (!mine) return { success: false, error: 'Case not available.' };
  if (mine.session.endedAt) return { success: false, error: 'This session has ended.' };
  if (!mine.session.conflictDeclaredAt) return { success: false, error: 'Declare conflicts first.' };
  const trimmed = note.trim();
  if (!trimmed) return { success: false, error: 'Write what you observed.' };

  await prisma.walkthroughObservation.upsert({
    where: { sessionId_parameterId: { sessionId: mine.session.id, parameterId } },
    create: { sessionId: mine.session.id, parameterId, note: trimmed },
    update: { note: trimmed },
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
      select: { parameterId: true },
    }),
  ]);

  const check = canResolve(
    outcome,
    disputed,
    observations.map((o) => o.parameterId),
    outcomeNote,
  );
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

  revalidatePath('/app/verifier/walkthroughs');
  return { success: true, routedTo: next };
}

// ─────────────────────────────────────────────────────────────────────────────
// School side
// ─────────────────────────────────────────────────────────────────────────────

export type SchoolWalkthroughView = {
  sessionId: string;
  /** The verifier as the school sees them: a pseudonym, never a name. */
  verifierId: string;
  mode: 'LIVE' | 'GUIDED_CAPTURE';
  scheduledFor: string | null;
  startedAt: string | null;
  guidedCaptureDeadline: string | null;
  geofenceAnchored: boolean;
  prompts: { id: string; body: string; sentAt: string; acknowledgedAt: string | null }[];
  /** Guided capture tasks: one per disputed indicator, plus what has been recorded. */
  tasks: { parameterId: string; label: string; done: boolean }[];
  clips: { taskLabel: string; capturedAt: string }[];
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
      prompts: { orderBy: { sentAt: 'asc' } },
      clips: { orderBy: { capturedAt: 'asc' }, select: { parameterId: true, taskLabel: true, capturedAt: true } },
      run: { select: { id: true, school: { select: { geoLat: true, geoLng: true } } } },
    },
  });
  if (!session) return null;

  const disputed = await disputedParameterIds(session.run.id);
  const parameters = disputed.length
    ? await prisma.parameter.findMany({
        where: { id: { in: disputed } },
        select: { id: true, code: true, titleEn: true },
        orderBy: { code: 'asc' },
      })
    : [];
  const doneParameterIds = new Set(session.clips.map((c) => c.parameterId).filter(Boolean));

  return {
    sessionId: session.id,
    verifierId: session.profile.pseudonym,
    mode: session.mode,
    scheduledFor: session.scheduledFor?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    guidedCaptureDeadline: session.guidedCaptureDeadline?.toISOString() ?? null,
    geofenceAnchored: session.run.school.geoLat !== null && session.run.school.geoLng !== null,
    prompts: session.prompts.map((p) => ({
      id: p.id,
      body: p.body,
      sentAt: p.sentAt.toISOString(),
      acknowledgedAt: p.acknowledgedAt?.toISOString() ?? null,
    })),
    tasks: parameters.map((p) => ({
      parameterId: p.id,
      label: `${p.code} ${p.titleEn}`,
      done: doneParameterIds.has(p.id),
    })),
    clips: session.clips.map((c) => ({ taskLabel: c.taskLabel, capturedAt: c.capturedAt.toISOString() })),
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

export async function acknowledgePrompt(promptId: string): Promise<{ success: boolean }> {
  const actor = await requireSchool();
  if (!actor) return { success: false };
  await prisma.walkthroughPrompt.updateMany({
    where: { id: promptId, acknowledgedAt: null, session: { run: { schoolUdise: actor.schoolUdise } } },
    data: { acknowledgedAt: new Date() },
  });
  return { success: true };
}

/** How stale a file's own timestamp may be before the upload is flagged as pre-recorded. */
const FRESH_CAPTURE_WINDOW_MS = 10 * 60 * 1000;

export async function saveWalkthroughClip(
  sessionId: string,
  clip: {
    parameterId: string | null;
    taskLabel: string;
    blobUrl: string;
    lat: number | null;
    lng: number | null;
    fileLastModifiedMs: number;
  },
): Promise<{ success: boolean; error?: string }> {
  const session = await mySchoolSession(sessionId);
  if (!session) return { success: false, error: 'Session not available.' };
  if (session.mode !== 'GUIDED_CAPTURE') {
    return { success: false, error: 'Clips belong to a guided capture task, not a live session.' };
  }
  if (session.endedAt) return { success: false, error: 'This session has ended.' };
  if (session.guidedCaptureDeadline && Date.now() > session.guidedCaptureDeadline.getTime()) {
    return { success: false, error: 'The capture window has closed. The verifier decides on what was recorded in time.' };
  }
  if (!clip.taskLabel.trim() || !clip.blobUrl) return { success: false, error: 'Clip incomplete.' };

  // The strongest pre-recording check a browser allows: the file's own modification time.
  // A clip recorded in the app moments ago carries a timestamp moments old; a gallery file
  // carries its original one. Recorded as a flag the verifier sees rather than a hard
  // refusal, because clocks on cheap devices are wrong often enough to make a hard refusal
  // eat honest clips.
  const freshCapture = Math.abs(Date.now() - clip.fileLastModifiedMs) < FRESH_CAPTURE_WINDOW_MS;

  await prisma.walkthroughClip.create({
    data: {
      sessionId: session.id,
      parameterId: clip.parameterId,
      taskLabel: clip.taskLabel.trim(),
      blobUrl: clip.blobUrl,
      lat: clip.lat,
      lng: clip.lng,
      freshCapture,
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
