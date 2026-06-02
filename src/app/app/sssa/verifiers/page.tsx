import { prisma } from '@/lib/db';
import { VerifierAssignmentPanel } from '@/components/sssa/VerifierAssignmentPanel';

export default async function VerifiersPage() {
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        No active cycle. Activate a cycle before assigning verifiers.
      </div>
    );
  }

  const [districts, blocks, verifiers, submittedSubs, assignments] = await Promise.all([
    prisma.district.findMany({ orderBy: { nameEn: 'asc' }, select: { code: true, nameEn: true } }),
    prisma.block.findMany({
      orderBy: { nameEn: 'asc' },
      select: { code: true, nameEn: true, districtCode: true },
    }),
    prisma.user.findMany({
      where: { role: 'VERIFIER', active: true },
      select: { id: true, name: true, username: true, districtCode: true },
      orderBy: { username: 'asc' },
    }),
    prisma.selfAssessmentSubmission.findMany({
      where: { cycleId: cycle.id, status: 'SUBMITTED' },
      select: {
        schoolUdise: true,
        school: {
          select: {
            nameEn: true,
            districtCode: true,
            blockCode: true,
            district: { select: { nameEn: true } },
            block: { select: { nameEn: true } },
          },
        },
      },
    }),
    prisma.verifierAssignment.findMany({
      where: { cycleId: cycle.id },
      include: {
        school: {
          select: {
            nameEn: true,
            udise: true,
            district: { select: { nameEn: true } },
          },
        },
        verifier: { select: { id: true, name: true, username: true } },
      },
    }),
  ]);

  const assignedUdises = new Set(assignments.map((a) => a.schoolUdise));

  const unassigned = submittedSubs
    .filter((s) => !assignedUdises.has(s.schoolUdise))
    .map((s) => ({
      udise: s.schoolUdise,
      name: s.school.nameEn,
      districtCode: s.school.districtCode,
      district: s.school.district.nameEn,
      blockCode: s.school.blockCode,
      block: s.school.block.nameEn,
    }));

  const workload = new Map<string, number>();
  for (const a of assignments) {
    workload.set(a.verifierUserId, (workload.get(a.verifierUserId) ?? 0) + 1);
  }

  const verifierRows = verifiers.map((v) => ({
    id: v.id,
    name: v.name ?? v.username,
    workload: workload.get(v.id) ?? 0,
    districtCode: v.districtCode ?? null,
  }));

  const assignedRows = assignments.map((a) => ({
    assignmentId: a.id,
    udise: a.schoolUdise,
    schoolName: a.school.nameEn,
    district: a.school.district.nameEn,
    verifierId: a.verifierUserId,
    verifierName: a.verifier.name ?? a.verifier.username,
  }));

  return (
    <VerifierAssignmentPanel
      cycleId={cycle.id}
      unassigned={unassigned}
      verifiers={verifierRows}
      assigned={assignedRows}
      districts={districts}
      blocks={blocks}
    />
  );
}
