import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

async function authorizeDemoFirstUser(roles: string[]) {
  const { prisma } = await import('./db');
  const user = await prisma.user.findFirst({
    where: { active: true, role: { in: roles } },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.username,
    role: user.role,
    districtCode: user.districtCode,
  };
}

const demoCredentialsFields = {
  username: { label: 'Username', type: 'text' },
  password: { label: 'Password', type: 'password' },
};

// The "school" demo account always starts its SQAAF from scratch: every login wipes
// whatever it filled in during the previous demo session (responses, evidence, result)
// so it's a repeatable "fill it out live" demo rather than a one-time thing.
async function resetDemoSchoolProgress(schoolUdise: string) {
  const { prisma } = await import('./db');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return;

  const submission = await prisma.selfAssessmentSubmission.findUnique({
    where: { cycleId_schoolUdise: { cycleId: cycle.id, schoolUdise } },
  });
  const verificationSubs = await prisma.verificationSubmission.findMany({
    where: { cycleId: cycle.id, schoolUdise },
    select: { id: true },
  });
  const verificationSubIds = verificationSubs.map((v) => v.id);

  const evidenceLinkFilters = [
    ...(submission ? [{ saSubmissionId: submission.id }] : []),
    ...(verificationSubIds.length > 0 ? [{ vSubmissionId: { in: verificationSubIds } }] : []),
  ];
  const evidenceAssetIds = evidenceLinkFilters.length > 0
    ? (
        await prisma.evidenceLink.findMany({
          where: { OR: evidenceLinkFilters },
          select: { assetId: true },
        })
      ).map((l) => l.assetId)
    : [];

  await prisma.$transaction([
    // Deleting the asset cascades away its EvidenceLink automatically.
    ...(evidenceAssetIds.length > 0
      ? [prisma.evidenceAsset.deleteMany({ where: { id: { in: evidenceAssetIds } } })]
      : []),
    ...(verificationSubIds.length > 0
      ? [
          prisma.verificationResponse.deleteMany({ where: { submissionId: { in: verificationSubIds } } }),
          prisma.verificationSubmission.deleteMany({ where: { id: { in: verificationSubIds } } }),
        ]
      : []),
    prisma.result.deleteMany({ where: { cycleId: cycle.id, schoolUdise } }),
    // Cascades away its SelfAssessmentResponse rows automatically.
    ...(submission ? [prisma.selfAssessmentSubmission.delete({ where: { id: submission.id } })] : []),
    prisma.school.updateMany({
      where: { udise: schoolUdise },
      data: { nameEn: 'Demo School (Fill SQAAF)', nameHi: 'डेमो विद्यालय (एसक्यूएएएफ भरें)' },
    }),
  ]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'credentials-sssa',
      name: 'SSSA System',
      credentials: demoCredentialsFields,
      async authorize() {
        return authorizeDemoFirstUser(['SSSA_ADMIN', 'admin']);
      },
    }),
    Credentials({
      id: 'credentials-school',
      name: 'School',
      credentials: demoCredentialsFields,
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim();
        if (!username) return null;

        const { prisma } = await import('./db');

        // Convenience demo login: username "school" always reaches the same
        // designated demo account, password not checked - matches the other
        // demo-tab providers below. Any other username goes through a real
        // username+password check so different school accounts (e.g. real
        // UDISE logins) can actually be distinguished from one another.
        //
        // This account is reset to a blank, unfilled SQAAF on every login so it
        // can be used repeatedly to demo filling the form out from scratch. For
        // a demo of an already-filled, locked SQAAF, use a real school login instead
        // (e.g. a school seed-dummy.ts marked SUBMITTED).
        if (username.toLowerCase() === 'school') {
          const user = await prisma.user.findFirst({
            where: { username: 'school', active: true, role: { in: ['SCHOOL_USER', 'SCHOOL'] } },
          });
          if (!user) return null;
          await resetDemoSchoolProgress(user.username);
          return { id: user.id, name: user.username, role: user.role, districtCode: user.districtCode };
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active || !['SCHOOL_USER', 'SCHOOL'].includes(user.role)) return null;

        const bcrypt = await import('bcryptjs');
        const valid = await bcrypt.compare(String(credentials?.password ?? ''), user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.username, role: user.role, districtCode: user.districtCode };
      },
    }),
    Credentials({
      id: 'credentials-verifier',
      name: 'Verifier',
      credentials: demoCredentialsFields,
      async authorize() {
        return authorizeDemoFirstUser(['VERIFIER']);
      },
    }),
    Credentials({
      id: 'credentials-district',
      name: 'District',
      credentials: demoCredentialsFields,
      async authorize() {
        return authorizeDemoFirstUser(['DISTRICT_ADMIN', 'DISTRICT_OFFICIAL']);
      },
    }),
  ],
});
