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
 *     Test Files  132 passed (132)
 *          Tests  1944 passed (1944)
 *         Errors  1 error
 *     Process completed with exit code 1
 *
 * `onTaskUpdate` is not one of vitest's `eventNames`, so it is a call-and-WAIT
 * RPC with birpc's 60s timeout: the worker blocks until the main process
 * answers and throws if it never does. Sixty seconds of no answer is severe
 * starvation, and the balance sims arrange it — `caster-variants` alone spends
 * ~50s in CPU-bound tests playing thousands of battles, with `arena` and
 * `sim-ai` doing the same beside it, a worker per core.
 *
 * Two things keep the deploy green, and both are pinned here with the reason so
 * a tidy-up doesn't quietly delete them:
 *
 *  1. The deploy does not run the sims at all (SKIP_SIMS). They are balance
 *     checks, not ship-blockers, and run nightly in `sims.yml` (ONLY_SIMS)
 *     instead — a change never waits on thousands of battles to reach players.
 *  2. When the sims DO run together, `vitest.config.ts` leaves TWO cores free
 *     for the coordinator (one was too few) and uses a reporter that doesn't
 *     redraw a 1900-test tree on every update.
 */
describe('the CI test runner', () => {
  const root = new URL('../', import.meta.url);
  const read = (p: string) => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
  const cfg = read('vitest.config.ts');
  const deploy = read('.github/workflows/deploy.yml');
  const sims = read('.github/workflows/sims.yml');

  it('leaves cores for the process that answers the workers', () => {
    expect(cfg, 'a worker per core starves the RPC and the deploy stops').toContain('cpus()');
    expect(cfg).toMatch(/maxForks|maxThreads/);
  });

  it('asks CI for a reporter that is not a live tree', () => {
    expect(cfg, 'every task update is another round trip').toContain("'dot'");
    // ...and only on CI. A developer does want to watch the tree.
    expect(cfg).toContain('process.env.CI');
  });

  it('gates the sims by env, from one shared list', () => {
    // SKIP_SIMS excludes them, ONLY_SIMS runs only them; `npm test` bare runs
    // everything (local dev, keeps them from rotting).
    expect(cfg).toContain('SKIP_SIMS');
    expect(cfg).toContain('ONLY_SIMS');
    expect(cfg, 'the sim list must be real files').toContain('caster-variants');
  });

  it('keeps the sims out of the deploy but still gates it', () => {
    // The wrong fix for a flaky gate is to stop gating: the deploy still runs
    // the (fast) suite, and `deploy` still waits on `build`.
    expect(deploy).toContain('npm test');
    expect(deploy, 'the deploy must not run the slow sims').toContain('SKIP_SIMS');
    expect(deploy).toMatch(/deploy:[\s\S]*needs: build/);
  });

  it('runs the sims on their own cadence, not on every change', () => {
    expect(sims).toContain('ONLY_SIMS');
    expect(sims, 'nightly, so a normal change is never gated on them').toContain('schedule');
    expect(sims, 'and on demand').toContain('workflow_dispatch');
    // Deliberately NOT triggered by push — that is the whole point.
    expect(sims).not.toMatch(/^\s*push:/m);
  });
});
