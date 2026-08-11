import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

/**
 * Gives the homepage a real pupil count, from the one place schools have ever been
 * asked for one.
 *
 * The register carries no enrolment. `data/up_schools_sample_named.csv` does — a real
 * `total_enrolment` column summing to 23,23,427 — but it is keyed on an anonymised
 * `pseudocode` (`1000184`) that matches no school row: register codes are generated
 * (`09DDBBSSSSS` from seed-dummy, `9MOCK########` from the performance seed). There is
 * no join, so that file cannot supply a single pupil figure.
 *
 * The pilot workbook can. Question 9 of the SQAAF pilot form —
 * "कुल विद्यार्थी नामांकन (Number of Students Enrolled in the School)" — was answered by
 * the schools themselves, against their real 11-digit UDISE codes. 43 distinct schools,
 * 20,844 pupils, 63 to 2,721 each. That is the same provenance as the enrolment box on
 * the school profile page, so it is written to the same field rather than a new one.
 *
 * Two guards matter:
 *
 *   - A school that has entered its own figure is never overwritten. This reruns on
 *     every deploy, and a backfill that clobbers a school's own correction would make
 *     the profile form pointless.
 *   - Schools absent from the register are skipped. `scripts/import-pilot.ts` is a
 *     one-time manual script, not part of the build, so the pilot schools may not be
 *     present. The count of skips is logged: nothing set means that import never ran,
 *     which is worth seeing in the build log rather than guessing at.
 */

const PILOT_FILE = path.resolve(__dirname, '..', 'data', 'pilot', 'SQAAF Pilot Responses UP Feb.xlsx');
const SHEET = 'Form Responses 1';

/** Column 9 of the pilot form. Held as an index because the header is bilingual and
 *  carries a newline, which makes matching on its text brittle. */
const ENROLMENT_COL = 9;

/** A school with 20,000 pupils is a typo, not a school. Rejected rather than imported. */
const MAX_PLAUSIBLE = 20_000;

async function main() {
  if (!fs.existsSync(PILOT_FILE)) {
    return console.log('pilot enrolment: workbook not found, nothing to do');
  }

  const wb = XLSX.readFile(PILOT_FILE);
  const ws = wb.Sheets[SHEET];
  if (!ws) return console.log(`pilot enrolment: no sheet "${SHEET}"`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (rows.length < 2) return console.log('pilot enrolment: sheet is empty');

  // The UDISE column is found by header text, the way import-pilot.ts finds it, so the
  // two scripts stay in agreement if the form is ever re-exported with columns moved.
  const header = (rows[0] as unknown[]).map((h) => String(h ?? ''));
  const udiseCol = header.findIndex(
    (h) => h.includes('UDISE') && (h.includes('कोड') || h.includes('Code')),
  );
  if (udiseCol === -1) return console.log('pilot enrolment: could not find the UDISE column');

  // One row per response, and some schools responded more than once. Last answer wins,
  // which is the rule import-pilot.ts already applies to the same sheet.
  const byUdise = new Map<string, number>();
  let unusable = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const udise = String(row[udiseCol] ?? '').trim();
    if (!udise) continue;

    const digits = String(row[ENROLMENT_COL] ?? '').replace(/[^0-9]/g, '');
    const value = Number.parseInt(digits, 10);
    if (!Number.isFinite(value) || value <= 0 || value > MAX_PLAUSIBLE) {
      unusable++;
      continue;
    }
    byUdise.set(udise, value);
  }

  if (byUdise.size === 0) {
    return console.log('pilot enrolment: no usable figures in the workbook');
  }

  const known = new Set(
    (
      await prisma.school.findMany({
        where: { udise: { in: [...byUdise.keys()] } },
        select: { udise: true },
      })
    ).map((s) => s.udise),
  );

  let set = 0;
  let kept = 0;
  let absent = 0;

  for (const [udise, students] of byUdise) {
    if (!known.has(udise)) {
      absent++;
      continue;
    }

    const existing = await prisma.schoolProfileDetail.findUnique({
      where: { schoolUdise: udise },
      select: { totalStudents: true },
    });

    if (existing?.totalStudents != null) {
      kept++;
      continue;
    }

    await prisma.schoolProfileDetail.upsert({
      where: { schoolUdise: udise },
      create: { schoolUdise: udise, totalStudents: students, facilities: [], safetyItems: [] },
      update: { totalStudents: students },
    });
    set++;
  }

  const total = [...byUdise].reduce((a, [, v]) => a + v, 0);
  console.log(
    `pilot enrolment: ${byUdise.size} schools in the workbook (${total.toLocaleString('en-IN')} pupils) — ` +
      `set ${set}, already answered ${kept}, not on the register ${absent}, unusable rows ${unusable}`,
  );
}

main()
  .catch((e) => {
    console.error('pilot enrolment failed:', e);
  })
  .finally(() => prisma.$disconnect());
