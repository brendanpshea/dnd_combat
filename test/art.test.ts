import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import {
  HAS_ART, HAS_NPC_ART, HAS_SCENE_ART, HAS_TOKEN_ART, HAS_SPELL_ICON, HAS_BOARD_BG,
} from '../web/src/art-registry.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ART = join(ROOT, 'web/public/art');
const WEB = join(ROOT, 'web/src');

/**
 * Which ids have generated art is a fact about `web/public/art`, so
 * `art-registry.ts` is derived from it by `npm run art-registry` rather than
 * hand-kept. Both directions of drift used to be possible and both are silent:
 * a declared id with no file renders a broken <img> where the emoji fallback
 * would have looked fine, and a file nobody declares ships in the bundle and is
 * never displayed.
 */
describe('art registry', () => {
  it('is up to date with the files on disk', () => {
    let out = '';
    try {
      out = execFileSync('npx', ['tsx', 'scripts/art-registry.ts', '--check'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      throw new Error(`${err.stderr ?? ''}${err.stdout ?? ''}`);
    }
    expect(out).toContain('up to date');
  }, 60000);

  /**
   * The generator is the thing under test above; these check its *output* is
   * usable, so a generator that silently emitted nothing would still fail.
   */
  it('resolves every declared id to a file that exists', () => {
    const cases: Array<[string, Set<string>, string[]]> = [
      ['HAS_ART', HAS_ART, ['portrait', 'token']],
      ['HAS_NPC_ART', HAS_NPC_ART, ['portrait']],
      ['HAS_SCENE_ART', HAS_SCENE_ART, ['scene']],
      ['HAS_TOKEN_ART', HAS_TOKEN_ART, ['token']],
      ['HAS_SPELL_ICON', HAS_SPELL_ICON, ['icon']],
      ['HAS_BOARD_BG', HAS_BOARD_BG, ['bg']],
    ];
    const broken: string[] = [];
    for (const [name, set, prefixes] of cases) {
      expect(set.size, `${name} is empty — the generator emitted nothing`).toBeGreaterThan(0);
      for (const id of set) {
        for (const p of prefixes) {
          if (!existsSync(join(ART, `${p}-${id}.webp`))) broken.push(`${name}: ${p}-${id}.webp`);
        }
      }
    }
    expect(broken, `declared but missing:\n${broken.join('\n')}`).toEqual([]);
  });

  it('leaves no art file unclaimed by some registry', () => {
    const declared = new Set([
      ...HAS_ART, ...HAS_NPC_ART, ...HAS_SCENE_ART, ...HAS_TOKEN_ART,
      ...HAS_SPELL_ICON, ...HAS_BOARD_BG,
    ]);
    const unused = readdirSync(ART).filter((f) => {
      const m = f.match(/^(?:portrait|token|scene|icon|bg)-(.+)\.webp$/);
      return m && !declared.has(m[1]!);
    });
    expect(unused, `in the bundle but never displayed: ${unused.join(', ')}`).toEqual([]);
  });

  /**
   * `art.ts` is the module every caller imports from; the split into a
   * generated file is an implementation detail it re-exports. If that
   * re-export is dropped, a dozen call sites break at once — but they break
   * loudly at compile time, so what this actually guards is the reverse: that
   * nobody reintroduces a hand-written copy alongside the generated one.
   */
  it('art.ts declares no ids of its own', () => {
    const src = readFileSync(join(WEB, 'art.ts'), 'utf8');
    expect(src, 'the sets must come from art-registry.ts').toContain("from './art-registry.js'");
    expect(src, 'a hand-written set has come back into art.ts').not.toMatch(/export const HAS_\w+ = new Set/);
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
   * added to the bestiary and to the arena's rosters, appeared in fights at
   * every tier, and were drawn as "?".
   */
  it('every monster has generated art or an emoji, never a question mark', () => {
    const src = readFileSync(join(WEB, 'Board.tsx'), 'utf8');
    const i = src.indexOf('const TOKEN');
    // Comments stripped first, then key-followed-by-a-quoted-glyph. Anchoring
    // on line starts instead misses an indented first key on a fresh line.
    const body = src.slice(i, src.indexOf('};', i)).replace(/\/\/[^\n]*/g, '');
    const tokens = new Set([...body.matchAll(/'?([a-z0-9-]+)'?\s*:\s*'/g)].map((m) => m[1]!));

    const naked = Object.keys(MONSTERS).filter((id) => !HAS_ART.has(id) && !tokens.has(id));
    expect(naked, `monsters that render as "?" on the board: ${naked.join(', ')}`).toEqual([]);

    // The player classes go through the same fallback.
    const nakedClasses = Object.keys(CLASSES).filter((id) => !HAS_ART.has(id) && !tokens.has(id));
    expect(nakedClasses, `classes that render as "?": ${nakedClasses.join(', ')}`).toEqual([]);
  });
});
