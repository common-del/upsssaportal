import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seedUsers = [
  { username: 'sssa', password: 'admin123', role: 'SSSA_ADMIN', districtCode: null },
  { username: '11111111111', password: 'school123', role: 'SCHOOL', districtCode: null },
  { username: 'verifier1', password: 'verifier123', role: 'VERIFIER', districtCode: null },
  { username: 'district1', password: 'district123', role: 'DISTRICT_OFFICIAL', districtCode: 'D001' },
];

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
