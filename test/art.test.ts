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
  /**
   * `hasArt(id)` says a file was generated and shipped. It does not say the
   * browser got it — a stale cache, a half-finished deploy or a flaky
   * connection all end as Chrome's torn-photo icon in a 56px circle, which is
   * what a player reports as "the portraits are broken". Reported from the
   * live site on the arena's wave preview, where the repo, the build and the
   * deploy were all verifiably correct and the images still did not arrive.
   *
   * So every place that draws creature art must handle the *runtime* failure,
   * not just the registry miss.
   */
  it('every creature image falls back when the art fails to load', () => {
    const artImage = readFileSync(join(WEB, 'ArtImage.tsx'), 'utf8');
    expect(artImage, 'the shared image must react to a load failure').toContain('onError');
    expect(artImage, 'and fall back to the glyph').toContain('glyphFor');

    // The three places a creature is drawn. Each either routes through
    // ArtImage or handles onError itself.
    for (const file of ['Portrait.tsx', 'Arena.tsx', 'Board.tsx']) {
      const src = readFileSync(join(WEB, file), 'utf8');
      expect(src.includes('ArtImage') || src.includes('onError'),
        `${file} draws creature art with no fallback for a failed load`).toBe(true);
    }
  });

  /**
   * The portrait used to render nothing at all without art, leaving an empty
   * ring where every other creature had a face. 58 of the monsters have no
   * portrait, so that was most of the bestiary showing a hole.
   */
  it('the portrait frame is never empty', () => {
    // Comments stripped: this file's own docstring says what it *used* to do.
    const src = readFileSync(join(WEB, 'Portrait.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(src, 'must not bail out and render nothing').not.toMatch(/return null/);
    const css = readFileSync(join(WEB, 'styles.css'), 'utf8');
    expect(css, 'the fallback glyph needs a rule or it is an unstyled character')
      .toContain('.portrait-glyph');
  });

  it('every monster has generated art or an emoji, never a question mark', () => {
    // The glyph map moved out of Board.tsx so the portrait frame and the
    // arena's wave preview could fall back to the same emoji.
    const src = readFileSync(join(WEB, 'glyphs.ts'), 'utf8');
    const i = src.indexOf('const GLYPH');
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

/**
 * The service worker decides whether a redeploy can ever reach an installed
 * copy. Only the bundler's own output is content-hashed; everything in
 * `public/` keeps its filename forever, so caching *that* first-response-wins
 * means an installed app is stuck with whatever it first received — which is
 * how monster portraits stayed missing on a phone through several deploys
 * while a fresh browser was fine.
 */
describe('service worker caching', () => {
  const sw = readFileSync(join(ROOT, 'web/public/sw.js'), 'utf8');

  it('only caches content-hashed assets first-response-wins', () => {
    // The hashed set is Vite's `assets/` directory and nothing else.
    expect(sw, 'must distinguish hashed output from public/ assets').toMatch(/assets\//);
    // Unhashed assets have to be revalidated, or a deploy cannot reach an
    // installed copy. Storing only ok responses keeps a 404 mid-deploy out.
    expect(sw).toContain('res.ok');
  });

  it('names a cache version, so a bad entry can be dropped by bumping it', () => {
    const m = sw.match(/const CACHE = '([^']+)'/);
    expect(m, 'no cache name').toBeTruthy();
    // v1 was never bumped across the whole life of the app; a poisoned entry
    // had no way out short of reinstalling.
    expect(m![1], 'still on the original cache name').not.toBe('dnd-grid-combat-v1');
    expect(sw, 'old caches must be deleted on activate').toContain('caches.delete');
  });

  it('serves art out of public/, which is not hashed — so it must not be immutable-cached', () => {
    // A guard on the assumption itself: if art ever moves under the bundler,
    // this test should be revisited rather than silently passing.
    const artFiles = readdirSync(ART);
    expect(artFiles.length, 'art lives in web/public/art').toBeGreaterThan(100);
    expect(artFiles.every((f) => !/-[0-9a-f]{8}\./.test(f)), 'art filenames carry no content hash').toBe(true);
  });
});
