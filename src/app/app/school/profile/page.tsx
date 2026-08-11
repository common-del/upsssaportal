import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { getSchoolProfileStatus, PROFILE_STATUS_LABEL } from '@/lib/school/profileStatus';
import { SchoolProfileForm } from '@/components/school/SchoolProfileForm';
import { SchoolDetailForm } from '@/components/school/SchoolDetailForm';
import { prisma } from '@/lib/db';

const NAVY = '#1B2A6B';

const STATUS_STYLE = {
  COMPLETE: 'bg-[#E7F5EE] text-[#14603A]',
  PARTIAL: 'bg-[#FBF1DE] text-[#7A5209]',
  EMPTY: 'bg-[#FBE9E7] text-[#96271E]',
} as const;

/**
 * The school's own profile — its address, public phone and photographs.
 *
 * The four items on the checklist are the same four the officials' Compliance page
 * grades, in the same order, by the same rules. A school looking at this page and an
 * officer looking at that one are reading one fact, so fixing what this page asks for
 * is what clears the officer's list.
 */
export default async function SchoolProfilePage() {
  const session = await auth();
  if (!session) redirect('/login?tab=school');
  if (session.user.role !== 'SCHOOL') redirect('/');

  const udise = session.user.name!;
  const profile = await getSchoolProfileStatus(udise);
  if (!profile) redirect('/app/school');

  const detail = await prisma.schoolProfileDetail.findUnique({ where: { schoolUdise: udise } });

  // Numbers reach the form as strings so an empty box stays empty. Coercing null to 0
  // would show every unanswered field as a school claiming none.
  const num = (n: number | null | undefined) => (n == null ? '' : String(n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">School Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          What parents see about your school, and what officials count as a complete
          profile.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Profile completeness</h2>
          <span
            className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[profile.status]}`}
          >
            {PROFILE_STATUS_LABEL[profile.status]} · {profile.done} of {profile.total}
          </span>
        </div>

        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {profile.parts.map((part) => (
            <li key={part.key}>
              <Link
                href={part.href}
                className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3.5 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                {part.done ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E7F5EE]">
                    <Check className="h-3.5 w-3.5 text-[#14603A]" aria-hidden />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
                )}
                <span
                  className={`text-sm ${part.done ? 'text-gray-500' : 'font-semibold text-gray-900'}`}
                >
                  {part.label}
                </span>
                {!part.done && (
                  <span className="ml-auto text-xs font-bold" style={{ color: NAVY }}>
                    Add →
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* Government schools are not asked to disclose fees — the page is hidden for
            them — so their profile is three parts. Saying so stops a three-part
            checklist reading as a missing item. */}
        {profile.total === 3 && (
          <p className="mt-3 text-xs text-gray-400">
            Government schools are not asked to disclose fees, so your profile is three
            parts.
          </p>
        )}
      </section>

      <SchoolProfileForm udise={udise} profile={profile} />

      <SchoolDetailForm
        initial={{
          board: detail?.board ?? '',
          classesFrom: detail?.classesFrom ?? '',
          classesTo: detail?.classesTo ?? '',
          totalStudents: num(detail?.totalStudents),
          totalTeachers: num(detail?.totalTeachers),
          nonTeachingStaff: num(detail?.nonTeachingStaff),
          subjectTeachers: num(detail?.subjectTeachers),
          totalClassrooms: num(detail?.totalClassrooms),
          functionalToilets: num(detail?.functionalToilets),
          drinkingWater: detail?.drinkingWater ?? false,
          enrolPrimary: num(detail?.enrolPrimary),
          enrolUpperPrimary: num(detail?.enrolUpperPrimary),
          enrolSecondary: num(detail?.enrolSecondary),
          enrolHigherSec: num(detail?.enrolHigherSec),
          enrolBoys: num(detail?.enrolBoys),
          enrolGirls: num(detail?.enrolGirls),
          enrolSc: num(detail?.enrolSc),
          enrolSt: num(detail?.enrolSt),
          enrolObc: num(detail?.enrolObc),
          enrolGeneral: num(detail?.enrolGeneral),
          facilities: detail?.facilities ?? [],
          safetyItems: detail?.safetyItems ?? [],
        }}
      />
    </div>
  );
}
