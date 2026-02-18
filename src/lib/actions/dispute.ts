'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

/* ── SLA durations in milliseconds ───────────────────── */
const SLA_SCHOOL_DAYS = 5;
const SLA_BLOCK_DAYS = 10;
const SLA_DISTRICT_DAYS = 30;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const ESCALATION_ORDER: Record<string, { nextLevel: string; nextStatus: string; slaDays: number } | null> = {
  SCHOOL:   { nextLevel: 'BLOCK',    nextStatus: 'ASSIGNED_TO_BLOCK',    slaDays: SLA_BLOCK_DAYS },
  BLOCK:    { nextLevel: 'DISTRICT', nextStatus: 'ASSIGNED_TO_DISTRICT', slaDays: SLA_DISTRICT_DAYS },
  DISTRICT: { nextLevel: 'STATE',    nextStatus: 'ASSIGNED_TO_STATE',    slaDays: 0 },
  STATE:    null,
};

const CLOSED_STATUSES = ['RESOLVED', 'REJECTED'];

/* ── Escalation engine ───────────────────────────────── */
export async function ensureEscalationUpToDate(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;
  if (CLOSED_STATUSES.includes(ticket.status)) return;
  if (!ticket.nextDueAt) return;

  const now = new Date();
  if (now <= ticket.nextDueAt) return;

  // May need multiple escalations if overdue for a long time
  let level = ticket.handlerLevel;
  let dueAt: Date | null = ticket.nextDueAt;
  const timelineEntries: { actorType: string; actorRole: string; eventType: string; message: string }[] = [];

  while (dueAt && now > dueAt) {
    const next = ESCALATION_ORDER[level];
    if (!next) break;

    const fromLevel = level;
    level = next.nextLevel;
    const newDue = next.slaDays > 0 ? addDays(now, next.slaDays) : null;

    timelineEntries.push({
      actorType: 'SYSTEM',
      actorRole: 'SYSTEM',
      eventType: 'ESCALATED',
      message: `Auto-escalated from ${fromLevel} to ${level}`,
    });

    dueAt = newDue;
  }

  if (timelineEntries.length === 0) return;

  const statusForLevel: Record<string, string> = {
    SCHOOL: 'ASSIGNED_TO_SCHOOL',
    BLOCK: 'ASSIGNED_TO_BLOCK',
    DISTRICT: 'ASSIGNED_TO_DISTRICT',
    STATE: 'ASSIGNED_TO_STATE',
  };

  await prisma.$transaction([
    ...timelineEntries.map((e) =>
      prisma.ticketTimeline.create({
        data: { ticketId, ...e },
      })
    ),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        handlerLevel: level,
        status: statusForLevel[level] || ticket.status,
        nextDueAt: dueAt,
        lastEscalatedAt: now,
      },
    }),
  ]);
}

/**
 * Bulk escalation — scans open tickets and applies escalation.
 * Optionally scoped to a district.
 */
export async function runEscalations(districtCode?: string) {
  const session = await auth();
  if (!session) return { error: 'UNAUTHORIZED' };
  if (!['DISTRICT_OFFICIAL', 'SSSA_ADMIN'].includes(session.user.role!)) {
    return { error: 'UNAUTHORIZED' };
  }

  const where: Record<string, unknown> = {
    status: { notIn: CLOSED_STATUSES },
    nextDueAt: { lt: new Date() },
  };
  if (districtCode) where.districtCode = districtCode;

  const tickets = await prisma.ticket.findMany({
    where,
    select: { id: true },
    take: 200,
  });

  let escalated = 0;
  for (const t of tickets) {
    await ensureEscalationUpToDate(t.id);
    escalated++;
  }

  return { escalated };
}

/* ── School search (for autocomplete) ────────────────── */
export async function searchSchools(query: string) {
  if (!query || query.length < 2) return [];
  return prisma.school.findMany({
    where: {
      OR: [
        { nameEn: { contains: query, mode: 'insensitive' } },
        { nameHi: { contains: query } },
        { udise: { contains: query } },
      ],
    },
    select: { udise: true, nameEn: true, nameHi: true, category: true },
    take: 10,
    orderBy: { nameEn: 'asc' },
  });
}

/* ── Create ticket ───────────────────────────────────── */
export async function createTicket(data: {
  schoolUdise: string;
  categoryCode: string;
  description: string;
  submitterName: string;
  submitterMobile: string;
  otp: string;
}) {
  if (data.otp !== '123456') return { error: 'INVALID_OTP' };

  const school = await prisma.school.findUnique({
    where: { udise: data.schoolUdise },
    select: { udise: true, districtCode: true },
  });
  if (!school) return { error: 'SCHOOL_NOT_FOUND' };

  const category = await prisma.disputeCategory.findUnique({
    where: { code: data.categoryCode },
  });
  if (!category || !category.isActive) return { error: 'INVALID_CATEGORY' };

  const mobile = data.submitterMobile.replace(/\D/g, '');
  if (mobile.length < 10) return { error: 'INVALID_MOBILE' };

  const now = new Date();

  const ticket = await prisma.ticket.create({
    data: {
      schoolUdise: data.schoolUdise,
      categoryCode: data.categoryCode,
      districtCode: school.districtCode,
      description: data.description.trim(),
      submitterName: data.submitterName?.trim() || null,
      submitterMobile: mobile.slice(-10),
      status: 'ASSIGNED_TO_SCHOOL',
      handlerLevel: 'SCHOOL',
      nextDueAt: addDays(now, SLA_SCHOOL_DAYS),
      timeline: {
        create: {
          actorType: 'PUBLIC',
          actorRole: null,
          eventType: 'CREATED',
          message: 'Ticket created',
        },
      },
    },
  });

  return { ticketId: ticket.id };
}

