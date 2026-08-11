import { prisma } from '@/lib/db';
import { isGovernmentSchool, mandatoryDocTypesForSchool } from '@/lib/school/helpers';

/**
 * Whether one school has completed its profile — the same question the officials'
 * Compliance page asks about all of them.
 *
 * Deliberately the same four parts and the same rules as `sssa/compliance.ts`, so a
 * school reading "Pending" here and an officer reading "Pending" there are reading one
 * fact. Two definitions of complete would be worse than none: the school would fix
 * what its own page asked for and stay in breach on the officer's.
 *
 * Government schools are not asked to disclose fees — the school-side page is hidden
 * for them — so their profile is three parts, not four.
 *
 * Until this week two of the four could not be entered by anyone: nothing in the
 * application wrote School.addressEn or School.publicPhone, so a school marked Pending
 * for a missing address had no way to supply one. The profile page is what makes this
 * status something a school can act on.
 */

export type ProfileStatus = 'COMPLETE' | 'PARTIAL' | 'EMPTY';

export type ProfilePart = {
  key: 'address' | 'phone' | 'fees' | 'documents';
  label: string;
  done: boolean;
  href: string;
};

export type SchoolProfileStatus = {
  status: ProfileStatus;
  parts: ProfilePart[];
  done: number;
  total: number;
  addressEn: string | null;
  addressHi: string | null;
  publicPhone: string | null;
};

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  COMPLETE: 'Completed',
  PARTIAL: 'Pending',
  EMPTY: 'Not started',
};

export async function getSchoolProfileStatus(
  schoolUdise: string,
): Promise<SchoolProfileStatus | null> {
  const school = await prisma.school.findUnique({
    where: { udise: schoolUdise },
    select: {
      category: true,
      management: true,
      addressEn: true,
      addressHi: true,
      publicPhone: true,
    },
  });
  if (!school) return null;

  const now = new Date();
  const [docs, fee] = await Promise.all([
    prisma.mandatoryDocument.findMany({
      where: { schoolUdise },
      select: { status: true, validTill: true },
    }),
    prisma.feeDisclosure.findFirst({ where: { schoolUdise }, select: { id: true } }),
  ]);

  // A lapsed certificate is not evidence of anything current, and a document past
  // validTill counts as lapsed even if the background sweep has not run — this page
  // should not depend on that job.
  const held = docs.filter((d) => {
    const lapsed = d.status === 'EXPIRED' || (d.validTill != null && d.validTill < now);
    return !lapsed && (d.status === 'UPLOADED' || d.status === 'ACKNOWLEDGED');
  }).length;
  const expected = mandatoryDocTypesForSchool(school.category).length;

  const isGovt = isGovernmentSchool(school.category) || school.management === 'GOVERNMENT';

  const parts: ProfilePart[] = [
    {
      key: 'address',
      label: 'Address',
      done: !!school.addressEn?.trim(),
      href: '/app/school/profile',
    },
    {
      key: 'phone',
      label: 'Public phone number',
      done: !!school.publicPhone?.trim(),
      href: '/app/school/profile',
    },
    ...(isGovt
      ? []
      : [
          {
            key: 'fees' as const,
            label: 'Fee disclosure',
            done: fee != null,
            href: '/app/school/fee-disclosure',
          },
        ]),
    {
      key: 'documents',
      label: 'Mandatory documents',
      done: expected > 0 && held >= expected,
      href: '/app/school/documents',
    },
  ];

  const done = parts.filter((p) => p.done).length;

  // Nothing entered is worth separating from partly filled: one is a school that has
  // not been asked, the other is a school that started and stopped.
  const status: ProfileStatus = done === parts.length ? 'COMPLETE' : done === 0 ? 'EMPTY' : 'PARTIAL';

  return {
    status,
    parts,
    done,
    total: parts.length,
    addressEn: school.addressEn,
    addressHi: school.addressHi,
    publicPhone: school.publicPhone,
  };
}
