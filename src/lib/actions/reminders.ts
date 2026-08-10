'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Nudges every school in a block that has not opened its self-assessment.
 *
 * A block row on Furthest behind is fifty-odd schools, so this is the one action
 * on the page that reaches real people. Two things follow from that:
 *
 * It only writes to schools that have actually not started — the count on the
 * button is recomputed here rather than trusted from the client, so a stale page
 * cannot send to schools that submitted in the meantime.
 *
 * It records nothing new. The Notification rows themselves are the record, which
 * is what lets the page show when a block was last reminded and stops two officers
 * chasing the same schools a day apart.
 */

/** Sending again inside this window is almost always a double-click or a second
 *  officer who could not see the first send. Blocked rather than warned. */
const COOLDOWN_HOURS = 24;

export type ReminderResult = { sent: number; error?: string };

export async function sendBlockReminder(blockCode: string): Promise<ReminderResult> {
  const session = await auth();
  if (!session) return { sent: 0, error: 'Not signed in.' };
  const role = session.user.role;
  if (role !== 'SSSA_ADMIN' && role !== 'admin') return { sent: 0, error: 'Not permitted.' };

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return { sent: 0, error: 'No active cycle.' };

  const block = await prisma.block.findUnique({
    where: { code: blockCode },
    select: { nameEn: true, district: { select: { nameEn: true } } },
  });
  if (!block) return { sent: 0, error: 'Block not found.' };

  // Recomputed server-side: the button's count comes from a page that may be
  // minutes old, and a school that submitted since then must not be chased.
  const notStarted = await prisma.school.findMany({
    where: {
      blockCode,
      selfAssessments: { none: { cycleId: cycle.id } },
    },
    select: { udise: true },
  });
  if (notStarted.length === 0) return { sent: 0, error: 'Every school here has started.' };

  // School accounts are keyed by UDISE as their username.
  const users = await prisma.user.findMany({
    where: { role: 'SCHOOL', active: true, username: { in: notStarted.map((s) => s.udise) } },
    select: { id: true },
  });
  if (users.length === 0) return { sent: 0, error: 'No school accounts in this block.' };

  const since = new Date(Date.now() - COOLDOWN_HOURS * 3_600_000);
  const recent = await prisma.notification.findFirst({
    where: {
      type: 'DEADLINE_REMINDER',
      userId: { in: users.map((u) => u.id) },
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  });
  if (recent) {
    return {
      sent: 0,
      error: `Already reminded in the last ${COOLDOWN_HOURS} hours. Try again tomorrow.`,
    };
  }

  // Naming the district gives the head teacher somewhere to go with a question,
  // which a reminder without a contact point does not.
  const office = block.district?.nameEn ? `${block.district.nameEn} district office` : 'district office';
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'DEADLINE_REMINDER' as const,
      title: `Your SQAAF self-assessment for ${cycle.name} has not been started`,
      body:
        `Your school has not opened its self-assessment for ${cycle.name}. ` +
        `Sign in with your UDISE code to begin. If you need help, contact the ${office}.`,
    })),
  });

  revalidatePath('/app/sssa/schools');
  return { sent: users.length };
}

/** Most recent reminder per block, so a row can say when it was last chased.
 *  Keyed on block code; blocks never reminded are simply absent. */
export async function lastRemindedByBlock(): Promise<Record<string, string>> {
  const reminders = await prisma.notification.findMany({
    where: { type: 'DEADLINE_REMINDER' },
    select: { createdAt: true, user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5_000,
  });
  if (reminders.length === 0) return {};

  const usernames = [...new Set(reminders.map((r) => r.user.username))];
  const schools = await prisma.school.findMany({
    where: { udise: { in: usernames } },
    select: { udise: true, blockCode: true },
  });
  const blockOf = new Map(schools.map((s) => [s.udise, s.blockCode]));

  const out: Record<string, string> = {};
  // Ordered newest first, so the first hit for a block is its latest reminder.
  for (const r of reminders) {
    const code = blockOf.get(r.user.username);
    if (code && !out[code]) out[code] = r.createdAt.toISOString();
  }
  return out;
}
