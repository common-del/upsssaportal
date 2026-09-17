import { prisma } from '@/lib/db';
import { evaluateDeEmpanelment, type DeEmpanelEvaluation } from '@/lib/verification/deEmpanelment';

/**
 * One verifier, gathered for their page.
 *
 * This is the page Quality Sample and De-empanelment folded into. Both were whole-roster screens
 * answering a question about one person, so you arrived already knowing whose record you wanted
 * and then hunted for them in a list. What they lose is the cross-roster view, and the workforce
 * table keeps that as two columns: a flag count and a removal recommendation.
 *
 * Not the same thing as `sssa/verifierProfile.ts`, which serves the Users tab and reads the
 * legacy assignment tables. This one is keyed on the verifier profile rather than the user, and
 * reads the verification pipeline: desk cases, field visits, quality checks and audits.
 */

export type ProfileWork = {
  /** Desk cases open, or visits awaiting sign-off. */
  open: number;
  /** Desk cases routed onwards, or visits signed off. */
  completed: number;
  avgDays: number | null;
  qualityFlags: number;
};

export type ProfileCase = {
  id: string;
  date: string | null;
  schoolName: string;
  place: string;
  outcome: string;
  tone: 'CLEAN' | 'CORRECTED' | 'STOOD_DOWN' | 'OPEN';
};

export type ProfileSample = {
  runId: string;
  date: string | null;
  schoolName: string;
  note: string;
  /** All three the reviewer can give. Collapsing coaching into either of the others would turn
   *  a note to a supervisor into either a clean record or a mark against somebody. */
  verdict: 'SATISFACTORY' | 'COACHING_NEEDED' | 'FLAGGED';
};

export type WorkforceProfile = {
  profileId: string;
  userId: string;
  name: string;
  username: string;
  pseudonym: string;
  cell: 'ONLINE' | 'FIELD';
  workforceSource: string;
  certification: string;
  certifiedAt: string | null;
  certificationExpiresAt: string | null;
  deEmpanelledAt: string | null;
  deEmpanelledReason: string | null;
  supervisorName: string | null;
  districts: string[];
  exclusionCount: number;
  onRosterSince: string;
  work: ProfileWork;
  recent: ProfileCase[];
  samples: ProfileSample[];
  /** Null for staff the empanelment rules do not govern: they are employed, not empanelled. */
  removal: DeEmpanelEvaluation | null;
};

const RECENT = 6;

