import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { MANDAL_SEED, DISTRICT_SEED, BLOCK_SEED } from './upGeoData';

const prisma = new PrismaClient();

/* ── Users ─────────────────────────────────────────────── */
const seedUsers = [
  { username: 'sssa', password: 'admin123', role: 'SSSA_ADMIN', districtCode: null },
  { username: '11111111111', password: 'school123', role: 'SCHOOL', districtCode: null },
  { username: 'verifier1', password: 'verifier123', role: 'VERIFIER', districtCode: null, verifierCapacity: 50 },
  { username: 'district1', password: 'district123', role: 'DISTRICT_OFFICIAL', districtCode: 'D001' },
];

/* ── Demo schools ──────────────────────────────────────────
   Only seeded for the 4 blocks that already had demo schools
   (Lucknow: Mohanlalganj/Bakshi-Ka-Talab, Varanasi: Pindra/Sevapuri) -
   the other 822 real UP blocks exist for the geography/analytics
   pages but don't get synthetic school records. */
const DEMO_BLOCK_CODES = ['B001', 'B002', 'B003', 'B004'];
const categories = ['Primary', 'Upper Primary', 'Secondary'];

function buildSchools() {
  const schools: {
    udise: string;
    nameEn: string;
    nameHi: string;
    category: string;
    districtCode: string;
    blockCode: string;
    addressEn: string | null;
    addressHi: string | null;
    publicPhone: string | null;
    feesRangeMin: number | null;
    feesRangeMax: number | null;
  }[] = [];

  const districtByCode = new Map(DISTRICT_SEED.map((d) => [d.code, d]));
  const demoBlocks = BLOCK_SEED.filter((b) => DEMO_BLOCK_CODES.includes(b.code));

  for (const block of demoBlocks) {
    const blockIdx = DEMO_BLOCK_CODES.indexOf(block.code);
    const district = districtByCode.get(block.districtCode)!;

    for (let i = 1; i <= 5; i++) {
      const globalIdx = blockIdx * 5 + i;
      const udise = `0901${String(blockIdx + 1).padStart(3, '0')}${String(i).padStart(4, '0')}`;
      const cat = categories[(i - 1) % 3];

      schools.push({
        udise,
        nameEn: `${block.nameEn} ${cat} School ${i}`,
        nameHi: `${block.nameHi} ${cat === 'Primary' ? 'प्राथमिक' : cat === 'Upper Primary' ? 'उच्च प्राथमिक' : 'माध्यमिक'} विद्यालय ${i}`,
        category: cat,
        districtCode: block.districtCode,
        blockCode: block.code,
        addressEn: i % 2 === 1 ? `${block.nameEn}, ${district.nameEn}, Uttar Pradesh` : null,
        addressHi: i % 2 === 1 ? `${block.nameHi}, ${district.nameHi}, उत्तर प्रदेश` : null,
        publicPhone: i % 3 === 1 ? `+91 522${String(1000000 + globalIdx)}` : null,
        feesRangeMin: i <= 3 ? 0 : 500,
        feesRangeMax: i <= 3 ? 0 : 2500,
      });
    }
  }

  // Add the demo school that matches the login user
  schools.push({
    udise: '11111111111',
    nameEn: 'Demo Model School',
    nameHi: 'डेमो मॉडल विद्यालय',
    category: 'Secondary',
    districtCode: 'D001',
    blockCode: 'B001',
    addressEn: 'Mohanlalganj, Lucknow, Uttar Pradesh',
    addressHi: 'मोहनलालगंज, लखनऊ, उत्तर प्रदेश',
    publicPhone: '+91 5221234567',
    feesRangeMin: 0,
    feesRangeMax: 0,
  });

  return schools;
}

/* ── Cycle ─────────────────────────────────────────────── */
const seedCycle = { name: '2025-26', isActive: true };

