import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fills the verification pipeline with demonstration cases so every screen built in steps
 * 2 to 9 shows real content instead of its empty state.
 *
 * Until this existed, the workforce could log in and see nothing: the queues read from
 * AssessmentCycleRun and its satellites, and no seed ever created a run. This one lays out
 * the whole pipeline the way a mid-cycle day would look:
 *
 *   online1   a desk batch (some started, one frozen by escalation), four walkthroughs in
 *             four states (undeclared, scheduled, live with prompts, guided capture)
 *   online2   a smaller desk batch and one escalation
 *   field1    two visits revealed today (one mid-visit) and two still sealed
 *   field2    two sealed visits, plus the audited history the de-empanelment board needs
 *   supervisors  escalations, discrepancy cases, a school response to rule on, turnaround
 *   audit1    unclaimed sample cases, one in progress, one awaiting the verdict, and
 *             candidates left for the draw button
 *   school    a response window with proposed corrections, and a walkthrough session
 *
 * Deterministic (hash of udise and parameter, no randomness) and guarded: the marker
 * transition it writes is checked on the next run, so a redeploy does not double the
 * pipeline. Demo dates age naturally; sealed visits reveal themselves over the following
 * days, which is itself a demonstration of the reveal gate.
 */

const MARKER = 'demo-pipeline';

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 999983;
  return h;
}

const CATEGORY_TO_CODE: Record<string, string> = {
  Primary: 'PRIMARY',
  'Upper Primary': 'UPPER_PRIMARY',
  Secondary: 'SECONDARY',
};

const DAY = 86_400_000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** 07:00 IST on the day `daysFromToday` days from today. */
function revealAtIst(daysFromToday: number): Date {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const midnightUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  return new Date(midnightUtc + daysFromToday * DAY + 7 * 3_600_000);
}

