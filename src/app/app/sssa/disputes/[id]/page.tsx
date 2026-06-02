import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { DisputeDetailPanel } from '@/components/sssa/DisputeDetailPanel';

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      school: {
        select: {
          nameEn: true,
          udise: true,
          districtCode: true,
          blockCode: true,
          district: { select: { nameEn: true } },
          block: { select: { nameEn: true } },
        },
      },
      category: { select: { nameEn: true } },
      disputeHistory: {
        orderBy: { createdAt: 'asc' },
        include: {
          // actorUser join not available without relation; use actorUserId
        },
      },
    },
  });

  if (!ticket) notFound();

  return (
    <DisputeDetailPanel
      ticket={{
        id: ticket.id,
        status: ticket.status,
        createdAt: ticket.createdAt.toLocaleString('en-IN'),
        filedBy: `${ticket.school.nameEn} / ${ticket.submitterName ?? 'Public User'}`,
        school: ticket.school.nameEn,
        udise: ticket.school.udise,
        district: ticket.school.district.nameEn,
        block: ticket.school.block.nameEn,
        domain: 'Assessment / Learning Outcomes',
        subDomain: '4.1 Classroom Assessment Processes',
        parameter: ticket.category.nameEn,
        saScore: null,
        verifierScore: null,
        schoolArgument: ticket.schoolArgument ?? null,
        verifierResponse: ticket.verifierResponse ?? null,
        closedReason: ticket.closedReason ?? null,
        history: ticket.disputeHistory.map((h) => ({
          id: h.id,
          actionType: h.actionType,
          notes: h.notes ?? null,
          actorUserId: h.actorUserId ?? null,
          createdAt: h.createdAt.toLocaleString('en-IN'),
        })),
      }}
    />
  );
}
