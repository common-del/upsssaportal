import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Creates the single ProgrammeConfig row and the first risk rubric.
 *
 * Both have to exist before any part of the verification pipeline can run, because the
 * brief forbids constants: there is nowhere for the code to fall back to if the row is
 * missing. So this runs in the build chain, creates the row if it is absent, and then
 * leaves it alone for ever. An `update: {}` on the upsert is deliberate. Once SSSA has
 * edited a threshold through the admin screen, a deploy must not quietly put the default
 * back.
 *
 * Idempotent, and safe to rerun.
 */

async function main() {
  const config = await prisma.programmeConfig.upsert({
    where: { id: 'current' },
    // Defaults all live on the schema, so the shape of a fresh row is described in one
    // place rather than split between the model and this file.
    create: { id: 'current' },
    update: {},
  });

  const existingRubric = await prisma.riskRubric.findFirst({ where: { version: 1 } });
  if (existingRubric) {
    console.log(
      `verification programme: config ${config.id} present, rubric v${existingRubric.version} present`,
    );
    return;
  }

  // The rubric needs an author, and RiskRubric.createdByUserId is required so a change to
  // scoring can always be attributed. Version 1 was not authored by a person, so it is
  // attributed to the first SSSA admin account rather than to nobody.
  const author = await prisma.user.findFirst({
    where: { role: { in: ['SSSA_ADMIN', 'admin'] }, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!author) {
    return console.log('verification programme: no SSSA admin to attribute rubric v1 to');
  }

  /* Weights are a first cut, not a calibrated instrument, and they are versioned so that
     saying so costs nothing later.

     The reasoning behind the ordering: evidence that actively contradicts the claimed
     level is the strongest signal a desk screener can produce, because someone has looked
     at a document and found it says the opposite. An automated mismatch scores lower than
     that despite being objective, because the external sources are stale by days at best
     and a UDISE field disagreeing with a school is often a data-currency problem rather
     than a false claim. Missing evidence scores above insufficient evidence: nothing
     uploaded is a clearer failure than something uploaded that does not go far enough. */
  const rubric = await prisma.riskRubric.create({
    data: {
      version: 1,
      label: 'Initial rubric, uncalibrated',
      weights: {
        AUTO_MISMATCH: 2,
        EVIDENCE_SUPPORTS_LEVEL: 0,
        EVIDENCE_INSUFFICIENT: 2,
        EVIDENCE_MISSING: 3,
        EVIDENCE_CONTRADICTS_LEVEL: 4,
        // Applied once per run, not per indicator, when a verifier could not apply the
        // rubric at all. An escalated case should not read as low risk merely because
        // fewer indicators were decided.
        ESCALATED_RUN: 5,
      },
      thresholdBasis: 'MATCHED_INDICATORS_ONLY',
      thresholdValue: 20,
      minimumAutoIndicatorsForBasis: 5,
      isActive: true,
      activatedAt: new Date(),
      createdByUserId: author.id,
    },
  });

  console.log(
    `verification programme: config ${config.id} ready, rubric v${rubric.version} created and active`,
  );
}

main()
  .catch((e) => {
    console.error('verification programme seed failed:', e);
  })
  .finally(() => prisma.$disconnect());
