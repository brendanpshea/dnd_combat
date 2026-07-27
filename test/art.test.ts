import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ART = join(ROOT, 'web/public/art');
const WEB = join(ROOT, 'web/src');

/**
 * `art.ts` keeps four hand-written sets naming which ids have generated art,
 * and the files themselves live in `web/public/art`. Two lists that must agree
 * and nothing checking them is the same shape of problem the generated content
 * reference was written to end — except here both directions fail silently:
 *
 *  - declared but no file  → a broken <img>, where the emoji fallback would
 *    have looked fine
 *  - file but not declared → art that was generated, committed and shipped in
 *    the bundle, and that nothing ever displays
 *
 * Both were clean when this was written. The test is what keeps them clean.
 */

/** Ids inside `export const NAME = new Set<string>([ ... ])`. */
function setOf(name: string): string[] {
  const src = readFileSync(join(WEB, 'art.ts'), 'utf8');
  const i = src.indexOf(`export const ${name} = new Set<string>([`);
  expect(i, `no set named ${name}`).toBeGreaterThan(-1);
  // Comments first: the prose inside these sets contains apostrophes ("the
  // forge's species x class matrix") and a naive quote scan swallows them.
  const body = src.slice(i, src.indexOf(']);', i))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return [...body.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

const REGISTRIES: Array<[string, string[]]> = [
  ['HAS_ART', ['portrait', 'token']],
  ['HAS_NPC_ART', ['portrait']],
  ['HAS_SCENE_ART', ['scene']],
  ['HAS_TOKEN_ART', ['token']],
];

describe('art registry', () => {
  it('never claims art that is not on disk', () => {
    const broken: string[] = [];
    for (const [name, prefixes] of REGISTRIES) {
      for (const id of setOf(name)) {
        for (const p of prefixes) {
          if (!existsSync(join(ART, `${p}-${id}.webp`))) broken.push(`${name}: ${p}-${id}.webp`);
        }
      }
    }
    expect(broken, `declared in art.ts but missing — these render as a broken image:\n${broken.join('\n')}`).toEqual([]);
  });

  it('ships no art file that nothing declares', () => {
    const declared = new Set(REGISTRIES.flatMap(([name]) => setOf(name)));
    const unused = readdirSync(ART).filter((f) => {
      const m = f.match(/^(?:portrait|token|scene)-(.+)\.webp$/);
      return m && !declared.has(m[1]!);
    });
    expect(unused, `in the bundle but never displayed: ${unused.join(', ')}`).toEqual([]);
  });
});

describe('board tokens', () => {
  /**
   * Board.tsx falls back to `TOKEN[classId] ?? '❓'` when a combatant has no
   * generated art. 60 of 140 monsters have no art and that is fine — the emoji
   * reads perfectly well at token size — but a monster in neither list renders
   * as a literal question mark on the board.
   *
   * That is exactly what happened to the eight spellcaster variants: they were
   * added to the bestiary and to the arena's rosters, and appeared in fights at
   * every tier, as "?".
   */
  it('every monster has generated art or an emoji, never a question mark', () => {
    const src = readFileSync(join(WEB, 'Board.tsx'), 'utf8');
    const i = src.indexOf('const TOKEN');
    // Comments stripped first, then key-followed-by-a-quoted-glyph. Anchoring
    // on line starts instead misses an indented first key on a fresh line.
    const body = src.slice(i, src.indexOf('};', i)).replace(/\/\/[^\n]*/g, '');
    const tokens = new Set([...body.matchAll(/'?([a-z0-9-]+)'?\s*:\s*'/g)].map((m) => m[1]!));
    const art = new Set(setOf('HAS_ART'));

    const naked = Object.keys(MONSTERS).filter((id) => !art.has(id) && !tokens.has(id));
    expect(naked, `monsters that render as "?" on the board: ${naked.join(', ')}`).toEqual([]);

    // The player classes go through the same fallback.
    const nakedClasses = Object.keys(CLASSES).filter((id) => !art.has(id) && !tokens.has(id));
    expect(nakedClasses, `classes that render as "?": ${nakedClasses.join(', ')}`).toEqual([]);
  });
});
