import { defineConfig } from 'vitest/config';
import path from 'path';

const here = import.meta.dirname;

/**
 * The portal had no automated tests at all, which the security review recorded as a
 * finding: nothing verified that a school could not read another school's report, or that
 * an unanswerable cross-match did not count as a pass.
 *
 * Node environment and no setup file, on purpose. The tests worth writing first are the
 * pure decision functions the brief singles out — the state machine, the risk rubric, the
 * reveal time-gate and the anonymity masking — none of which need a browser or a database.
 * Anything that needs those is a sign the logic should be extracted, as decideOutcome was.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
});
