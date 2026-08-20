'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireSchool } from '@/lib/authz';

/**
 * The school's side of the response window, section 8 of the brief.
 *
 * The window's clock lives in one place: the moment the run entered SCHOOL_RESPONSE_WINDOW
 * plus the configured days. Derived here and in the supervisor actions from the same
 * transition timestamp, never stored twice, so the school and the supervisor cannot be
 * looking at two different deadlines.
 */

export type ResponseWindowCase = {
  runId: string;
  windowClosesAt: string;
  windowOpen: boolean;
  response: { body: string; submittedAt: string; outcome: string | null } | null;
  items: {
    code: string;
    title: string;
    titleHi: string;
    claimedLevel: number;
    proposedLevel: number;
    basis: string;
    /** Set once the supervisor has ruled. */
    finalLevel: number | null;
  }[];
};

export async function getMyResponseWindow(): Promise<ResponseWindowCase[]> {
  const actor = await requireSchool();
  if (!actor) return [];

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { schoolResponseWindowDays: true },
  });
  const days = config?.schoolResponseWindowDays ?? 7;

  const runs = await prisma.assessmentCycleRun.findMany({
    where: {
      schoolUdise: actor.schoolUdise,
      OR: [
        { state: 'SCHOOL_RESPONSE_WINDOW' },
        // Recently ruled cases stay visible so the school sees what its response led to.
        { state: 'PUBLISHED', responses: { some: {} } },
      ],
    },
    select: {
      id: true,
      state: true,
      enteredStateAt: true,
      discrepancies: { include: { parameter: true }, orderBy: { raisedAt: 'asc' } },
      responses: { orderBy: { submittedAt: 'desc' }, take: 1 },
    },
    orderBy: { enteredStateAt: 'desc' },
    take: 10,
  });

  const now = Date.now();
  return runs.map((run) => {
    const closesAt =
      run.state === 'SCHOOL_RESPONSE_WINDOW'
        ? new Date(run.enteredStateAt.getTime() + days * 86_400_000)
        : (run.responses[0]?.windowClosesAt ?? run.enteredStateAt);
    const response = run.responses[0] ?? null;
    return {
      runId: run.id,
      windowClosesAt: closesAt.toISOString(),
      windowOpen: run.state === 'SCHOOL_RESPONSE_WINDOW' && closesAt.getTime() > now && !response,
      response: response
        ? {
            body: response.body,
            submittedAt: response.submittedAt.toISOString(),
            outcome: response.outcome,
          }
        : null,
      items: run.discrepancies.map((d) => ({
        code: d.parameter.code,
        title: d.parameter.titleEn,
        titleHi: d.parameter.titleHi,
        claimedLevel: d.claimedLevel,
        proposedLevel: d.proposedLevel,
        basis: d.basis,
        finalLevel: d.upheldAt ? (d.revisedLevel ?? d.proposedLevel) : null,
      })),
    };
  });
}

export async function submitSchoolResponse(
  runId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireSchool();
  if (!actor) return { success: false, error: 'Not authorised.' };

  const trimmed = body.trim();
  if (trimmed.length < 30) {
    return {
      success: false,
      error: 'Set out your response in full. Name the indicators you dispute and the evidence for your position.',
    };
  }

  const config = await prisma.programmeConfig.findUnique({
    where: { id: 'current' },
    select: { schoolResponseWindowDays: true },
  });
  const days = config?.schoolResponseWindowDays ?? 7;

  const run = await prisma.assessmentCycleRun.findFirst({
    where: { id: runId, schoolUdise: actor.schoolUdise, state: 'SCHOOL_RESPONSE_WINDOW' },
    select: { id: true, enteredStateAt: true, responses: { select: { id: true } } },
  });
  if (!run) return { success: false, error: 'No response window is open for this verification.' };
  if (run.responses.length > 0) {
    return { success: false, error: 'Your response has already been submitted for this verification.' };
  }

  const closesAt = new Date(run.enteredStateAt.getTime() + days * 86_400_000);
  if (Date.now() > closesAt.getTime()) {
    return { success: false, error: 'The response window has closed.' };
  }

  await prisma.schoolResponse.create({
    data: { runId, body: trimmed, windowClosesAt: closesAt },
  });

  revalidatePath('/app/school/response-window');
  return { success: true };
}
