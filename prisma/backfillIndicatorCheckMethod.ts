import { PrismaClient } from '@prisma/client';
import {
  INDICATOR_SOURCES,
  mappingFor,
  mappingSummary,
} from '../src/lib/verification/indicatorSources';

const prisma = new PrismaClient();

/**
 * Writes the AUTO or MANUAL classification onto every Parameter row.
 *
 * Kept as a backfill rather than folded into the framework seed for two reasons. The
 * framework seed carries the SCERT checklist verbatim and should stay a faithful
 * transcription; which government system can answer an indicator is a programme decision
 * layered on top, and it will change as the departments confirm what they actually expose.
 * And the indicators already exist in the deployed database, so they need updating in place
 * rather than reseeding.
 *
 * Reruns freely. It overwrites the classification every time, deliberately: this mapping is
 * the source of truth in code, so a hand edit in the database should not survive a deploy
 * and quietly diverge from what the file says.
 */

async function main() {
  const params = await prisma.parameter.findMany({
    select: { id: true, code: true, checkMethod: true, externalSource: true },
  });

  if (params.length === 0) {
    return console.log('indicator check method: no parameters found');
  }

  let auto = 0;
  let manual = 0;
  let changed = 0;
  const unmapped: string[] = [];

  for (const p of params) {
    if (!(p.code in INDICATOR_SOURCES)) unmapped.push(p.code);
    const m = mappingFor(p.code);

    const isChange =
      p.checkMethod !== m.checkMethod || p.externalSource !== m.externalSource;
    if (isChange) changed += 1;

    await prisma.parameter.update({
      where: { id: p.id },
      data: {
        checkMethod: m.checkMethod,
        externalSource: m.externalSource,
        externalFieldKey: m.externalFieldKey,
      },
    });

    if (m.checkMethod === 'AUTO') auto += 1;
    else manual += 1;
  }

  const s = mappingSummary();
  console.log(
    `indicator check method: ${params.length} indicators, ${auto} AUTO and ${manual} MANUAL ` +
      `(${changed} changed). Mapping holds ${s.total} entries: ` +
      `UDISE+ ${s.bySource.UDISE_PLUS}, Prerna ${s.bySource.PRERNA}, ` +
      `Manav Sampada ${s.bySource.MANAV_SAMPADA}, of which ${s.unconfirmedKeys} field keys ` +
      `are still placeholders.`,
  );

  // Unmapped codes default to MANUAL, which is safe but costs screening time, so the log
  // names them rather than letting them accumulate unnoticed.
  if (unmapped.length > 0) {
    console.log(
      `indicator check method: ${unmapped.length} indicator(s) not in the mapping, ` +
        `defaulted to MANUAL: ${unmapped.slice(0, 20).join(', ')}` +
        (unmapped.length > 20 ? ' ...' : ''),
    );
  }
}

main()
  .catch((e) => {
    console.error('indicator check method backfill failed:', e);
  })
  .finally(() => prisma.$disconnect());
