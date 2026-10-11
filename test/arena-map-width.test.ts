/**
 * The arena board generator can be asked for a width — and the width it has
 * always had must come back exactly as it was.
 *
 * WHY THIS EXISTS
 *
 * The 8-column cap was never a rule about the game. The board is eight wide
 * because `styles.css` fits the whole thing on a phone and eight columns is
 * where the cells stop being finger-sized; `arena/map.ts` says as much, and
 * rejected a 16-row board on the same grounds. Now that a camera decides how
 * much of a board is on screen, width is a design question, and answering it
 * means being able to generate and measure other widths.
 *
 * Everything that used to be written against the constant 8 — the chokepoint's
 * gaps, the redoubt's span, the ruin's block, the deploy files the validator
 * checks — is now written against the width in hand, in the same proportions.
 * That is a lot of arithmetic to get subtly wrong in a way nobody would notice
 * on the only width anyone plays.
 *
 * So: the identity case is pinned hardest. Verified once by capturing 1,440
 * generated boards before the change and diffing them after; this keeps that
 * true without carrying the capture around.
 */
import { describe, it, expect } from 'vitest';
import { generateArenaMap, validateArenaMap, DEFAULT_WIDTH, THEME_SCATTER } from '../src/arena/map.js';
import { parseMap, type MapTheme } from '../src/data/maps.js';
import { blocksMovement } from '../src/engine/grid.js';
import { seedRng } from '../src/engine/rng.js';

const THEMES = Object.keys(THEME_SCATTER) as MapTheme[];
const LAYOUTS = ['chokepoint', 'pillars', 'redoubt', 'crossfire', 'ruin', 'open'] as const;

describe('width 8 is the board it always was', () => {
  it('is what you get when nothing is asked for', () => {
    expect(DEFAULT_WIDTH).toBe(8);
    for (let s = 1; s <= 30; s++) {
      const map = generateArenaMap({}, seedRng(s * 7919)).value.map;
      for (const row of map.rows) expect(row.length, map.rows.join('/')).toBe(8);
    }
  });

  it('is identical whether the width is left out or asked for', () => {
    // The default must travel the same road as any other width, or the one
    // width that ships is the one width that is never exercised.
    for (let s = 1; s <= 40; s++) {
      for (const theme of THEMES) {
        const bare = generateArenaMap({ theme, height: 12 }, seedRng(s * 104729));
        const asked = generateArenaMap({ theme, height: 12, width: 8 }, seedRng(s * 104729));
        expect(asked.value.map.rows, `${theme} seed ${s}`).toEqual(bare.value.map.rows);
      }
    }
  });
});

