import { PrismaClient, type VerifierCell, type WorkforceSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * The demonstration verification workforce.
 *
 * Every screen built in steps 4 to 7 queries VerifierProfile, and until this file existed
 * no seed created one: the desk queue, the cohort builder, the supervisor roster and the
 * audit queue all rendered their empty states with nobody able to log in and change that.
 *
 * One account per working role, with the workforce split the terms of reference describe:
 * Online Verifiers are VSK data analysts (serving staff), On-Ground Verifiers and
 * Supervisors come from an empanelled pool. Certification is set to CERTIFIED here because
 * an uncertified verifier cannot be assigned anything and the training module is out of
 * scope for version 1.
 *
 * Idempotent: users are upserted with an empty update so a rotated password survives a
 * redeploy, and profiles are only created where absent.
 */

type Member = {
  username: string;
  password: string;
  name: string;
  role: string;
  cell: VerifierCell;
  workforceSource: WorkforceSource;
  pseudonym: string;
  /** Username of this member's supervisor, linked after all profiles exist. */
  supervisedBy?: string;
};

const WORKFORCE: Member[] = [
  {
    username: 'supervisor1',
    password: 'super123',
    name: 'Meera Tripathi',
    role: 'SUPERVISOR',
    cell: 'ONLINE',
    workforceSource: 'EMPANELLED',
    pseudonym: 'SUP-201',
  },
  {
    username: 'supervisor2',
    password: 'super123',
    name: 'Rajendra Nishad',
    role: 'SUPERVISOR',
    cell: 'FIELD',
    workforceSource: 'EMPANELLED',
    pseudonym: 'SUP-202',
  },
  {
    username: 'online1',
    password: 'verifier123',
    name: 'Kavita Srivastava',
    role: 'ONLINE_VERIFIER',
    cell: 'ONLINE',
    workforceSource: 'VSK_STAFF',
    pseudonym: 'OV-101',
    supervisedBy: 'supervisor1',
  },
  {
    username: 'online2',
    password: 'verifier123',
    name: 'Dinesh Chandra Pandey',
    role: 'ONLINE_VERIFIER',
    cell: 'ONLINE',
    workforceSource: 'VSK_STAFF',
    pseudonym: 'OV-102',
    supervisedBy: 'supervisor1',
  },
  {
    username: 'field1',
    password: 'verifier123',
    name: 'Santosh Kumar Yadav',
    role: 'ONGROUND_VERIFIER',
    cell: 'FIELD',
    workforceSource: 'EMPANELLED',
    pseudonym: 'FV-301',
    supervisedBy: 'supervisor2',
  },
  {
    username: 'field2',
    password: 'verifier123',
    name: 'Pushpa Devi',
    role: 'ONGROUND_VERIFIER',
    cell: 'FIELD',
    workforceSource: 'EMPANELLED',
    pseudonym: 'FV-302',
    supervisedBy: 'supervisor2',
  },
  // The Audit Cell member gets a login but no profile here: their profile is created the
  // first time they claim a case, deliberately uncertified so it can never be handed desk
  // batches or cohort visits.
];

const AUDIT_ACCOUNT = { username: 'audit1', password: 'audit123', name: 'Vandana Kulshrestha' };

async function main() {
  let createdUsers = 0;
  let createdProfiles = 0;

  for (const member of [...WORKFORCE, { ...AUDIT_ACCOUNT, role: 'AUDIT_CELL' }]) {
    const existing = await prisma.user.findUnique({ where: { username: member.username }, select: { id: true } });
    if (!existing) {
      await prisma.user.create({
        data: {
          username: member.username,
          passwordHash: await bcrypt.hash(member.password, 10),
          name: member.name,
          role: member.role,
          active: true,
        },
      });
      createdUsers += 1;
    }
  }

  for (const member of WORKFORCE) {
    const user = await prisma.user.findUnique({ where: { username: member.username }, select: { id: true } });
    if (!user) continue;
    const existing = await prisma.verifierProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existing) continue;
    await prisma.verifierProfile.create({
      data: {
        userId: user.id,
        cell: member.cell,
        workforceSource: member.workforceSource,
        certification: 'CERTIFIED',
        certifiedAt: new Date(),
        pseudonym: member.pseudonym,
      },
    });
    createdProfiles += 1;
  }

  // Supervision links, after every profile exists.
  for (const member of WORKFORCE) {
    if (!member.supervisedBy) continue;
    const [subject, supervisor] = await Promise.all([
      prisma.user.findUnique({ where: { username: member.username }, select: { verifierProfile: { select: { id: true, supervisorId: true } } } }),
      prisma.user.findUnique({ where: { username: member.supervisedBy }, select: { verifierProfile: { select: { id: true } } } }),
    ]);
    const subjectProfile = subject?.verifierProfile;
    const supervisorProfile = supervisor?.verifierProfile;
    if (!subjectProfile || !supervisorProfile || subjectProfile.supervisorId) continue;
    await prisma.verifierProfile.update({
      where: { id: subjectProfile.id },
      data: { supervisorId: supervisorProfile.id },
    });
  }

  console.log(`verification workforce: ${createdUsers} users created, ${createdProfiles} profiles created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
