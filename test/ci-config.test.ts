import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The deploy is the only thing that puts work in front of a player, and it had
 * been failing for nine straight merges while every test passed. Reported the
 * way a user notices it: "are any of these changes making it to dist. in an
 * incognito load from github, not seeing anything."
 *
 *     Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 *     Test Files  131 passed (131)
 *          Tests  1941 passed (1941)
 *         Errors  1 error
 *     Process completed with exit code 1
 *
 * `onTaskUpdate` is not one of vitest's `eventNames`, so it is a call-and-WAIT
 * RPC with birpc's 60s timeout: the worker blocks until the main process
 * answers and throws if it never does. Sixty seconds of no answer is severe
 * starvation, and this suite arranges it — `caster-variants` alone spends 50s
 * in one CPU-bound test playing thousands of battles, while a worker per core
 * does the same beside it.
 *
 * `vitest.config.ts` leaves one core for the coordinator and asks CI for a
 * reporter that doesn't redraw a 1941-test tree. Both look like fussy tuning
 * that a tidy-up would delete, so they are pinned here with the reason.
 */
describe('the CI test runner', () => {
  const cfg = readFileSync(fileURLToPath(new URL('../vitest.config.ts', import.meta.url)), 'utf8');
  const wf = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8');

  it('leaves a core for the process that answers the workers', () => {
    expect(cfg, 'a worker per core starves the RPC and the deploy stops').toContain('cpus()');
    expect(cfg).toMatch(/maxForks|maxThreads/);
  });

  it('asks CI for a reporter that is not a live tree', () => {
    expect(cfg, 'every task update is another round trip').toContain("'dot'");
    // ...and only on CI. A developer does want to watch the tree.
    expect(cfg).toContain('process.env.CI');
  });

  it('still refuses to deploy a red build', () => {
    // The wrong fix for a flaky gate is to stop gating. `deploy` runs only
    // after `build`, and `build` runs the suite.
    expect(wf).toContain('npm test');
    expect(wf, 'the deploy no longer waits for the build').toMatch(/deploy:[\s\S]*needs: build/);
  });
});
