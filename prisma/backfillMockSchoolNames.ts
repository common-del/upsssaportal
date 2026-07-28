import { PrismaClient } from '@prisma/client';
import { generateSchoolName, type MockSchoolCategory } from './indianSchoolNames';

const prisma = new PrismaClient();

const MOCK_UDISE_PREFIX = '9MOCK';
const BATCH_SIZE = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// One-off fix for the 32,357 rows seeded by seedMockPerformanceSchools.ts
// before it used generateSchoolName() - those rows got un-localized
// faker.company.name() names instead of UP-appropriate ones. Only touches
// nameEn/nameHi on rows with the 9MOCK UDISE prefix; every other field and
// every non-mock school is untouched.
async function main() {
  console.log('Backfilling names for existing mock performance schools...');

  const schools = await prisma.school.findMany({
    where: { udise: { startsWith: MOCK_UDISE_PREFIX } },
    select: { udise: true, category: true, districtCode: true, blockCode: true },
  });

  if (schools.length === 0) {
    console.log('No 9MOCK-prefixed schools found - nothing to backfill.');
    return;
  }
  console.log(`Found ${schools.length} mock schools to rename.`);

  const districtCodes = [...new Set(schools.map((s) => s.districtCode))];
  const blockCodes = [...new Set(schools.map((s) => s.blockCode))];

  const [districts, blocks] = await Promise.all([
    prisma.district.findMany({
      where: { code: { in: districtCodes } },
      select: { code: true, nameEn: true, nameHi: true },
    }),
    prisma.block.findMany({
      where: { code: { in: blockCodes } },
      select: { code: true, nameEn: true, nameHi: true },
    }),
  ]);
  const districtMap = new Map(districts.map((d) => [d.code, d]));
  const blockMap = new Map(blocks.map((b) => [b.code, b]));

  let done = 0;
  for (const batch of chunk(schools, BATCH_SIZE)) {
    await Promise.all(
      batch.map((s) => {
        const district = districtMap.get(s.districtCode);
        const block = blockMap.get(s.blockCode);
        if (!district || !block) return Promise.resolve();
        const { nameEn, nameHi } = generateSchoolName(
          s.category as MockSchoolCategory,
          district.nameEn,
          district.nameHi,
          block.nameEn,
          block.nameHi,
        );
        return prisma.school.update({
          where: { udise: s.udise },
          data: { nameEn, nameHi },
        });
      }),
    );
    done += batch.length;
    console.log(`  ${done}/${schools.length} renamed...`);
  }

  console.log(`✓ Backfilled names for ${done} mock schools.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
