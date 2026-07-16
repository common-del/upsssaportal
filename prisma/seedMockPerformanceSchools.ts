import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Statewide demo scale for the Low/High Performing Schools tiles - see
// buildStateDashboardData() in src/lib/sssa/adminMetrics.ts, which adds these
// counts on top of the real ones so the tiles and this seed stay in sync.
const LOW_TOTAL = 8745;
const HIGH_TOTAL = 23612;
const MOCK_UDISE_PREFIX = '9MOCK';

// Matches the real School.category convention used by prisma/seed-dummy.ts
// (ownership type, not grade level - see that file's own note on the mismatch
// with selfAssessment.ts's CATEGORY_TO_CODE).
const SCHOOL_TYPES = ['GOVT', 'GOVT_AIDED', 'PRIVATE_AIDED', 'PRIVATE'] as const;
const SCHOOL_TYPE_WEIGHTS = [0.6, 0.15, 0.15, 0.1];

function weightedPick<T>(items: T[], weights: number[]): T {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i]!;
    if (r < cum) return items[i]!;
  }
  return items[items.length - 1]!;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type Row = {
  udise: string;
  nameEn: string;
  nameHi: string;
  category: string;
  districtCode: string;
  blockCode: string;
  band: 'LOW' | 'HIGH';
};

async function main() {
  console.log('Seeding mock Low/High Performing statewide demo schools...');

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) {
    console.log('No active cycle - aborting.');
    return;
  }
  const framework = await prisma.framework.findUnique({ where: { cycleId: cycle.id } });
  if (!framework) {
    console.log('No framework for the active cycle - aborting.');
    return;
  }

  const existing = await prisma.school.count({ where: { udise: { startsWith: MOCK_UDISE_PREFIX } } });
  if (existing > 0) {
    console.log(`Mock performance schools already seeded (${existing} found) - skipping.`);
    return;
  }

  const blocks = await prisma.block.findMany({ select: { code: true, districtCode: true } });
  const districts = await prisma.district.findMany({ select: { code: true, nameEn: true, nameHi: true } });
  if (blocks.length === 0 || districts.length === 0) {
    console.log('No districts/blocks found - aborting.');
    return;
  }
  const districtNameEnMap = new Map(districts.map((d) => [d.code, d.nameEn]));
  const districtNameHiMap = new Map(districts.map((d) => [d.code, d.nameHi]));

  const rows: Row[] = [];
  let seq = 0;

  function genSchools(count: number, band: 'LOW' | 'HIGH') {
    for (let i = 0; i < count; i++) {
      const block = blocks[Math.floor(Math.random() * blocks.length)]!;
      const distNameEn = districtNameEnMap.get(block.districtCode) ?? '';
      const distNameHi = districtNameHiMap.get(block.districtCode) ?? distNameEn;
      seq++;
      rows.push({
        udise: `${MOCK_UDISE_PREFIX}${String(seq).padStart(8, '0')}`,
        nameEn: `${faker.company.name()} School, ${distNameEn}`,
        nameHi: `${faker.company.name()} स्कूल, ${distNameHi}`,
        category: weightedPick([...SCHOOL_TYPES], SCHOOL_TYPE_WEIGHTS),
        districtCode: block.districtCode,
        blockCode: block.code,
        band,
      });
    }
  }

  genSchools(LOW_TOTAL, 'LOW');
  genSchools(HIGH_TOTAL, 'HIGH');

  console.log(`Generated ${rows.length} mock schools (${LOW_TOTAL} low, ${HIGH_TOTAL} high). Inserting schools...`);

  for (const batch of chunk(rows, 1000)) {
    await prisma.school.createMany({
      data: batch.map((r) => ({
        udise: r.udise,
        nameEn: r.nameEn,
        nameHi: r.nameHi,
        category: r.category,
        districtCode: r.districtCode,
        blockCode: r.blockCode,
        addressEn: faker.location.streetAddress(),
      })),
      skipDuplicates: true,
    });
  }
  console.log('Schools inserted. Inserting Results...');

  for (const batch of chunk(rows, 1000)) {
    await prisma.result.createMany({
      data: batch.map((r) => {
        // Final score only ever comes from a verifier score, matching the
        // "no final score without a verifier score" rule used elsewhere.
        const finalScorePercent = r.band === 'LOW'
          ? Math.round(Math.random() * 3999) / 100
          : Math.round(7600 + Math.random() * 2400) / 100;
        const gradeBandCode = r.band === 'LOW' ? 'NEEDS_IMPROVEMENT' : 'EXCELLENT';
        return {
          cycleId: cycle.id,
          schoolUdise: r.udise,
          frameworkId: framework.id,
          selfScorePercent: finalScorePercent,
          verifierScorePercent: finalScorePercent,
          finalScorePercent,
          gradeBandCode,
          publishedAt: new Date(),
        };
      }),
      skipDuplicates: true,
    });
  }

  console.log(`✓ Mock performance schools seeded: ${LOW_TOTAL} low, ${HIGH_TOTAL} high (${rows.length} total).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
