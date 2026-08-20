import { PrismaClient } from '@prisma/client';
import { REAL_FRAMEWORK_DATA } from './realFrameworkData';

const prisma = new PrismaClient();

/**
 * Applies the real SCERT domain weights to every framework already in the database.
 *
 * The seed carries them now, but the domains exist in the deployed database with the old equal
 * 20% placeholder, and a seed does not revisit rows it has already created. Without this, the
 * corrected weights would only reach a database built from scratch.
 *
 * Two things this deliberately does not do.
 *
 * It does not recompute any Result. Scores computed under the placeholder weights are wrong,
 * and rewriting them here would change published figures silently as a side effect of a deploy.
 * Recomputation belongs to `finalizeAllResults`, which SSSA runs knowingly, and
 * `backfillResultsFromResponses` already runs later in the build chain for the same reason.
 * What this commit does is make the next computation right.
 *
 * It does not touch a PUBLISHED framework's weights any differently from a draft's. A published
 * framework whose weights were wrong was published wrong; freezing the error to preserve
 * immutability would keep every future score wrong to protect a number that was never correct.
 */

async function main() {
  const domains = await prisma.sqaafDomain.findMany({
    select: { id: true, code: true, titleEn: true, weightPercent: true, frameworkId: true },
  });

  if (domains.length === 0) {
    return console.log('domain weights: no domains found');
  }

  const target = new Map(REAL_FRAMEWORK_DATA.map((d) => [d.code, d.weightPercent]));

  const sum = [...new Set(REAL_FRAMEWORK_DATA.map((d) => d.code))].reduce(
    (acc, code) => acc + (target.get(code) ?? 0),
    0,
  );
  if (sum !== 100) {
    // Refuses rather than writing weights that cannot produce a percentage. Better a build log
    // line than a state-wide score computed over weights summing to 97.
    return console.log(`domain weights: refusing to apply, weights sum to ${sum} and not 100`);
  }

  let changed = 0;
  const unknown: string[] = [];

  for (const d of domains) {
    const want = target.get(d.code);
    if (want === undefined) {
      unknown.push(`${d.code} (${d.titleEn})`);
      continue;
    }
    if (d.weightPercent === want) continue;

    await prisma.sqaafDomain.update({
      where: { id: d.id },
      data: { weightPercent: want },
    });
    console.log(`  ${d.code} ${d.titleEn}: ${d.weightPercent ?? 'null'}% -> ${want}%`);
    changed += 1;
  }

  console.log(
    `domain weights: ${domains.length} domain rows checked, ${changed} updated, sum ${sum}%`,
  );

  if (unknown.length > 0) {
    console.log(
      `domain weights: ${unknown.length} domain(s) not in the weightage table, left unchanged: ` +
        unknown.join(', '),
    );
  }
}

main()
  .catch((e) => {
    console.error('domain weights backfill failed:', e);
  })
  .finally(() => prisma.$disconnect());
