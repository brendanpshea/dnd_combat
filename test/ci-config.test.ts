import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
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
const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const deploy = read('.github/workflows/deploy.yml');

describe('the CI test runner', () => {
  const cfg = read('vitest.config.ts');
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

/**
 * A test that shells out to Python needs that Python's packages ON THE RUNNER.
 *
 * THE SECOND TIME THE DEPLOY WENT RED WHILE EVERY TEST PASSED.
 *
 * `token_fill.py --check` guards the table that sizes every monster token, and
 * it measures images, so it imports PIL. The runner installs node and nothing
 * else, so the check died as
 *
 *     ModuleNotFoundError: No module named 'PIL'
 *
 * inside a subprocess — red on every merge, green on every laptop that happens
 * to have Pillow. `art-thumbs.test.ts` had already met this and dodged it by
 * checking the filesystem "rather than a run of the generator, deliberately —
 * Python"; the lesson was in a comment rather than in a test, so the next
 * Python-invoking test walked straight into it.
 *
 * DERIVED, NOT LISTED. The scripts are found by scanning the tests for what
 * they actually execute, and their third-party imports by asking Python which
 * of their imports are outside the standard library. A hand-kept list here
 * would go stale exactly as silently as the thing it is guarding.
 */
describe('CI can run the checks the tests invoke', () => {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  /** Python scripts the suite runs as a subprocess. */
  const invoked = (): string[] => {
    const out = new Set<string>();
    // `root` is the repo root, so the tests are one level in. Getting this
    // wrong scans an empty directory and every assertion below passes on
    // nothing, which is why the count is checked separately.
    const dir = fileURLToPath(new URL('./test/', root));
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.test.ts')) continue;
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/execFileSync\(\s*pythonCmd\s*,\s*\[\s*'([^']+\.py)'/g)) {
        out.add(m[1]!);
      }
    }
    return [...out].sort();
  };

  /** Imports of `script` that are not in the Python standard library. */
  const thirdParty = (script: string): string[] => {
    const code = [
      'import ast,sys',
      `t=ast.parse(open(${JSON.stringify(script)},encoding="utf-8").read())`,
      'm=set()',
      'for n in ast.walk(t):',
      '  if isinstance(n,ast.Import):',
      '    m|={a.name.split(".")[0] for a in n.names}',
      '  elif isinstance(n,ast.ImportFrom) and n.level==0 and n.module:',
      '    m.add(n.module.split(".")[0])',
      'print(" ".join(sorted(x for x in m if x not in sys.stdlib_module_names)))',
    ].join('\n');
    return execFileSync(pythonCmd, ['-c', code], { cwd: fileURLToPath(root), encoding: 'utf8' })
      .trim().split(/\s+/).filter(Boolean);
  };

  /** Import name -> the package that provides it. */
  const PACKAGE: Record<string, string> = { PIL: 'pillow' };

  it('finds the Python the suite actually runs', () => {
    // Guards the guard: if the scan breaks, everything below passes vacuously.
    expect(invoked().length, 'no test appears to invoke Python — the scan is broken')
      .toBeGreaterThan(0);
  });

  it.each(invoked())('installs what %s imports', (script) => {
    for (const mod of thirdParty(script)) {
      const pkg = PACKAGE[mod];
      expect(pkg, `${script} imports ${mod}; add it to PACKAGE in this test and to deploy.yml`)
        .toBeDefined();
      expect(deploy, `the deploy never installs ${pkg}, which ${script} needs — it will die as ModuleNotFoundError inside a subprocess`)
        .toContain(pkg!);
    }
  });

  it('installs nothing it does not need', () => {
    // The other direction. A `pip install` left behind after its test is gone
    // is a slower deploy for no reason, and reads as a dependency that matters.
    const needed = new Set(invoked().flatMap(thirdParty).map((m) => PACKAGE[m]).filter(Boolean));
    for (const pkg of Object.values(PACKAGE)) {
      if (deploy.includes(pkg) && !needed.has(pkg)) {
        throw new Error(`deploy.yml installs ${pkg}, but no test invokes a script that imports it`);
      }
    }
  });
});
