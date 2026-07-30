import { cpus } from 'node:os';
import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Test-runner config. Two separate problems are solved here; keep them straight.
 *
 * ── 1. The balance/sim harnesses must not block the deploy ──────────────────
 *
 * `caster-variants`, `arena` and `sim-ai` play thousands of full battles to
 * check that the game stays balanced and the AI behaves. They are worth having,
 * but they are slow, entirely CPU-bound, and answer a different question than
 * "can we ship the web app." So they are gated by env, from one list:
 *
 *   - the Pages deploy sets SKIP_SIMS=1   -> everything EXCEPT the sims
 *   - a nightly workflow sets ONLY_SIMS=1 -> just the sims
 *   - `npm test` with neither set runs everything, which is what you want
 *     locally and what keeps the sims from rotting.
 *
 * The point is that a normal change is never validated against thousands of
 * battles just to reach production; the sims run on their own cadence.
 *
 * ── 2. When the sims DO run together, the coordinator must not starve ────────
 *
 * The deploy had failed for nine straight merges while every test passed, with:
 *
 *     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 *
 * `onTaskUpdate` is not one of vitest's `eventNames`, so it is a call-and-WAIT
 * RPC on birpc's 60s timeout: a worker reports progress to the main process and
 * throws if the main process doesn't answer in a minute. With a worker per core
 * all pegged by battle sims, the coordinator never gets the CPU to answer.
 *
 * The first fix left ONE core free; the sims still starved it (three of them
 * overlapping, plus the forks' V8/GC helper threads, oversubscribed the box).
 * So on CI we leave TWO cores free, and use the `dot` reporter so 1900+ tests
 * don't each cost a live-tree redraw round-trip. Both are pinned in
 * `test/ci-config.test.ts` with the reason, so a tidy-up doesn't delete them.
 */

// The balance/sim harnesses: slow, CPU-bound, not deploy-blocking. One list,
// consumed by SKIP_SIMS (exclude) and ONLY_SIMS (include).
const SIM_TESTS = [
  'test/caster-variants.test.ts',
  'test/arena.test.ts',
  'test/sim-ai.test.ts',
];

const ci = !!process.env.CI;
// Leave two cores free on CI: one for the coordinator that answers the workers,
// one for the forks' background (GC/JIT) threads. cpus()-1 was measured to be
// too few under the sims' load.
const forks = Math.max(1, (cpus().length || 2) - 2);

export default defineConfig({
  test: {
    reporters: ci ? ['dot'] : ['default'],
    poolOptions: {
      forks: { maxForks: ci ? forks : undefined },
      threads: { maxThreads: ci ? forks : undefined },
    },
    // Env-gated selection. ONLY_SIMS wins if both are somehow set.
    ...(process.env.ONLY_SIMS
      ? { include: SIM_TESTS }
      : process.env.SKIP_SIMS
        ? { exclude: [...configDefaults.exclude, ...SIM_TESTS] }
        : {}),
  },
});
