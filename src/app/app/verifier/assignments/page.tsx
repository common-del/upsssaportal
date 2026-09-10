import { redirect } from 'next/navigation';
import { currentActor, requireOngroundVerifier } from '@/lib/authz';
import { getMyAssignments } from '@/lib/actions/cohort';
import { prisma } from '@/lib/db';
import {
  FieldAssignmentsList,
  type TodayVisit,
  type UpcomingVisit,
} from '@/components/verifier/FieldAssignmentsList';
import { IntegrityReportForm } from '@/components/verifier/IntegrityReportForm';

const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';

/**
 * The On-Ground Verifier's assignments, as a day plan.
 *
 * Redesigned at SSSA's direction: today's work at full size on top, the sealed future as a route
 * list whose rows open in place, finished work as one line. The old screen gave a visit happening
 * this minute and a sealed visit four days out the same card at the same weight, in a grid that
 * scrambled their order.
 *
 * Field screens must work on a low-end Android tablet in bright sunlight, per the brief: high
 * contrast, large tap targets, no thin type.
 */
export default async function AssignmentsPage() {
  const actor = await requireOngroundVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');

  const assignments = await getMyAssignments();

  const revealed = assignments.flatMap((a) => (a.state === 'REVEALED' ? [a] : []));
  const upcoming: UpcomingVisit[] = assignments.flatMap((a) =>
    a.state === 'SEALED'
      ? [
          {
            visitId: a.visitId,
            districtName: a.districtName,
            travelWindowStart: a.travelWindowStart,
            travelWindowEnd: a.travelWindowEnd,
            notifiedDate: a.notifiedDate,
            revealAt: a.revealAt,
            deskFlagCount: a.deskFlagCount,
          },
        ]
      : [],
  );

  // The progress line on an in-progress card: how many indicators are graded, out of how many,
  // and how many differ from the claim so far. Findings hold levels while claims hold option
  // keys, so the comparison goes through each parameter's option order, exactly as the visit
  // workspace and sign-off do.
  const details = revealed.length
    ? await prisma.fieldVisit.findMany({
        where: { id: { in: revealed.map((a) => a.visitId) } },
        select: {
          id: true,
          arrivedAt: true,
          findings: { select: { parameterId: true, observedLevel: true } },
          run: { select: { cycleId: true, schoolUdise: true } },
        },
      })
    : [];
  const detailBy = new Map(details.map((d) => [d.id, d]));

  const today: TodayVisit[] = [];
  for (const a of revealed) {
    const d = detailBy.get(a.visitId);
    let gradedCount = 0;
    let totalIndicators = 0;
    let differCount = 0;
    if (d) {
      gradedCount = d.findings.length;
      const submission = await prisma.selfAssessmentSubmission.findUnique({
        where: { cycleId_schoolUdise: { cycleId: d.run.cycleId, schoolUdise: d.run.schoolUdise } },
        select: { responses: { select: { parameterId: true, selectedOptionKey: true } } },
      });
      if (submission && submission.responses.length > 0) {
        totalIndicators = submission.responses.length;
        if (d.findings.length > 0) {
          const options = await prisma.parameterOption.findMany({
            where: { parameterId: { in: d.findings.map((f) => f.parameterId) } },
            select: { parameterId: true, key: true, order: true },
          });
          const orderByKey = new Map(options.map((o) => [`${o.parameterId}:${o.key}`, o.order]));
          const claimedBy = new Map(submission.responses.map((r) => [r.parameterId, r.selectedOptionKey]));
          for (const f of d.findings) {
            const key = claimedBy.get(f.parameterId);
            const claimedOrder = key === undefined ? undefined : orderByKey.get(`${f.parameterId}:${key}`);
            if (claimedOrder !== undefined && f.observedLevel !== claimedOrder) differCount += 1;
          }
        }
      } else {
        // A non-submitter is graded against the whole framework, as in the visit workspace.
        totalIndicators = await prisma.parameter.count();
      }
    }
    today.push({
      visitId: a.visitId,
      schoolName: a.schoolName,
      schoolUdise: a.schoolUdise,
      blockName: a.blockName,
      districtName: a.districtName,
      addressEn: a.addressEn,
      conflictDeclaredAt: a.conflictDeclaredAt,
      recusedAt: a.recusedAt,
      arrivedAt: d?.arrivedAt?.toISOString() ?? null,
      gradedCount,
      totalIndicators,
      differCount,
    });
  }
  // Working order: mid-visit first, then ready, then awaiting the confirmation, recused last.
  const weight = (v: TodayVisit) => (v.recusedAt ? 3 : v.arrivedAt ? 0 : v.conflictDeclaredAt ? 1 : 2);
  today.sort((x, y) => weight(x) - weight(y));

  const profile = await prisma.verifierProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  const signedOffCount = profile
    ? await prisma.fieldVisit.count({
        where: { profileId: profile.id, signedOffAt: { not: null }, recusedAt: null },
      })
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Field Assignments
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          You are given the district and the travel window in advance. The school information
          unlocks at 07:00 on inspection morning.
        </p>
      </div>

      {assignments.length === 0 && signedOffCount === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">You have no open assignments.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            Assignments appear once SSSA builds this year&apos;s field cohort. If you expect work
            here, your certification may not be active yet, in which case nothing is allocated to
            you.
          </p>
        </div>
      ) : (
        <FieldAssignmentsList today={today} upcoming={upcoming} signedOffCount={signedOffCount} />
      )}

      <IntegrityReportForm />
    </div>
  );
}
