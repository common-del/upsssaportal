'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

/* ── School search (for autocomplete) ────────────────── */
export async function searchSchools(query: string) {
  if (!query || query.length < 2) return [];
  const schools = await prisma.school.findMany({
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
  return schools;
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
  // Mock OTP check
  if (data.otp !== '123456') {
    return { error: 'INVALID_OTP' };
  }

  // Validate school exists
  const school = await prisma.school.findUnique({
    where: { udise: data.schoolUdise },
  });
  if (!school) {
    return { error: 'SCHOOL_NOT_FOUND' };
  }

  // Validate category exists
  const category = await prisma.disputeCategory.findUnique({
    where: { code: data.categoryCode },
  });
  if (!category || !category.isActive) {
    return { error: 'INVALID_CATEGORY' };
  }

  // Validate mobile (basic: 10 digits)
  const mobile = data.submitterMobile.replace(/\D/g, '');
  if (mobile.length < 10) {
    return { error: 'INVALID_MOBILE' };
  }

  // Create ticket + initial timeline entry
  const ticket = await prisma.ticket.create({
    data: {
      schoolUdise: data.schoolUdise,
      categoryCode: data.categoryCode,
      description: data.description.trim(),
      submitterName: data.submitterName?.trim() || null,
      submitterMobile: mobile.slice(-10),
      status: 'NEW',
      timeline: {
        create: {
          actorType: 'PUBLIC',
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

  if (!ticketId || cleanMobile.length < 10) {
    return { error: 'INVALID_INPUT' };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      school: { select: { nameEn: true, nameHi: true, udise: true } },
      category: { select: { nameEn: true, nameHi: true } },
      timeline: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket || ticket.submitterMobile !== cleanMobile) {
    return { error: 'NOT_FOUND' };
  }

  return { ticket };
}

/* ── School respond to ticket ────────────────────────── */
export async function schoolRespondToTicket(ticketId: string, message: string) {
  const session = await auth();
  if (!session || session.user.role !== 'SCHOOL') {
    return { error: 'UNAUTHORIZED' };
  }

  const schoolUdise = session.user.name; // school username is UDISE

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket || ticket.schoolUdise !== schoolUdise) {
    return { error: 'NOT_FOUND' };
  }

  if (!message.trim()) {
    return { error: 'EMPTY_MESSAGE' };
  }

  await prisma.$transaction([
    prisma.ticketTimeline.create({
      data: {
        ticketId,
        actorType: 'SCHOOL',
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
