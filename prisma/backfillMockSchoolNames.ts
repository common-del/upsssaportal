import { PrismaClient } from '@prisma/client';
import {
  generateSchoolName,
  categoryFromManagement,
  looksLikeFakerName,
} from './indianSchoolNames';

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

/**
 * Replaces faker.company.name() school names with UP-appropriate ones.
 *
 * Seeded schools came out as "Pollich - White School, Kanpur Nagar" and
 * "Kozey, Towne and Nitzsche School, Prayagraj" — American company names with
 * "School" appended. This renames them to the conventions UP actually uses:
 * Rajkiya Prathmik Vidyalaya for government, Saraswati Vidya Mandir and Janta
 * Inter College for aided, St. Xavier's and DAV for private.
 *
 * Detection is positive — a name is replaced only if it carries a corporate
 * marker (Inc, LLC, "X - Y", "X, Y and Z"). A genuine name this script has never
 * seen is left alone rather than being renamed because it failed to match a list.
 *
 * Naming style follows School.management where it is set, so a government school
 * gets a government name. Where management is null it falls back to government,
 * which is the majority and the safest wrong answer.
 *
 * Names are keyed on the UDISE, so a school keeps the same name across reruns.
 *
 *   npx tsx prisma/backfillMockSchoolNames.ts --dry-run
 *   npx tsx prisma/backfillMockSchoolNames.ts
 *   npx tsx prisma/backfillMockSchoolNames.ts --all   # rename every school
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const all = process.argv.includes('--all');

  const schools = await prisma.school.findMany({
    select: {
      udise: true,
      nameEn: true,
      management: true,
      districtCode: true,
      blockCode: true,
    },
  });

  const targets = all ? schools : schools.filter((s) => looksLikeFakerName(s.nameEn));

  if (targets.length === 0) {
    console.log('No school names need replacing.');
    return;
  }
  console.log(`${targets.length} of ${schools.length} schools to rename.`);

  const [districts, blocks] = await Promise.all([
    prisma.district.findMany({ select: { code: true, nameEn: true, nameHi: true } }),
    prisma.block.findMany({ select: { code: true, nameEn: true, nameHi: true } }),
  ]);
  const districtMap = new Map(districts.map((d) => [d.code, d]));
  const blockMap = new Map(blocks.map((b) => [b.code, b]));

  const renames = targets.flatMap((s) => {
    const district = districtMap.get(s.districtCode);
    const block = blockMap.get(s.blockCode);
    if (!district || !block) return [];
    const { nameEn, nameHi } = generateSchoolName(
      categoryFromManagement(s.management),
      district.nameEn,
      district.nameHi,
      block.nameEn,
      block.nameHi,
      s.udise,
    );
    return [{ udise: s.udise, before: s.nameEn, nameEn, nameHi }];
  });

  console.log('\nSample:');
  for (const r of renames.slice(0, 8)) console.log(`  ${r.before}\n    → ${r.nameEn}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  let done = 0;
  for (const batch of chunk(renames, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((r) =>
        prisma.school.update({
          where: { udise: r.udise },
          data: { nameEn: r.nameEn, nameHi: r.nameHi },
        }),
      ),
    );
    done += batch.length;
    console.log(`  ${done}/${renames.length} renamed...`);
  }
  console.log(`\n✓ Renamed ${done} schools.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
