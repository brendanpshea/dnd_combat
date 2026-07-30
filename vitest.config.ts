import { cpus } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * Test-runner config, added because the Pages deploy had been failing for nine
 * merges while every test passed.
 *
 * The failure was never a test. It was:
 *
 *     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 *     Test Files  131 passed (131)
 *          Tests  1941 passed (1941)
 *         Errors  1 error
 *     Process completed with exit code 1
 *
 * `onTaskUpdate` is not in vitest's `eventNames`, so it is a call-and-WAIT
 * RPC: the worker blocks until the main process answers, and throws if it
 * doesn't. Two things starve that answer on a shared runner, and this repo
 * supplies both.
 *
 * ONE: the suite is unusually CPU-bound for its size. `caster-variants` (66s),
 * `arena` (53s) and `sim-ai` (53s) are not slow because of I/O — they play
 * thousands of full battles. Left to its default, vitest opens a worker per
 * core, so the process that has to answer the RPC competes with N workers that
 * never yield. Leaving one core unclaimed costs a little wall-clock and gives
 * the coordinator somewhere to run.
 *
 * TWO: the default reporter re-renders a live task tree, so every state change
 * in 1941 tests is another round trip. `dot` asks for far fewer, and CI is
 * reading a log file afterwards rather than watching a tree redraw.
 *
 * Both are CI-only. A developer's machine has cores to spare and does want to
 * watch the tree.
 */
const ci = !!process.env.CI;
const spare = Math.max(1, (cpus().length || 2) - 1);

export default defineConfig({
  test: {
    reporters: ci ? ['dot'] : ['default'],
    poolOptions: {
      forks: { maxForks: ci ? spare : undefined },
      threads: { maxThreads: ci ? spare : undefined },
    },
  },
});