async function main() {
  const marker = await prisma.cycleTransition.findFirst({ where: { systemReason: MARKER } });
  if (marker) {
    console.log('pipeline demo: already seeded, leaving it alone');
    return;
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return console.log('pipeline demo: no active cycle');
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) return console.log('pipeline demo: no framework');

  const profiles = new Map<string, string>();
  for (const username of ['online1', 'online2', 'field1', 'field2', 'audit1']) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, verifierProfile: { select: { id: true } } },
    });
    if (!user) return console.log(`pipeline demo: ${username} missing, run the workforce seed first`);
    if (user.verifierProfile) {
      profiles.set(username, user.verifierProfile.id);
    } else if (username === 'audit1') {
      // The audit profile is normally created at first claim; the demo claims cases for it.
      const created = await prisma.verifierProfile.create({
        data: { userId: user.id, cell: 'FIELD', workforceSource: 'EMPANELLED', pseudonym: 'AUD-DEMO1' },
        select: { id: true },
      });
      profiles.set(username, created.id);
    } else {
      return console.log(`pipeline demo: ${username} has no profile, run the workforce seed first`);
    }
  }
  const online1 = profiles.get('online1')!;
  const online2 = profiles.get('online2')!;
  const field1 = profiles.get('field1')!;
  const field2 = profiles.get('field2')!;
  const audit1 = profiles.get('audit1')!;
  const field1User = await prisma.user.findUnique({ where: { username: 'field1' }, select: { id: true } });

  const rubric = await prisma.riskRubric.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!rubric) return console.log('pipeline demo: no active rubric');

  const parameters = await prisma.parameter.findMany({
    where: { frameworkId: framework.id, isActive: true },
    select: {
      id: true,
      code: true,
      applicability: true,
      checkMethod: true,
      externalSource: true,
      options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { key: true, order: true } },
    },
    orderBy: { code: 'asc' },
  });
  if (parameters.length === 0) return console.log('pipeline demo: no parameters');

  const applicableFor = (category: string) => {
    const code = CATEGORY_TO_CODE[category] ?? 'PRIMARY';
    return parameters.filter((p) => (p.applicability as string[]).includes(code));
  };

  // ── The school pool ─────────────────────────────────────────────────────────
  // Schools that already have a submitted self-assessment and no run yet come first; the
  // pool is topped up by writing deterministic submissions for register schools.
  const NEEDED = 63;

  const existingRuns = await prisma.assessmentCycleRun.findMany({
    where: { cycleId: cycle.id },
    select: { schoolUdise: true },
  });
  const hasRun = new Set(existingRuns.map((r) => r.schoolUdise));

  const submitted = await prisma.selfAssessmentSubmission.findMany({
    where: { cycleId: cycle.id, status: 'SUBMITTED', schoolUdise: { not: 'school' } },
    select: { schoolUdise: true, school: { select: { udise: true, category: true, districtCode: true } } },
    orderBy: { schoolUdise: 'asc' },
    take: 120,
  });
  const pool: { udise: string; category: string; districtCode: string }[] = submitted
    .filter((s) => !hasRun.has(s.schoolUdise))
    .map((s) => ({ udise: s.school.udise, category: s.school.category, districtCode: s.school.districtCode }));

  if (pool.length < NEEDED) {
    const have = new Set(pool.map((p) => p.udise));
    const more = await prisma.school.findMany({
      where: {
        udise: { notIn: [...have, 'school', ...hasRun] },
        selfAssessments: { none: { cycleId: cycle.id } },
      },
      select: { udise: true, category: true, districtCode: true },
      orderBy: { udise: 'asc' },
      take: NEEDED - pool.length,
    });
    for (const school of more) {
      const applicable = applicableFor(school.category);
      const submission = await prisma.selfAssessmentSubmission.create({
        data: {
          cycleId: cycle.id,
          schoolUdise: school.udise,
          frameworkId: framework.id,
          status: 'SUBMITTED',
          startedAt: new Date(Date.now() - 40 * DAY),
          submittedAt: new Date(Date.now() - 30 * DAY),
        },
      });
      await prisma.selfAssessmentResponse.createMany({
        data: applicable.map((p) => {
          const options = p.options;
          const pick = options[hash(school.udise + p.code) % options.length] ?? options[0]!;
          return { submissionId: submission.id, parameterId: p.id, selectedOptionKey: pick.key };
        }),
      });
      pool.push(school);
    }
  }
  if (pool.length < NEEDED) {
    console.log(`pipeline demo: only ${pool.length} schools available of ${NEEDED} planned, scaling down`);
  }

  let cursor = 0;
  const take = (n: number) => pool.slice(cursor, (cursor += n));

  const claims = new Map<string, Map<string, number>>();
  async function claimedLevels(udise: string): Promise<Map<string, number>> {
    if (!claims.has(udise)) {
      const submission = await prisma.selfAssessmentSubmission.findUnique({
        where: { cycleId_schoolUdise: { cycleId: cycle!.id, schoolUdise: udise } },
        select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
      });
      const byParam = new Map<string, number>();
      const optionOrder = new Map(
        parameters.flatMap((p) => p.options.map((o) => [`${p.id}:${o.key}`, o.order] as const)),
      );
      for (const r of submission?.responses ?? []) {
        byParam.set(r.parameterId, optionOrder.get(`${r.parameterId}:${r.selectedOptionKey}`) ?? 1);
      }
      claims.set(udise, byParam);
    }
    return claims.get(udise)!;
  }

  const intakeYear = new Date().getFullYear();
  async function createRun(
    school: { udise: string },
    state:
      | 'DESK_SCREENING'
      | 'VIDEO_WALKTHROUGH'
      | 'CENSUS_QUEUE'
      | 'FIELD_COHORT'
      | 'FIELD_VISIT'
      | 'DISCREPANCY_REVIEW'
      | 'SCHOOL_RESPONSE_WINDOW'
      | 'PUBLISHED',
    opts: { assignee?: string; enteredDaysAgo?: number; publishedDaysAgo?: number } = {},
  ) {
    const enteredStateAt = new Date(Date.now() - (opts.enteredDaysAgo ?? 3) * DAY);
    const run = await prisma.assessmentCycleRun.create({
      data: {
        cycleId: cycle!.id,
        schoolUdise: school.udise,
        state,
        intakeYear,
        enteredStateAt,
        submittedAt: new Date(Date.now() - 30 * DAY),
        deskAssigneeProfileId: opts.assignee ?? null,
        publishedAt: state === 'PUBLISHED' ? new Date(Date.now() - (opts.publishedDaysAgo ?? 10) * DAY) : null,
      },
    });
    await prisma.cycleTransition.create({
      data: { runId: run.id, fromState: 'AUTO_CHECK', toState: state, systemReason: MARKER, createdAt: enteredStateAt },
    });
    return run;
  }

  /** MATCH for most AUTO indicators, a deterministic few MISMATCH, occasional gap. */
  async function seedAutoChecks(runId: string, udise: string, category: string) {
    const auto = applicableFor(category).filter((p) => p.checkMethod === 'AUTO');
    await prisma.autoCheckResult.createMany({
      data: auto.map((p) => {
        const roll = hash(udise + p.code) % 12;
        const outcome = roll < 9 ? 'MATCH' : roll < 11 ? 'MISMATCH' : 'NOT_CHECKABLE';
        return {
          runId,
          parameterId: p.id,
          outcome,
          source: p.externalSource,
          selfReportedValue: outcome === 'MISMATCH' ? 'Level as claimed' : null,
          externalValue: outcome === 'MISMATCH' ? 'Source disagrees' : null,
          sourceReadAt: new Date(Date.now() - 5 * DAY),
        };
      }),
      skipDuplicates: true,
    });
    return auto;
  }

  // ── Desk screening batches ─────────────────────────────────────────────────
  const RATIONALES = [
    'The uploaded photograph shows the room but not the claimed equipment.',
    'The register pages uploaded are from last year and do not cover this claim.',
    'Certificate present and legible; issue date within the cycle.',
    'The document uploaded describes a different indicator entirely.',
  ];

  const deskBatch: { school: (typeof pool)[number]; assignee: string | null; decide: number; escalate: boolean }[] = [
    ...take(8).map((s, i) => ({ school: s, assignee: online1, decide: i < 3 ? 20 : 0, escalate: false })),
    ...take(6).map((s, i) => ({ school: s, assignee: online2, decide: i < 2 ? 12 : 0, escalate: false })),
    ...take(6).map((s) => ({ school: s, assignee: null, decide: 0, escalate: false })),
    ...take(1).map((s) => ({ school: s, assignee: online1, decide: 8, escalate: true })),
    ...take(1).map((s) => ({ school: s, assignee: online2, decide: 5, escalate: true })),
  ];
  for (const item of deskBatch) {
    const run = await createRun(item.school, 'DESK_SCREENING', {
      assignee: item.assignee ?? undefined,
      enteredDaysAgo: 2 + (hash(item.school.udise) % 6),
    });
    await seedAutoChecks(run.id, item.school.udise, item.school.category);
    if (item.decide > 0 && item.assignee) {
      const manual = applicableFor(item.school.category).filter((p) => p.checkMethod === 'MANUAL');
      const chosen = manual.slice(0, item.decide);
      await prisma.deskScreeningDecision.createMany({
        data: chosen.map((p, i) => {
          const roll = hash(item.school.udise + p.code) % 10;
          const decision =
            roll < 7 ? 'EVIDENCE_SUPPORTS_LEVEL' : roll < 8 ? 'EVIDENCE_INSUFFICIENT' : roll < 9 ? 'EVIDENCE_MISSING' : 'EVIDENCE_CONTRADICTS_LEVEL';
          const escalate = item.escalate && i === 0;
          return {
            runId: run.id,
            parameterId: p.id,
            profileId: item.assignee!,
            decision: escalate ? 'EVIDENCE_INSUFFICIENT' : decision,
            rationale:
              decision === 'EVIDENCE_SUPPORTS_LEVEL' && !escalate
                ? null
                : escalate
                  ? 'The evidence shows partial compliance and the rubric level descriptions do not cover a partial case. I cannot cleanly apply either level.'
                  : RATIONALES[roll % RATIONALES.length],
            escalated: escalate,
            escalatedAt: escalate ? new Date(Date.now() - 1 * DAY) : null,
          };
        }),
        skipDuplicates: true,
      });
    }
  }

  // ── Walkthroughs, four states for online1 plus two unassigned ─────────────
  const walkthroughSchools = take(6);
  const walkthroughRuns: { runId: string; udise: string; category: string }[] = [];
  for (const [i, school] of walkthroughSchools.entries()) {
    const assignee = i < 4 ? online1 : null;
    const run = await createRun(school, 'VIDEO_WALKTHROUGH', { assignee: assignee ?? undefined, enteredDaysAgo: 2 + i });
    await seedAutoChecks(run.id, school.udise, school.category);
    // The disputed list the console shows: a handful of non-accepting desk decisions.
    const manual = applicableFor(school.category).filter((p) => p.checkMethod === 'MANUAL');
    const disputed = manual.filter((p) => hash(school.udise + p.code) % 9 === 0).slice(0, 5);
    const supporter = assignee ?? online1;
    await prisma.deskScreeningDecision.createMany({
      data: manual.map((p) => {
        const isDisputed = disputed.some((d) => d.id === p.id);
        return {
          runId: run.id,
          parameterId: p.id,
          profileId: supporter,
          decision: isDisputed ? 'EVIDENCE_CONTRADICTS_LEVEL' : 'EVIDENCE_SUPPORTS_LEVEL',
          rationale: isDisputed ? 'The uploaded evidence shows a lower state than the claimed level describes.' : null,
        };
      }),
      skipDuplicates: true,
    });
    await prisma.riskScore.create({
      data: {
        runId: run.id,
        rubricId: rubric.id,
        score: 34 + (hash(school.udise) % 20),
        band: 'HIGH',
        aboveThreshold: true,
        autoCheckedCount: 25,
        manualDecidedCount: manual.length,
        applicableCount: applicableFor(school.category).length,
        computedAt: new Date(Date.now() - (2 + i) * DAY),
      },
    });
    walkthroughRuns.push({ runId: run.id, udise: school.udise, category: school.category });
  }
  // Session states: [0] no session (declaration gate), [1] scheduled, [2] live, [3] guided capture.
  const scheduled = await prisma.walkthroughSession.create({
    data: {
      runId: walkthroughRuns[1]!.runId,
      profileId: online1,
      conflictDeclaredAt: new Date(Date.now() - 1 * DAY),
      identityDisclosedAt: new Date(Date.now() - 1 * DAY),
      scheduledFor: new Date(Date.now() + 1 * DAY),
    },
  });
  void scheduled;
  const live = await prisma.walkthroughSession.create({
    data: {
      runId: walkthroughRuns[2]!.runId,
      profileId: online1,
      conflictDeclaredAt: new Date(Date.now() - 2 * 3_600_000),
      identityDisclosedAt: new Date(Date.now() - 2 * 3_600_000),
      startedAt: new Date(Date.now() - 40 * 60_000),
      lastGeofenceMetres: 45,
      geofenceHeld: true,
    },
  });
  await prisma.walkthroughPrompt.createMany({
    data: [
      { sessionId: live.id, body: 'Please show the main entrance and the school name board.', sentAt: new Date(Date.now() - 35 * 60_000), acknowledgedAt: new Date(Date.now() - 34 * 60_000) },
      { sessionId: live.id, body: 'Walk to the library shelf and open the issue register.', sentAt: new Date(Date.now() - 20 * 60_000), acknowledgedAt: new Date(Date.now() - 19 * 60_000) },
      { sessionId: live.id, body: 'Show the toilets, inside and out.', sentAt: new Date(Date.now() - 5 * 60_000) },
    ],
  });
  const liveDisputed = await prisma.deskScreeningDecision.findMany({
    where: { runId: walkthroughRuns[2]!.runId, decision: { not: 'EVIDENCE_SUPPORTS_LEVEL' } },
    select: { parameterId: true },
    take: 2,
  });
  await prisma.walkthroughObservation.createMany({
    data: liveDisputed.map((d, i) => ({
      sessionId: live.id,
      parameterId: d.parameterId,
      note: i === 0 ? 'Seen on camera; the room exists and matches the claim.' : 'Shown only from the doorway; could not confirm the equipment claimed.',
    })),
  });
  await prisma.walkthroughSession.create({
    data: {
      runId: walkthroughRuns[3]!.runId,
      profileId: online1,
      mode: 'GUIDED_CAPTURE',
      conflictDeclaredAt: new Date(Date.now() - 1 * DAY),
      identityDisclosedAt: new Date(Date.now() - 1 * DAY),
      startedAt: new Date(Date.now() - 1 * DAY),
      connectivityFailures: 2,
      guidedCaptureDeadline: new Date(Date.now() + 1 * DAY),
    },
  });

  // ── Census queue, for the publish button ───────────────────────────────────
  for (const school of take(6)) {
    const run = await createRun(school, 'CENSUS_QUEUE', { assignee: online1, enteredDaysAgo: 1 + (hash(school.udise) % 4) });
    await seedAutoChecks(run.id, school.udise, school.category);
  }

  // ── Field visits ───────────────────────────────────────────────────────────
  async function createVisit(
    school: (typeof pool)[number],
    profileId: string,
    revealDays: number,
    opts: { arrived?: boolean; findings?: 'none' | 'partial' | 'signedOff'; signedDaysAgo?: number } = {},
  ) {
    const state: 'DISCREPANCY_REVIEW' | 'FIELD_VISIT' =
      opts.findings === 'signedOff' ? 'DISCREPANCY_REVIEW' : 'FIELD_VISIT';
    const run = await createRun(school, state, { enteredDaysAgo: Math.max(0, -revealDays) });
    const revealAt = revealAtIst(revealDays);
    const notifiedDate = new Date(revealAt.getTime() - 7 * 3_600_000 + 12 * 3_600_000);
    const visit = await prisma.fieldVisit.create({
      data: {
        runId: run.id,
        profileId,
        districtCode: school.districtCode,
        travelWindowStart: new Date(revealAt.getTime() - 2 * DAY),
        travelWindowEnd: new Date(revealAt.getTime() + 3 * DAY),
        notifiedDate,
        revealAt,
        conflictDeclaredAt: revealDays <= 0 && opts.arrived ? new Date(revealAt.getTime() + 3_600_000) : null,
        arrivedAt: opts.arrived ? new Date(revealAt.getTime() + 2 * 3_600_000) : null,
      },
    });
    const levels = await claimedLevels(school.udise);
    if (opts.findings === 'partial') {
      const some = [...levels.entries()].slice(0, 12);
      await prisma.fieldFinding.createMany({
        data: some.map(([parameterId, level]) => ({ visitId: visit.id, parameterId, observedLevel: level })),
      });
    }
    if (opts.findings === 'signedOff') {
      const entries = [...levels.entries()];
      let discrepant = entries.filter(([pid]) => hash(school.udise + pid) % 14 === 0).slice(0, 4);
      // Every signed-off demo visit carries at least two disputes, or the review queue would
      // hold cases with nothing to rule on.
      if (discrepant.length < 2) discrepant = entries.slice(0, 2);
      const discrepantIds = new Set(discrepant.map(([pid]) => pid));
      await prisma.fieldFinding.createMany({
        data: entries.map(([parameterId, level]) => ({
          visitId: visit.id,
          parameterId,
          observedLevel: discrepantIds.has(parameterId) ? Math.max(1, level - 1) : level,
          note: discrepantIds.has(parameterId) ? 'Observed condition is below the claimed level.' : null,
        })),
      });
      const signedAt = new Date(Date.now() - (opts.signedDaysAgo ?? 2) * DAY);
      await prisma.fieldVisit.update({
        where: { id: visit.id },
        data: { conflictDeclaredAt: signedAt, arrivedAt: signedAt, signedOffAt: signedAt },
      });
      for (const [parameterId, level] of discrepant) {
        await prisma.discrepancy.create({
          data: {
            runId: run.id,
            parameterId,
            claimedLevel: level,
            proposedLevel: Math.max(1, level - 1),
            basis: 'Observed on site during physical verification. The condition seen does not reach the claimed level.',
            raisedByProfileId: profileId,
            raisedAt: signedAt,
          },
        });
      }
    }
    return { run, visit };
  }

  const revealedSchools = take(2);
  await createVisit(revealedSchools[0]!, field1, 0, { arrived: true, findings: 'partial' });
  await createVisit(revealedSchools[1]!, field1, 0);
  for (const school of revealedSchools) {
    await prisma.schoolProfileDetail.upsert({
      where: { schoolUdise: school.udise },
      create: { schoolUdise: school.udise, totalStudents: 120, classesFrom: '1', classesTo: '8' },
      update: { totalStudents: 120, classesFrom: '1', classesTo: '8' },
    });
  }
  for (const school of take(2)) await createVisit(school, field1, 2);
  for (const school of take(2)) await createVisit(school, field2, 4);

  // ── Discrepancy review for the supervisor ─────────────────────────────────
  for (const school of take(3)) {
    await createVisit(school, field1, -3, { findings: 'signedOff', signedDaysAgo: 2 });
  }

  // ── School response window: one open for the demo school, one answered ────
  const storySchool = await prisma.school.findUnique({
    where: { udise: 'school' },
    select: { udise: true, category: true, districtCode: true },
  });
  if (storySchool && !hasRun.has('school')) {
    const { run } = await createVisit(storySchool, field1, -4, { findings: 'signedOff', signedDaysAgo: 3 });
    await prisma.assessmentCycleRun.update({
      where: { id: run.id },
      data: { state: 'SCHOOL_RESPONSE_WINDOW', enteredStateAt: new Date(Date.now() - 1 * DAY) },
    });
    await prisma.cycleTransition.create({
      data: { runId: run.id, fromState: 'DISCREPANCY_REVIEW', toState: 'SCHOOL_RESPONSE_WINDOW', systemReason: MARKER },
    });
  }
  const answered = take(1)[0];
  if (answered) {
    const { run } = await createVisit(answered, field1, -5, { findings: 'signedOff', signedDaysAgo: 4 });
    const entered = new Date(Date.now() - 3 * DAY);
    await prisma.assessmentCycleRun.update({
      where: { id: run.id },
      data: { state: 'SCHOOL_RESPONSE_WINDOW', enteredStateAt: entered },
    });
    await prisma.cycleTransition.create({
      data: { runId: run.id, fromState: 'DISCREPANCY_REVIEW', toState: 'SCHOOL_RESPONSE_WINDOW', systemReason: MARKER },
    });
    await prisma.schoolResponse.create({
      data: {
        runId: run.id,
        body: 'The library indicator was assessed on a day the room was being repainted and the books were boxed in the store. The purchase records and the issue register for this term are in the Evidence Manager under indicator 2.3. We request the original level be retained.',
        submittedAt: new Date(Date.now() - 1 * DAY),
        windowClosesAt: new Date(entered.getTime() + 7 * DAY),
      },
    });
  }

  // ── Published runs and the audit trail ─────────────────────────────────────
  const publishedField1 = take(8);
  const publishedRunIds: string[] = [];
  for (const [i, school] of publishedField1.entries()) {
    const { run } = await createVisit(school, field1, -20 - i * 3, { findings: 'signedOff', signedDaysAgo: 18 + i * 3 });
    await prisma.assessmentCycleRun.update({
      where: { id: run.id },
      data: { state: 'PUBLISHED', publishedAt: new Date(Date.now() - (15 + i * 3) * DAY) },
    });
    await prisma.cycleTransition.create({
      data: { runId: run.id, fromState: 'DISCREPANCY_REVIEW', toState: 'PUBLISHED', systemReason: MARKER },
    });
    await prisma.discrepancy.updateMany({
      where: { runId: run.id },
      data: { upheldAt: new Date(Date.now() - (16 + i * 3) * DAY) },
    });
    publishedRunIds.push(run.id);
  }
  // Audit cases: three unclaimed, one in progress with audit1, one awaiting the verdict.
  for (const runId of publishedRunIds.slice(0, 3)) {
    await prisma.auditCase.create({ data: { runId, sampledAt: new Date(Date.now() - 4 * DAY) } });
  }
  const inProgress = await prisma.auditCase.create({
    data: { runId: publishedRunIds[3]!, auditorProfileId: audit1, sampledAt: new Date(Date.now() - 4 * DAY) },
  });
  {
    const levels = await claimedLevels(publishedField1[3]!.udise);
    const some = [...levels.entries()].slice(0, 5);
    await prisma.auditFinding.createMany({
      data: some.map(([parameterId, level], i) => ({
        auditCaseId: inProgress.id,
        parameterId,
        observedLevel: i === 2 ? Math.max(1, level - 1) : level,
        note: i === 2 ? 'The room shown to the primary verifier is used for storage; teaching happens elsewhere.' : null,
      })),
    });
  }
  await prisma.auditCase.create({
    data: {
      runId: publishedRunIds[4]!,
      auditorProfileId: audit1,
      sampledAt: new Date(Date.now() - 6 * DAY),
      submittedAt: new Date(Date.now() - 1 * DAY),
      findingCount: 12,
      contradictionCount: 2,
    },
  });
  // publishedRunIds[5..7] stay unsampled: the draw button has candidates to draw.

  // ── The de-empanelment record: field2's audited history ───────────────────
  for (const [i, school] of take(10).entries()) {
    const { run } = await createVisit(school, field2, -60 - i * 6, { findings: 'signedOff', signedDaysAgo: 55 + i * 6 });
    await prisma.assessmentCycleRun.update({
      where: { id: run.id },
      data: { state: 'PUBLISHED', publishedAt: new Date(Date.now() - (50 + i * 6) * DAY) },
    });
    await prisma.cycleTransition.create({
      data: { runId: run.id, fromState: 'DISCREPANCY_REVIEW', toState: 'PUBLISHED', systemReason: MARKER },
    });
    const contradicted = i === 2 || i === 6;
    await prisma.auditCase.create({
      data: {
        runId: run.id,
        auditorProfileId: audit1,
        sampledAt: new Date(Date.now() - (45 + i * 6) * DAY),
        submittedAt: new Date(Date.now() - (40 + i * 6) * DAY),
        findingCount: 10,
        contradictionCount: contradicted ? 3 : 0,
        contradicted,
        reconciledAt: new Date(Date.now() - (38 + i * 6) * DAY),
        reconciliationNote: contradicted
          ? 'Three indicators re-checked on site sit two levels below the primary report. The classroom count claimed could not be reproduced on the day.'
          : null,
      },
    });
  }

  // ── Result rows for everything published ──────────────────────────────────
  // The publication table and the public pages read Result. The live pipeline computes it
  // through the domain-weighted formula at the moment of publication; these demo rows were
  // published by fiat above, so they get a proportional score from the school's own claimed
  // levels. Demo rows only, and only where no Result exists already.
  const bands = await prisma.gradeBand.findMany({
    where: { frameworkId: framework.id },
    orderBy: { order: 'asc' },
    select: { key: true, minPercent: true, maxPercent: true },
  });
  const bandFor = (score: number) => {
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i]!;
      const last = i === bands.length - 1;
      if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) return b.key;
    }
    return null;
  };
  const publishedRuns = await prisma.assessmentCycleRun.findMany({
    where: { cycleId: cycle.id, state: 'PUBLISHED', transitions: { some: { systemReason: MARKER } } },
    select: { schoolUdise: true, publishedAt: true },
  });
  for (const run of publishedRuns) {
    const levels = await claimedLevels(run.schoolUdise);
    const entries = [...levels.values()];
    if (entries.length === 0) continue;
    const maxOrder = 3;
    const percent =
      Math.round((entries.reduce((s, l) => s + (l - 1), 0) / (entries.length * (maxOrder - 1))) * 1000) / 10;
    await prisma.result.upsert({
      where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise: run.schoolUdise } },
      create: {
        cycleId: cycle.id,
        schoolUdise: run.schoolUdise,
        frameworkId: framework.id,
        selfScorePercent: percent,
        verifierScorePercent: percent,
        finalScorePercent: percent,
        gradeBandCode: bandFor(percent),
        publishedAt: run.publishedAt,
      },
      update: { publishedAt: run.publishedAt },
    });
  }

  // ── Risk score history for the drift monitor ───────────────────────────────
  const driftRuns = publishedRunIds;
  const driftRows: { runId: string; score: number; above: boolean; at: Date }[] = [];
  for (let month = 4; month >= 1; month--) {
    for (let i = 0; i < 30; i++) {
      const base = month === 1 ? 34 : 22; // the newest month shifts upward and should flag
      const score = base + ((i * 7) % 15);
      driftRows.push({
        runId: driftRuns[i % driftRuns.length]!,
        score,
        above: score >= 40,
        at: new Date(Date.now() - month * 30 * DAY + (i % 28) * DAY),
      });
    }
  }
  await prisma.riskScore.createMany({
    data: driftRows.map((r) => ({
      runId: r.runId,
      rubricId: rubric.id,
      score: r.score,
      band: r.score >= 40 ? 'HIGH' : 'MEDIUM',
      aboveThreshold: r.above,
      autoCheckedCount: 25,
      manualDecidedCount: 58,
      applicableCount: 89,
      computedAt: r.at,
    })),
  });

  // ── Integrity reports ──────────────────────────────────────────────────────
  if (field1User) {
    await prisma.integrityReport.createMany({
      data: [
        {
          reportedByUserId: field1User.id,
          body: 'At a visit in the northern block last week the manager offered lunch and an envelope before the walkround began. I declined both and completed the visit as drawn.',
          createdAt: new Date(Date.now() - 6 * DAY),
          auditAcknowledgedAt: new Date(Date.now() - 5 * DAY),
        },
        {
          reportedByUserId: field1User.id,
          body: 'A caller identifying themselves as a district office assistant asked which schools are on my travel list for next week. I did not confirm anything and am reporting the attempt.',
          createdAt: new Date(Date.now() - 1 * DAY),
        },
      ],
    });
  }

  console.log(
    `pipeline demo: ${cursor} schools drawn through the pipeline, ` +
      `${publishedRunIds.length + 10} published, drift history ${driftRows.length} scores`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
