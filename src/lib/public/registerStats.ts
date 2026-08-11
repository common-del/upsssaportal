import { prisma } from '@/lib/db';

/**
 * What this portal actually holds: schools on the register, how many have filed a
 * self-assessment, and how many a verifier has checked.
 *
 * This replaced three numbers on the homepage that were arithmetic rather than data.
 * "Schools Assessed" was `totalSchools * 0.3` and "SQAAF Verified" was
 * `totalSchools * 0.256`, both recomputed as the district selector moved, so invented
 * figures changed per district and read exactly like real ones. The total beside them
 * came from a hardcoded STATE_TOTALS of 2,48,998 — a statewide figure for Uttar
 * Pradesh, not a count of anything this portal has.
 *
 * All three now count register rows. The numbers are much smaller than the statewide
 * ones and that is the point: a portal reporting its own coverage is telling the
 * truth, where one reporting a state total it holds no data for, beside two figures
 * derived from that total, is not.
 *
 * Districts come from the register too, so the selector cannot offer a district the
 * portal knows nothing about and then show it as zero schools.
 */

export type RegisterCounts = {
  schools: number;
  /** Self-assessments submitted in the active cycle. */
  assessed: number;
  /** Verifications submitted in the active cycle. */
  verified: number;
  /**
   * Pupils, summed from the enrolment each school entered on its own profile.
   *
   * There is no register-wide enrolment figure to read, and the obvious candidate does
   * not work. `data/up_schools_sample_named.csv` carries a real `total_enrolment`
   * column summing to 23,23,427 over 9,112 rows, but it is keyed on an anonymised
   * `pseudocode` (`1000184`) that matches no school row: the register's codes are
   * generated — `09DDBBSSSSS` from seed-dummy, `9MOCK########` from the performance
   * seed — plus a handful of real UDISE codes from the pilot import. Joining that
   * column to a school is therefore impossible until the real UDISE register lands.
   *
   * So this counts the one honest source that exists: the enrolment box on the
   * school's own profile page. It is small until schools fill it in, and that is the
   * correct behaviour — a headline pupil count with nothing behind it is the kind of
   * figure this file was written to remove.
   */
  students: number;
  /** How many profiles the pupil figure covers, so the number carries its denominator. */
  studentProfiles: number;
};

export type RegisterStats = {
  state: RegisterCounts;
  /** Keyed by district name, as shown in the selector. */
  byDistrict: Record<string, RegisterCounts>;
  districts: string[];
};

/** Null when the register cannot be read. Callers show nothing rather than a guess. */
export async function loadRegisterStats(): Promise<RegisterStats | null> {
  try {
    const cycle = await prisma.cycle.findFirst({ where: { isActive: true }, select: { id: true } });

    const [districts, schoolsByDistrict, assessedRows, verifiedRows, enrolmentRows] = await Promise.all([
      prisma.district.findMany({ select: { code: true, nameEn: true }, orderBy: { nameEn: 'asc' } }),
      prisma.school.groupBy({ by: ['districtCode'], _count: { udise: true } }),
      // Grouped in SQL rather than counted per district in a loop: 75 districts would
      // otherwise be 150 queries for one page.
      cycle
        ? prisma.selfAssessmentSubmission.findMany({
            where: { cycleId: cycle.id, status: 'SUBMITTED' },
            select: { school: { select: { districtCode: true } } },
          })
        : Promise.resolve([]),
      cycle
        ? prisma.verificationSubmission.findMany({
            where: { cycleId: cycle.id, status: 'SUBMITTED' },
            select: { school: { select: { districtCode: true } } },
          })
        : Promise.resolve([]),
      // Only rows where a school actually entered a figure. A null is "not asked yet",
      // and treating it as zero would report every silent school as having no pupils.
      prisma.schoolProfileDetail.findMany({
        where: { totalStudents: { not: null } },
        select: { totalStudents: true, school: { select: { districtCode: true } } },
      }),
    ]);

    const nameFor = new Map(districts.map((d) => [d.code, d.nameEn]));

    const tally = (rows: { school: { districtCode: string } | null }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const code = r.school?.districtCode;
        if (code) m.set(code, (m.get(code) ?? 0) + 1);
      }
      return m;
    };

    const assessedBy = tally(assessedRows);
    const verifiedBy = tally(verifiedRows);

    // Pupils are summed, not counted, so they need their own pass — and the number of
    // profiles behind each sum is carried alongside it.
    const studentsBy = new Map<string, number>();
    const profilesBy = new Map<string, number>();
    for (const r of enrolmentRows) {
      const code = r.school?.districtCode;
      if (!code || r.totalStudents == null) continue;
      studentsBy.set(code, (studentsBy.get(code) ?? 0) + r.totalStudents);
      profilesBy.set(code, (profilesBy.get(code) ?? 0) + 1);
    }

    const byDistrict: Record<string, RegisterCounts> = {};
    const state: RegisterCounts = {
      schools: 0,
      assessed: 0,
      verified: 0,
      students: 0,
      studentProfiles: 0,
    };

    for (const row of schoolsByDistrict) {
      const name = nameFor.get(row.districtCode);
      if (!name) continue;
      const counts: RegisterCounts = {
        schools: row._count.udise,
        assessed: assessedBy.get(row.districtCode) ?? 0,
        verified: verifiedBy.get(row.districtCode) ?? 0,
        students: studentsBy.get(row.districtCode) ?? 0,
        studentProfiles: profilesBy.get(row.districtCode) ?? 0,
      };
      byDistrict[name] = counts;
      state.schools += counts.schools;
      state.assessed += counts.assessed;
      state.verified += counts.verified;
      state.students += counts.students;
      state.studentProfiles += counts.studentProfiles;
    }

    // Only districts with schools on the register. A district in the table but absent
    // from the import would read as a real district with no schools.
    const names = Object.keys(byDistrict).sort((a, b) => a.localeCompare(b));
    if (names.length === 0) return null;

    return { state, byDistrict, districts: names };
  } catch {
    return null;
  }
}