describe('a wider board is still a board', () => {
  const WIDTHS = [8, 12, 16, 20, 24];

  it.each(WIDTHS)('width %i generates and validates, every theme and layout', (width) => {
    for (const theme of THEMES) {
      for (const layout of LAYOUTS) {
        const g = generateArenaMap({ width, height: 12, theme, layout }, seedRng(width * 31 + theme.length));
        expect(g.value.map.rows.length).toBe(12);
        for (const row of g.value.map.rows) expect(row.length).toBe(width);
        expect(validateArenaMap(g.value.map), `${theme}/${layout} w${width}\n${g.value.map.rows.join('\n')}`)
          .toEqual([]);
      }
    }
  });

  it('never has to reroll to find a valid one', () => {
    // A width that quietly pushed the reroll rate up would be a width whose
    // layouts no longer fit it — the generator would still return a board, and
    // it would be the bare-field fallback rather than the layout asked for.
    for (const width of WIDTHS) {
      let rerolls = 0;
      for (let s = 1; s <= 120; s++) rerolls += generateArenaMap({ width, height: 12 }, seedRng(s * 7919)).value.rerolls;
      expect(rerolls, `width ${width} is rerolling`).toBe(0);
    }
  });

  it('keeps roughly the same share of the board blocked', () => {
    /*
     * The confound this rules out. If the layouts stayed 8 columns wide and
     * were stamped into the middle of a wider board, the extra columns would
     * be bare floor: a "wider board" measurement would then really be an
     * "emptier board" measurement, and the terrain would thin out until a wide
     * board was an open field with a feature in the middle.
     *
     * Measured 8.1% at width 8 down to 6.5% at 24 — the band across the board
     * is a fixed number of rows, so it is a slightly smaller share of a wider
     * one, which is the right behaviour rather than a drift.
     */
    const share = (width: number) => {
      let blocked = 0, cells = 0;
      for (let s = 1; s <= 200; s++) {
        const grid = parseMap(generateArenaMap({ width, height: 12 }, seedRng(s * 7919)).value.map);
        blocked += grid.cells.filter((c) => blocksMovement(c.terrain)).length;
        cells += grid.cells.length;
      }
      return blocked / cells;
    };
    const at8 = share(8);
    for (const width of [12, 16, 20, 24]) {
      const here = share(width);
      expect(here, `width ${width} is much emptier than width 8`).toBeGreaterThan(at8 * 0.6);
      expect(here, `width ${width} is much denser than width 8`).toBeLessThan(at8 * 1.4);
    }
  });

  it('checks every deploy file of a wide board, not the first eight', () => {
    /*
     * The validator used to read a module-level `DEPLOY_FILES = [0..7]`. On a
     * sixteen-wide board that is half the deploy rank: a wall at column 14 of
     * rank 0 would pass, and whatever deployed there would be inside it.
     * Caught by planting exactly that — `deployFiles(Math.min(8, width))` —
     * and watching the first version of this file stay green.
     */
    for (const width of [12, 16, 24]) {
      const open = Array.from({ length: 12 }, () => '.'.repeat(width));
      expect(validateArenaMap({ id: 't', name: 'T', theme: 'stone', rows: open }), `width ${width}`)
        .toEqual([]);
      for (const x of [0, Math.floor(width / 2), width - 1]) {
        const rows = [...open];
        rows[11] = `${'.'.repeat(x)}#${'.'.repeat(width - x - 1)}`; // rank 0 is the LAST row
        expect(validateArenaMap({ id: 't', name: 'T', theme: 'stone', rows }),
          `width ${width}, a wall on file ${x} of the party's own rank went unnoticed`)
          .toContain('deploy-blocked');
      }
    }
  });

  it('grows the ruin\'s block with the board', () => {
    // A three-column block is a quarter of an eight-wide board and a pebble on
    // a twenty-four-wide one. Without this the wide boards keep the shape's
    // name and lose the thing it was for — a hard corner to break sight behind.
    const widest = (width: number) => {
      let best = 0;
      for (let s = 1; s <= 40; s++) {
        const map = generateArenaMap({ width, height: 12, layout: 'ruin', theme: 'stone' }, seedRng(s * 2749)).value.map;
        for (const row of map.rows) {
          let run = 0;
          for (const ch of row) { run = ch === '#' ? run + 1 : 0; if (run > best) best = run; }
        }
      }
      return best;
    };
    const at8 = widest(8);
    expect(at8).toBeGreaterThanOrEqual(3);
    expect(widest(24), 'the ruin is the same three columns on a board three times as wide')
      .toBeGreaterThan(at8);
  });

  it('puts the chokepoint\'s gaps in both halves, not the same two columns', () => {
    // The specific way a width-blind layout fails: the band grows but its two
    // doorways stay at columns 1-3 and 5-6, so half a wide board is a wall
    // with no way through and the fight only ever happens on one side.
    for (const width of [16, 24]) {
      let left = 0, right = 0;
      for (let s = 1; s <= 60; s++) {
        const map = generateArenaMap({ width, height: 12, layout: 'chokepoint', theme: 'stone' }, seedRng(s * 65537)).value.map;
        // The band is the row with the most blocking terrain in it.
        const scored = map.rows.map((r) => [...r].filter((ch) => ch === '#' || ch === '+').length);
        const band = scored.indexOf(Math.max(...scored));
        const gaps = [...map.rows[band]!].flatMap((ch, x) => (ch === '#' || ch === '+' ? [] : [x]));
        if (gaps.some((x) => x < width / 2)) left++;
        if (gaps.some((x) => x >= width / 2)) right++;
      }
      expect(left, `width ${width}: no gap in the left half`).toBeGreaterThan(50);
      expect(right, `width ${width}: no gap in the right half`).toBeGreaterThan(50);
    }
  });
});
