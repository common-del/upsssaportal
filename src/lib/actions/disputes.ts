'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

type ActionType =
  | 'NUDGE_SCHOOL'
  | 'ESCALATE_DISTRICT'
  | 'RESOLVED'
  | 'STATUS_CHANGED';

export async function logDisputeAction(
  ticketId: string,
  actionType: ActionType,
  notes?: string,
  newStatus?: string,
) {
  const session = await auth();
  if (!session) return { error: 'Unauthorized' };

  const update: Record<string, string | Date> = {};
  if (actionType === 'ESCALATE_DISTRICT') update.status = 'ESCALATED_DISTRICT';
  if (actionType === 'RESOLVED') {
    update.status = 'RESOLVED';
    update.resolvedAt = new Date();
    if (notes) update.closedReason = notes;
  }
  if (newStatus) update.status = newStatus;

  await prisma.$transaction([
    ...(Object.keys(update).length > 0
      ? [prisma.ticket.update({ where: { id: ticketId }, data: update })]
      : []),
    prisma.disputeHistory.create({
      data: {
        ticketId,
        actorUserId: session.user.id,
        actionType,
        notes: notes ?? null,
      },
    }),
  ]);

  revalidatePath('/app/sssa/disputes');
  return { success: true };
}
