import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gives the register's schools a pupil count, so the homepage's enrolment tile has
 * something to add up.
 *
 * This is demonstration data and it is worth being precise about why that is
 * acceptable here, because a near-identical thing was removed from this page a week
 * ago. What was removed was `totalSchools * 0.3` and a hardcoded state total of
 * 2,48,998 — figures derived at render time, on a page carrying no marker, describing
 * Uttar Pradesh rather than this portal. What this writes is a stored figure for
 * schools that are themselves seeded, on a portal that carries a non-dismissible
 * notice saying so, beside three tiles already counting the same seeded rows. It does
 * not make the bar less true than it is today; it fills the one hole in it.
 *
 * The real figures exist and cannot be reached yet, which is why this stands in:
 *
 *   - `data/up_schools_sample_named.csv` holds a real `total_enrolment` column
 *     (23,23,427 over 9,112 rows) keyed on an anonymised `pseudocode` that matches no
 *     school row. No join.
 *   - The pilot workbook holds 43 schools' self-reported enrolment against real UDISE
 *     codes, but those schools are absent from the register — `scripts/import-pilot.ts`
 *     has never been run here, and it cannot be added to the build blind because its
 *     step 7 deletes every Result row in the cycle for schools without a submitted
 *     self-assessment.
 *
 * Deterministic, keyed on the UDISE, so a figure never changes under a school between
 * deploys or between one page load and the next. Random values would be visibly broken
 * on refresh, and would make every derived figure downstream unstable.
 *
 * Never overwrites. `ON CONFLICT DO NOTHING` means a school that has entered its own
 * enrolment on its profile page keeps it, and it means rerunning this on every deploy
 * costs one statement per batch and changes nothing.
 *
 * To undo: delete SchoolProfileDetail rows where `totalStudents` is set and every other
 * answer is still null. When the real UDISE register lands it should overwrite these
 * outright.
 */

const BATCH_SIZE = 1_000;

/** Deterministic and cheap. Same shape as the hash in seedDemoSchoolStory. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_003;
  return h;
}

/**
 * Plausible enrolment for a school of this kind.
 *
 * `School.category` is not consistent across the register — seed.ts writes levels
 * ("Primary", "Upper Primary", "Secondary") while seed-dummy and the performance seed
 * write management codes ("GOVT", "PRIVATE") into the same column. So the level is
 * matched on keywords where it is present and a broad spread is used where it is not,
 * rather than trusting the column to mean one thing.
 */
function enrolmentFor(udise: string, category: string | null): number {
  const c = (category ?? '').toUpperCase();
  const [min, max] =
    c.includes('UPPER') ? [90, 480]
    : c.includes('HIGHER') || c.includes('SENIOR') ? [220, 1_100]
    : c.includes('SECOND') ? [180, 900]
    : c.includes('PRIMARY') ? [55, 320]
    : [70, 650];
  return min + (hash(udise) % (max - min + 1));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  // Only schools with no profile row at all. A school that has filled in any part of
  // its profile is left alone entirely, so this can never appear beside a school's own
  // answers as though the school had given both.
  const schools = await prisma.school.findMany({
    where: { profileDetail: null },
    select: { udise: true, category: true },
    orderBy: { udise: 'asc' },
  });

  if (schools.length === 0) {
    return console.log('demo enrolment: every school already has a profile — nothing to do');
  }

  let written = 0;
  let pupils = 0;

  for (const batch of chunk(schools, BATCH_SIZE)) {
    const values = batch.map((s) => {
      const n = enrolmentFor(s.udise, s.category);
      pupils += n;
      // Empty arrays as literals: facilities and safetyItems are non-nullable, and a
      // school that has not been asked has ticked nothing rather than everything.
      return Prisma.sql`(${s.udise}, ${n}, '{}'::text[], '{}'::text[], NOW())`;
    });

    written += await prisma.$executeRaw`
      INSERT INTO "SchoolProfileDetail"
        ("schoolUdise", "totalStudents", "facilities", "safetyItems", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("schoolUdise") DO NOTHING
    `;
    console.log(`  ${written}/${schools.length} written...`);
  }

  console.log(
    `demo enrolment: ${written} schools given a pupil count (${pupils.toLocaleString('en-IN')} pupils across the batch)`,
  );
}

main()
  .catch((e) => {
    console.error('demo enrolment failed:', e);
  })
  .finally(() => prisma.$disconnect());
