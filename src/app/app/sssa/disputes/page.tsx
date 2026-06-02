import { DisputesManagement } from '@/components/sssa/DisputesManagement';
import { buildDisputesDashboardData } from '@/lib/sssa/adminMetrics';
import { prisma } from '@/lib/db';
import type { DisputeQueueRow } from '@/components/sssa/DisputesQueue';

export default async function DisputesPage() {
  const [dashboard, tickets] = await Promise.all([
    buildDisputesDashboardData(),
    prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        school: { select: { nameEn: true, district: { select: { nameEn: true } } } },
        category: { select: { nameEn: true } },
      },
    }),
  ]);

  const queueRows: DisputeQueueRow[] = tickets.map((t) => ({
    id: t.id,
    schoolName: t.school.nameEn,
    parameter: t.category.nameEn,
    saScore: '—',
    verifierScore: '—',
    reason: t.description,
    filedAt: t.createdAt.toLocaleDateString('en-IN'),
    status: t.status,
    statusLabel: t.status.replace(/_/g, ' '),
    detail: `${t.school.nameEn} · ${t.school.district.nameEn} — ${t.description}`,
  }));

  return <DisputesManagement {...dashboard} queueRows={queueRows} />;
}