/* ── Rating Dimensions ────────────────────────────────── */
const seedDimensions = [
  { code: 'TEACHING', labelEn: 'Teaching Quality', labelHi: 'शिक्षण गुणवत्ता', order: 1 },
  { code: 'INFRA', labelEn: 'Infrastructure', labelHi: 'बुनियादी ढाँचा', order: 2 },
  { code: 'SAFETY', labelEn: 'Safety & Security', labelHi: 'सुरक्षा', order: 3 },
  { code: 'HYGIENE', labelEn: 'Hygiene & Cleanliness', labelHi: 'स्वच्छता', order: 4 },
  { code: 'ADMIN', labelEn: 'Administration', labelHi: 'प्रशासन', order: 5 },
];

/* ── Dispute Categories ────────────────────────────────── */
const seedCategories = [
  { code: 'CAT_FEE_FALSE', nameEn: 'False Fee Information', nameHi: 'गलत शुल्क जानकारी' },
  { code: 'CAT_INFRA_FALSE', nameEn: 'False Infrastructure Claims', nameHi: 'गलत बुनियादी ढाँचा दावे' },
  { code: 'CAT_SAFETY', nameEn: 'Safety Concern', nameHi: 'सुरक्षा चिंता' },
  { code: 'CAT_GRADE_DISPUTE', nameEn: 'Grade / Score Dispute', nameHi: 'ग्रेड / अंक विवाद' },
  { code: 'CAT_STAFF_CONDUCT', nameEn: 'Staff Conduct Issue', nameHi: 'कर्मचारी आचरण समस्या' },
  { code: 'CAT_OTHER', nameEn: 'Other', nameHi: 'अन्य' },
];

/* ── Main ──────────────────────────────────────────────── */
async function main() {
  console.log('Seeding users…');
  for (const u of seedUsers) {
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (exists) {
      console.log(`  exists: ${u.username} (${u.role})`);
      continue;
    }
    await prisma.user.create({
      data: {
        username: u.username,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
        districtCode: u.districtCode,
        ...('verifierCapacity' in u && u.verifierCapacity ? { verifierCapacity: u.verifierCapacity } : {}),
      },
    });
    console.log(`  created: ${u.username} (${u.role})`);
  }

  console.log('Seeding mandals…');
  for (const m of MANDAL_SEED) {
    await prisma.mandal.upsert({
      where: { code: m.code },
      update: { nameEn: m.nameEn, nameHi: m.nameHi },
      create: m,
    });
  }
  console.log(`  upserted ${MANDAL_SEED.length} mandals`);

  console.log('Seeding districts…');
  for (const d of DISTRICT_SEED) {
    await prisma.district.upsert({
      where: { code: d.code },
      update: { nameEn: d.nameEn, nameHi: d.nameHi, mandalCode: d.mandalCode },
      create: d,
    });
  }
  console.log(`  upserted ${DISTRICT_SEED.length} districts`);

  console.log('Seeding blocks…');
  for (const b of BLOCK_SEED) {
    await prisma.block.upsert({
      where: { code: b.code },
      update: { nameEn: b.nameEn, nameHi: b.nameHi, districtCode: b.districtCode },
      create: b,
    });
  }
  console.log(`  upserted ${BLOCK_SEED.length} blocks`);

  console.log('Seeding schools…');
  const schools = buildSchools();
  for (const s of schools) {
    await prisma.school.upsert({
      where: { udise: s.udise },
      update: {},
      create: s,
    });
  }
  console.log(`  upserted ${schools.length} schools`);

  console.log('Seeding cycle…');
  await prisma.cycle.upsert({
    where: { name: seedCycle.name },
    update: {},
    create: seedCycle,
  });
  console.log(`  upserted: ${seedCycle.name}`);

  console.log('Seeding rating dimensions…');
  for (const d of seedDimensions) {
    await prisma.ratingDimension.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }
  console.log(`  upserted ${seedDimensions.length} rating dimensions`);

  console.log('Seeding dispute categories…');
  for (const c of seedCategories) {
    await prisma.disputeCategory.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`  upserted ${seedCategories.length} dispute categories`);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
