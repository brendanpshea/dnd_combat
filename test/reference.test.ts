import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const REF = join(ROOT, 'docs/reference');

/**
 * `docs/reference/` is generated from `src/data/`. A generated file that nobody
 * regenerates is worse than no file: it reads as authoritative and is quietly
 * wrong, which is the failure mode the generator was written to end. SPEC.md
 * carried a stale monster count for several PRs before anyone noticed.
 *
 * So the check is not "does the reference look plausible" but "is it byte-for-
 * byte what the data would produce right now". Adding a monster without running
 * `npm run reference` fails here, with the fix in the message.
 */
describe('generated content reference', () => {
  it('is up to date with the data modules', () => {
    let out = '';
    try {
      out = execFileSync('npx', ['tsx', 'scripts/reference.ts', '--check'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true,
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      throw new Error(
        `${err.stderr ?? ''}${err.stdout ?? ''}\nRun \`npm run reference\` and commit the result.`,
      );
    }
    expect(out).toContain('up to date');
  }, 60000);

  /**
   * The generator walks `Object.values(...)` of each data module, so a whole
   * table can silently empty out if an import is renamed — the file would still
   * be "up to date" with a generator that emits nothing. These pin that the
   * biggest tables actually carry every row.
   */
  it('lists every monster, spell and class by id', () => {
    const monsters = readFileSync(join(REF, 'monsters.md'), 'utf8');
    const missingMonsters = Object.keys(MONSTERS).filter((id) => !monsters.includes(`\`${id}\``));
    expect(missingMonsters, `monsters absent from the reference: ${missingMonsters.join(', ')}`).toEqual([]);

    const spells = readFileSync(join(REF, 'spells.md'), 'utf8');
    const missingSpells = Object.keys(SPELLS).filter((id) => !spells.includes(`\`${id}\``));
    expect(missingSpells, `spells absent from the reference: ${missingSpells.join(', ')}`).toEqual([]);

    const classes = readFileSync(join(REF, 'classes.md'), 'utf8');
    for (const c of Object.values(CLASSES)) expect(classes, `${c.name} missing`).toContain(`## ${c.name}`);
  });

  it('warns off hand edits on every file, including the index', () => {
    const files = readdirSync(REF).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      expect(readFileSync(join(REF, f), 'utf8'), `${f} has no generated-file banner`)
        .toContain('Do not edit by hand');
    }
  });

  /**
   * An em dash is what the generator prints for "this field is absent". A
   * literal `undefined` or `[object Object]` in the output means a field shape
   * changed and the renderer for it was never updated — the table still looks
   * fine at a glance, which is why it needs asserting rather than eyeballing.
   */
  it('never prints a raw undefined or object', () => {
    for (const f of readdirSync(REF).filter((x) => x.endsWith('.md'))) {
      const body = readFileSync(join(REF, f), 'utf8');
      expect(body, `${f} prints undefined`).not.toMatch(/\bundefined\b/);
      expect(body, `${f} prints [object Object]`).not.toContain('[object Object]');
    }
  });
});
