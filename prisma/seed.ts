import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/* ── Users ─────────────────────────────────────────────── */
const seedUsers = [
  { username: 'sssa', password: 'admin123', role: 'SSSA_ADMIN', districtCode: null },
  { username: '11111111111', password: 'school123', role: 'SCHOOL', districtCode: null },
  { username: 'verifier1', password: 'verifier123', role: 'VERIFIER', districtCode: null },
  { username: 'district1', password: 'district123', role: 'DISTRICT_OFFICIAL', districtCode: 'D001' },
];

/* ── Districts ─────────────────────────────────────────── */
const seedDistricts = [
  { code: 'D001', nameEn: 'Lucknow', nameHi: 'लखनऊ' },
  { code: 'D002', nameEn: 'Varanasi', nameHi: 'वाराणसी' },
];

/* ── Blocks ────────────────────────────────────────────── */
const seedBlocks = [
  { code: 'B001', districtCode: 'D001', nameEn: 'Mohanlalganj', nameHi: 'मोहनलालगंज' },
  { code: 'B002', districtCode: 'D001', nameEn: 'Bakshi Ka Talab', nameHi: 'बक्शी का तालाब' },
  { code: 'B003', districtCode: 'D002', nameEn: 'Pindra', nameHi: 'पिंडरा' },
  { code: 'B004', districtCode: 'D002', nameEn: 'Sevapuri', nameHi: 'सेवापुरी' },
];

/* ── Schools ───────────────────────────────────────────── */
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

  const districtNameHi: Record<string, string> = { D001: 'लखनऊ', D002: 'वाराणसी' };
  const districtNameEn: Record<string, string> = { D001: 'Lucknow', D002: 'Varanasi' };

  for (const block of seedBlocks) {
    for (let i = 1; i <= 5; i++) {
      const blockIdx = seedBlocks.indexOf(block);
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
        addressEn: i % 2 === 1 ? `${block.nameEn}, ${districtNameEn[block.districtCode]}, Uttar Pradesh` : null,
        addressHi: i % 2 === 1 ? `${block.nameHi}, ${districtNameHi[block.districtCode]}, उत्तर प्रदेश` : null,
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
      },
    });
    console.log(`  created: ${u.username} (${u.role})`);
  }

  console.log('Seeding districts…');
  for (const d of seedDistricts) {
    await prisma.district.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
    console.log(`  upserted: ${d.code} ${d.nameEn}`);
  }

  console.log('Seeding blocks…');
  for (const b of seedBlocks) {
    await prisma.block.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
    console.log(`  upserted: ${b.code} ${b.nameEn}`);
  }

  console.log('Seeding schools…');
  const schools = buildSchools();
  for (const s of schools) {
    await prisma.school.upsert({
      where: { udise: s.udise },
      update: {},
      create: s,
    });
    console.log(`  upserted: ${s.udise} ${s.nameEn}`);
  }

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
    console.log(`  upserted: ${d.code} ${d.labelEn}`);
  }

  console.log('Seeding dispute categories…');
  for (const c of seedCategories) {
    await prisma.disputeCategory.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log(`  upserted: ${c.code} ${c.nameEn}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
