/**
 * The whole repository typechecks — scripts and tests included.
 *
 * `tsconfig.json` covers only `src`, because that is what ships. For a long
 * time that meant `npx tsc --noEmit` had never once looked at `scripts/` or
 * `test/`, and vitest transpiles without typechecking, so *nothing* looked at
 * them. The consequences were not theoretical:
 *
 *   - a measurement script read `day?.dayNumber` off a type with no such
 *     property, which is not an error at runtime, just `undefined` — and the
 *     sweep it fed reported plausible numbers computed from a wrong seed;
 *   - an arena test set `ch.hp = 1` on a character whose hit points live in
 *     `ch.resources.hp`, so the party walked into `longRest` at full health
 *     and the assertion held for the wrong reason. That test could not have
 *     failed;
 *   - `makeCombatant` never set `innateSpells`, a *required* field, so every
 *     combatant built in every test was missing it;
 *   - a combat test passed `weaponIds: ['javelin']`, which is not a field on
 *     Combatant at all and was silently spread onto the object.
 *
 * Every one of those is the same shape: a thing that looks like it is being
 * tested and is not. The typechecker finds them for free, so it should run.
 *
 * This is slow (a full compile of the repository) and is deliberately the only
 * test that shells out to `tsc`.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

describe('typecheck', () => {
  it('has no type errors anywhere in the repository', () => {
    let out = '';
    try {
      out = execFileSync('npx', ['tsc', '-p', 'tsconfig.all.json', '--noEmit'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true,
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      const report = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
      throw new Error(
        `${report}\n\nRun \`npx tsc -p tsconfig.all.json --noEmit\` to reproduce.`,
      );
    }
    expect(out.trim()).toBe('');
  }, 180000);
});