/* ── Track ticket (public) ───────────────────────────── */
export async function trackTicket(ticketId: string, mobile: string) {
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
  if (!ticketId || cleanMobile.length < 10) return { error: 'INVALID_INPUT' };

  // Run escalation before returning data
  await ensureEscalationUpToDate(ticketId);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      school: { select: { nameEn: true, nameHi: true, udise: true } },
      category: { select: { nameEn: true, nameHi: true } },
      timeline: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket || ticket.submitterMobile !== cleanMobile) return { error: 'NOT_FOUND' };

  return { ticket };
}

/* ── School respond to ticket ────────────────────────── */
export async function schoolRespondToTicket(ticketId: string, message: string) {
  const session = await auth();
  if (!session || session.user.role !== 'SCHOOL') return { error: 'UNAUTHORIZED' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.schoolUdise !== session.user.name) return { error: 'NOT_FOUND' };
  if (!message.trim()) return { error: 'EMPTY_MESSAGE' };

  await prisma.$transaction([
    prisma.ticketTimeline.create({
      data: {
        ticketId,
        actorType: 'SCHOOL',
        actorRole: 'SCHOOL',
        eventType: 'SCHOOL_RESPONDED',
        message: message.trim(),
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESPONDED' },
    }),
  ]);

  return { success: true };
}

/* ── Add note (District / SSSA) ──────────────────────── */
export async function addTicketNote(ticketId: string, message: string) {
  const session = await auth();
  if (!session) return { error: 'UNAUTHORIZED' };
  const role = session.user.role!;
  if (!['DISTRICT_OFFICIAL', 'SSSA_ADMIN'].includes(role)) return { error: 'UNAUTHORIZED' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: 'NOT_FOUND' };

  // Access control
  if (role === 'DISTRICT_OFFICIAL' && ticket.districtCode !== session.user.districtCode) {
    return { error: 'NOT_FOUND' };
  }

  if (!message.trim()) return { error: 'EMPTY_MESSAGE' };

  await prisma.ticketTimeline.create({
    data: {
      ticketId,
      actorType: role === 'SSSA_ADMIN' ? 'SYSTEM' : 'SYSTEM',
      actorRole: role,
      eventType: 'NOTE',
      message: message.trim(),
    },
  });

  return { success: true };
}

/* ── Resolve ticket ──────────────────────────────────── */
export async function resolveTicket(ticketId: string, message: string) {
  const session = await auth();
  if (!session) return { error: 'UNAUTHORIZED' };
  const role = session.user.role!;
  if (!['DISTRICT_OFFICIAL', 'SSSA_ADMIN'].includes(role)) return { error: 'UNAUTHORIZED' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: 'NOT_FOUND' };
  if (CLOSED_STATUSES.includes(ticket.status)) return { error: 'ALREADY_CLOSED' };

  if (role === 'DISTRICT_OFFICIAL' && ticket.districtCode !== session.user.districtCode) {
    return { error: 'NOT_FOUND' };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketTimeline.create({
      data: {
        ticketId,
        actorType: 'SYSTEM',
        actorRole: role,
        eventType: 'RESOLVED',
        message: message?.trim() || 'Ticket resolved',
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
        nextDueAt: null,
      },
    }),
  ]);

  return { success: true };
}

/* ── Reject ticket ───────────────────────────────────── */
export async function rejectTicket(ticketId: string, reason: string) {
  const session = await auth();
  if (!session) return { error: 'UNAUTHORIZED' };
  const role = session.user.role!;
  if (!['DISTRICT_OFFICIAL', 'SSSA_ADMIN'].includes(role)) return { error: 'UNAUTHORIZED' };

  if (!reason?.trim()) return { error: 'REASON_REQUIRED' };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: 'NOT_FOUND' };
  if (CLOSED_STATUSES.includes(ticket.status)) return { error: 'ALREADY_CLOSED' };

  if (role === 'DISTRICT_OFFICIAL' && ticket.districtCode !== session.user.districtCode) {
    return { error: 'NOT_FOUND' };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketTimeline.create({
      data: {
        ticketId,
        actorType: 'SYSTEM',
        actorRole: role,
        eventType: 'REJECTED',
        message: reason.trim(),
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'REJECTED',
        rejectedAt: now,
        closedReason: reason.trim(),
        nextDueAt: null,
      },
    }),
  ]);

  return { success: true };
}