export async function buildWorkforceProfile(profileId: string): Promise<WorkforceProfile | null> {
  const profile = await prisma.verifierProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      cell: true,
      workforceSource: true,
      certification: true,
      certifiedAt: true,
      certificationExpiresAt: true,
      deEmpanelledAt: true,
      deEmpanelledReason: true,
      pseudonym: true,
      createdAt: true,
      supervisor: { select: { user: { select: { name: true, username: true } } } },
      exclusions: { select: { id: true } },
      user: {
        select: {
          name: true,
          username: true,
          verifierDistricts: { select: { districtCode: true } },
        },
      },
    },
  });
  if (!profile) return null;

  const districtCodes = profile.user.verifierDistricts.map((d) => d.districtCode);
  const districts = districtCodes.length
    ? (
        await prisma.district.findMany({
          where: { code: { in: districtCodes } },
          select: { nameEn: true },
        })
      )
        .map((d) => d.nameEn)
        .sort()
    : [];

  const field = profile.cell === 'FIELD';

  const [visits, deskOpen, deskDone, qualityChecks] = await Promise.all([
    field
      ? prisma.fieldVisit.findMany({
          where: { profileId },
          orderBy: [{ signedOffAt: 'desc' }, { notifiedDate: 'desc' }],
          take: 200,
          select: {
            id: true,
            notifiedDate: true,
            signedOffAt: true,
            recusedAt: true,
            revealAt: true,
            run: {
              select: {
                id: true,
                school: {
                  select: {
                    nameEn: true,
                    block: { select: { nameEn: true } },
                    district: { select: { nameEn: true } },
                  },
                },
                discrepancies: { select: { id: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    field
      ? Promise.resolve(0)
      : prisma.assessmentCycleRun.count({
          where: { deskAssigneeProfileId: profileId, state: 'DESK_SCREENING' },
        }),
    field
      ? Promise.resolve(0)
      : prisma.assessmentCycleRun.count({
          where: { deskAssigneeProfileId: profileId, state: { not: 'DESK_SCREENING' } },
        }),
    prisma.qualityCheck.findMany({
      where: { subjectProfileId: profileId },
      orderBy: { createdAt: 'desc' },
      take: RECENT,
      select: {
        runId: true,
        verdict: true,
        note: true,
        createdAt: true,
        run: { select: { school: { select: { nameEn: true } } } },
      },
    }),
  ]);

  const live = visits.filter((v) => v.recusedAt === null);
  const signedOff = live.filter((v) => v.signedOffAt !== null);
  const days = signedOff.map((v) => (v.signedOffAt!.getTime() - v.revealAt.getTime()) / 86_400_000);
  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

  // Desk turnaround needs the transition pair, which the roster already computes for the table.
  // Repeating it per profile would be a second implementation of the same arithmetic, so the
  // desk cell shows its counts here and its mean stays on the table it was built for.
  const recent: ProfileCase[] = visits.slice(0, RECENT).map((v) => {
    const corrections = v.run.discrepancies.length;
    if (v.recusedAt) {
      return {
        id: v.id,
        date: v.recusedAt.toISOString(),
        schoolName: v.run.school.nameEn,
        place: `${v.run.school.block.nameEn}, ${v.run.school.district.nameEn}`,
        outcome: 'Stood down, conflict declared',
        tone: 'STOOD_DOWN' as const,
      };
    }
    if (!v.signedOffAt) {
      return {
        id: v.id,
        date: v.notifiedDate.toISOString(),
        schoolName: v.run.school.nameEn,
        place: `${v.run.school.block.nameEn}, ${v.run.school.district.nameEn}`,
        outcome: 'Not visited yet',
        tone: 'OPEN' as const,
      };
    }
    return {
      id: v.id,
      date: v.signedOffAt.toISOString(),
      schoolName: v.run.school.nameEn,
      place: `${v.run.school.block.nameEn}, ${v.run.school.district.nameEn}`,
      outcome:
        corrections === 0
          ? 'Signed off, clean'
          : `Signed off, ${corrections} correction${corrections === 1 ? '' : 's'}`,
      tone: corrections === 0 ? ('CLEAN' as const) : ('CORRECTED' as const),
    };
  });

  const samples: ProfileSample[] = qualityChecks.map((q) => ({
    runId: q.runId,
    date: q.createdAt.toISOString(),
    schoolName: q.run.school.nameEn,
    note: q.note ?? 'No note was left with this verdict.',
    verdict: q.verdict,
  }));

  return {
    profileId: profile.id,
    userId: profile.userId,
    name: profile.user.name ?? profile.user.username,
    username: profile.user.username,
    pseudonym: profile.pseudonym,
    cell: profile.cell,
    workforceSource: profile.workforceSource,
    certification: profile.certification,
    certifiedAt: profile.certifiedAt?.toISOString() ?? null,
    certificationExpiresAt: profile.certificationExpiresAt?.toISOString() ?? null,
    deEmpanelledAt: profile.deEmpanelledAt?.toISOString() ?? null,
    deEmpanelledReason: profile.deEmpanelledReason,
    supervisorName: profile.supervisor?.user.name ?? profile.supervisor?.user.username ?? null,
    districts,
    exclusionCount: profile.exclusions.length,
    onRosterSince: profile.createdAt.toISOString(),
    work: {
      open: field ? live.filter((v) => v.signedOffAt === null).length : deskOpen,
      completed: field ? signedOff.length : deskDone,
      avgDays: field ? mean(days) : null,
      qualityFlags: await prisma.qualityCheck.count({
        where: { subjectProfileId: profileId, verdict: 'FLAGGED' },
      }),
    },
    recent,
    samples,
    removal: profile.workforceSource === 'EMPANELLED' ? await removalRecord(profileId) : null,
  };
}

/**
 * Their standing against both removal rules.
 *
 * Only reconciled audits count, which is the whole point of the rule: a disagreement nobody has
 * settled is not evidence against anybody. An audit names no verifier directly, so the subject
 * is the person whose signed-off visit the auditor re-checked, which is how the de-empanelment
 * board reads it too. Both call the same evaluator with the same configured thresholds, so a
 * verifier's page and the removal decision cannot disagree about where the line is.
 */
export async function removalRecord(profileId: string): Promise<DeEmpanelEvaluation> {
  const [config, audits] = await Promise.all([
    prisma.programmeConfig.findUnique({
      where: { id: 'current' },
      select: {
        deEmpanelContradictionRate: true,
        deEmpanelMinimumAuditedCases: true,
        deEmpanelAbsoluteCount: true,
      },
    }),
    prisma.auditCase.findMany({
      where: {
        reconciledAt: { not: null },
        run: { fieldVisits: { some: { profileId, signedOffAt: { not: null } } } },
      },
      select: {
        contradicted: true,
        reconciledAt: true,
        run: {
          select: {
            fieldVisits: {
              where: { signedOffAt: { not: null } },
              select: { profileId: true },
              orderBy: { signedOffAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  return evaluateDeEmpanelment(
    audits
      // A school re-visited after a recusal has two signed-off visits on the run; the audit
      // belongs to whoever filed the one it re-checked, which is the most recent.
      .filter((a) => a.run.fieldVisits[0]?.profileId === profileId)
      .map((a) => ({ contradicted: a.contradicted === true, decidedAt: a.reconciledAt! })),
    {
      contradictionRatePct: config?.deEmpanelContradictionRate ?? 20,
      minimumAuditedCases: config?.deEmpanelMinimumAuditedCases ?? 10,
      absoluteCount: config?.deEmpanelAbsoluteCount ?? 3,
    },
  );
}
