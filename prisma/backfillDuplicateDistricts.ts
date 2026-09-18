/**
 * Folds duplicate districts back into the ones the register is supposed to have.
 *
 * `seed-dummy.ts` creates its own five districts, coded LKO, VNS, PRG, KNP and GKP, for Lucknow,
 * Varanasi, Prayagraj, Kanpur Nagar and Gorakhpur. All five already exist in `DISTRICT_SEED`
 * under their D0xx codes. Uttar Pradesh has 75 districts and the register held 80, with schools
 * hanging off both sets, so the state dashboard's ranking ran to rank 80 and the same district
 * appeared twice in it.
 *
 * That seed is not in the build chain, so this is residue from a manual run against the demo
 * database rather than something the build keeps recreating. It is still fixed here rather than
 * by hand, because a database somebody repaired by hand is one nobody can rebuild.
 *
 * Which row is canonical is not a judgement: `DISTRICT_SEED` is the authoritative list of the 75,
 * so a district whose code is in it stays and a same-named district whose code is not is folded
 * into it. Where a name has duplicates and none of them is in the seed, nothing is touched and
 * the pair is reported, because guessing which of two unknown rows is real is how a register
 * loses schools.
 *
 * Nothing is deleted before everything pointing at it has been moved. Two tables hold a real
 * foreign key, Block and School; five more carry the code as a plain string with no constraint to
 * catch them, which is exactly why they are easy to miss: User, Ticket, VerifierDistrict,
 * VerifierExclusion and FieldVisit.
 *
 * Idempotent: with no duplicates left it reports that and does nothing.
 *
 *   npx tsx prisma/backfillDuplicateDistricts.ts --dry-run
 *   npx tsx prisma/backfillDuplicateDistricts.ts
 */
import { PrismaClient } from '@prisma/client';
import { DISTRICT_SEED } from './upGeoData';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const canonicalCodes = new Set(DISTRICT_SEED.map((d) => d.code));
  const districts = await prisma.district.findMany({ select: { code: true, nameEn: true } });

  const byName = new Map<string, { code: string; nameEn: string }[]>();
  for (const d of districts) {
    const key = d.nameEn.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), d]);
  }

  const moves: { from: string; to: string; name: string }[] = [];
  const unresolved: string[] = [];

  for (const [, rows] of byName) {
    if (rows.length < 2) continue;
    const canonical = rows.find((r) => canonicalCodes.has(r.code));
    if (!canonical) {
      // Two rows, neither in the seeded list. Which one the register means is not something
      // this script can know, so it says so and leaves both.
      unresolved.push(`${rows[0].nameEn}: ${rows.map((r) => r.code).join(', ')}`);
      continue;
    }
    for (const r of rows) {
      if (r.code !== canonical.code) {
        moves.push({ from: r.code, to: canonical.code, name: canonical.nameEn });
      }
    }
  }

  if (unresolved.length > 0) {
    console.log('Duplicate districts this script will not touch, because neither code is seeded:');
    for (const u of unresolved) console.log(`  ${u}`);
  }

  if (moves.length === 0) {
    console.log(`${districts.length} districts, no duplicates to fold. Nothing to do.`);
    return;
  }

  console.log(`${districts.length} districts, ${moves.length} duplicated:`);
  for (const m of moves) {
    const [schools, blocks] = await Promise.all([
      prisma.school.count({ where: { districtCode: m.from } }),
      prisma.block.count({ where: { districtCode: m.from } }),
    ]);
    console.log(`  ${m.from} → ${m.to} (${m.name}): ${schools} schools, ${blocks} blocks`);
  }

  if (dryRun) {
    console.log('Dry run, nothing written.');
    return;
  }

  for (const m of moves) {
    // Blocks first. A school keeps its blockCode, so moving the block and then the school leaves
    // the pair consistent at every step rather than only at the end.
    await prisma.block.updateMany({ where: { districtCode: m.from }, data: { districtCode: m.to } });
    await prisma.school.updateMany({ where: { districtCode: m.from }, data: { districtCode: m.to } });

    // The five that carry the code as a plain string. No foreign key would have caught these.
    await prisma.user.updateMany({ where: { districtCode: m.from }, data: { districtCode: m.to } });
    await prisma.ticket.updateMany({ where: { districtCode: m.from }, data: { districtCode: m.to } });
    await prisma.verifierExclusion.updateMany({
      where: { districtCode: m.from },
      data: { districtCode: m.to },
    });
    await prisma.fieldVisit.updateMany({
      where: { districtCode: m.from },
      data: { districtCode: m.to },
    });

    // VerifierDistrict is unique on (verifierUserId, districtCode), so a verifier already holding
    // the canonical district would collide. Those rows are dropped rather than moved: the pair
    // they would become already exists.
    const claims = await prisma.verifierDistrict.findMany({
      where: { districtCode: m.from },
      select: { id: true, verifierUserId: true },
    });
    for (const c of claims) {
      const existing = await prisma.verifierDistrict.findFirst({
        where: { verifierUserId: c.verifierUserId, districtCode: m.to },
        select: { id: true },
      });
      if (existing) {
        await prisma.verifierDistrict.delete({ where: { id: c.id } });
      } else {
        await prisma.verifierDistrict.update({ where: { id: c.id }, data: { districtCode: m.to } });
      }
    }

    await prisma.district.delete({ where: { code: m.from } });
    console.log(`  folded ${m.from} into ${m.to}`);
  }

  const left = await prisma.district.count();
  console.log(`${left} districts remain.`);
}

main()
  .catch((e) => {
    console.error('duplicate district backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
