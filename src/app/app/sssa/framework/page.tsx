import { FrameworkPage } from '@/components/sssa/FrameworkPage';
import { prisma } from '@/lib/db';

export default async function SssaFrameworkPage() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  let locked = false;
  if (cycle) {
    const subs = await prisma.selfAssessmentSubmission.count({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
    });
    locked = subs > 0;
  }
  return <FrameworkPage locked={locked} />;
}
