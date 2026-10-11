/**
 * Fights designed to punish standing still.
 *
 * The problem these answer, measured: at the arena's own even budget, a party
 * FORBIDDEN TO MOVE wins as often as one played properly — on every board size
 * from 8x8 to 24x12, and at every depth from 8 to 20 rows. Geometry alone does
 * not make position matter. What a fight asks of you does.
 *
 * Three pieces, each tested here:
 *   - a brief, so a wave is guaranteed to be able to reach you (`volley`) or to
 *     punish you for bunching (`artillery`);
 *   - ground that gives the shooters something to shoot from (`gallery`) or
 *     breaks the sightlines entirely (`rooms`);
 *   - deployment that puts the shooters behind the cover rather than in front
 *     of it, which is what makes the ground mean anything.
 */
import { describe, it, expect } from 'vitest';
import {
  generateEncounter, canHitAnArea, adjustedXp, type EncounterBrief,
} from '../src/arena/encounter.js';
import { generateArenaMap, validateArenaMap } from '../src/arena/map.js';
import { assignByRole, deployPositions } from '../src/arena/deploy.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../src/arena/run.js';
import { canThreatenAtRange } from '../src/data/monsters.js';
import { parseMap } from '../src/data/maps.js';
import { blocksMovement } from '../src/engine/grid.js';
import { seedRng } from '../src/engine/rng.js';
import { cellAt } from '../src/engine/types.js';

const LEVELS = [1, 3, 5];
const waves = (brief: EncounterBrief, level: number, n = 200) =>
  Array.from({ length: n }, (_, i) =>
    generateEncounter({
      budget: evenBudgetFor(level), maxMemberXp: memberCapFor(level),
      maxCount: maxCountFor(level), partyLevel: level, brief,
    }, seedRng((i + 1) * 7919)).value);

describe('an encounter brief', () => {
  it('fields at least two shooters on a volley', () => {
    // One archer is answered by killing the archer. Two means the party cannot
    // out-range the wave by dealing with a single creature, which is what made
    // "stand on the back rank" a complete plan.
    for (const level of LEVELS) {
      const short = waves('volley', level).filter((w) => w.members.filter(canThreatenAtRange).length < 2);
      expect(short.length, `level ${level}: ${short.slice(0, 3).map((w) => w.members.join('+')).join(', ')}`)
        .toBeLessThan(10);
    }
  });

  it('fields something that drops an area on artillery', () => {
    for (const level of LEVELS) {
      const without = waves('artillery', level).filter((w) => !w.members.some(canHitAnArea));
      expect(without.length, `level ${level}: ${without.slice(0, 3).map((w) => w.members.join('+')).join(', ')}`)
        .toBeLessThan(10);
    }
  });

  it('asks for more without making the fight harder', () => {
    /*
     * The whole point of swapping rather than adding. A brief that quietly
     * raised the budget would show up in a win rate as "this design punishes
     * standing still", when all it did was field a bigger warband — and every
     * measurement taken with it would be worthless.
     */
    for (const level of LEVELS) {
      const base = waves('mixed', level);
      const mean = (ws: typeof base, f: (w: typeof base[number]) => number) =>
        ws.reduce((a, w) => a + f(w), 0) / ws.length;
      for (const brief of ['volley', 'artillery'] as const) {
        const got = waves(brief, level);
        expect(mean(got, (w) => adjustedXp(w.members)), `${brief} L${level} XP`)
          .toBeLessThan(mean(base, (w) => adjustedXp(w.members)) * 1.05);
        expect(mean(got, (w) => w.members.length), `${brief} L${level} headcount`)
          .toBeLessThan(mean(base, (w) => w.members.length) + 0.5);
      }
    }
  });

  it('leaves the default alone', () => {
    // 'mixed' is what the arena has always generated, and every balance number
    // in the repo was measured against it.
    for (const level of LEVELS) {
      const bare = generateEncounter({ budget: evenBudgetFor(level), partyLevel: level }, seedRng(99));
      const asked = generateEncounter({ budget: evenBudgetFor(level), partyLevel: level, brief: 'mixed' }, seedRng(99));
      expect(asked.value.members).toEqual(bare.value.members);
    }
  });
});

describe('ground worth shooting from', () => {
  const WIDTHS = [8, 12, 16, 24];

  it.each(['gallery', 'rooms'] as const)('%s generates a valid board at every width', (layout) => {
    for (const width of WIDTHS) {
      let rerolls = 0;
      for (let s = 1; s <= 100; s++) {
        const g = generateArenaMap({ width, height: 12, layout, theme: 'stone' }, seedRng(s * 7919));
        rerolls += g.value.rerolls;
        expect(validateArenaMap(g.value.map), `${layout} w${width} seed ${s}\n${g.value.map.rows.join('\n')}`)
          .toEqual([]);
      }
      // A layout that cannot pass validation does not fail loudly — the
      // generator rerolls, draws the same forced layout again, and after 24
      // tries hands back a BARE OPEN FIELD. The first cut of `rooms` did
      // exactly that, every single time, and looked like it was working.
      expect(rerolls, `${layout} w${width} is rerolling, so some boards are the fallback`).toBe(0);
    }
  });

  it('puts the gallery\'s firing line on the shooters\' side, not the party\'s', () => {
    /*
     * THE BUG THIS PINS. A stamp's `y` is upside down: `draft` writes `grid[y]`
     * and `parseMap` reads row `i` as `y = height - 1 - i`. Every layout before
     * `gallery` was symmetric enough not to care. The first cut put the firing
     * line two rows above the middle and it came out two rows in front of the
     * PARTY — handing the shooters' cover to the people it exists to protect
     * them from, which is a board that reads right and plays backwards.
     */
    for (const width of [8, 16]) {
      for (let s = 1; s <= 40; s++) {
        const map = generateArenaMap({ width, height: 12, layout: 'gallery', theme: 'stone' }, seedRng(s * 65537)).value.map;
        const grid = parseMap(map);
        const rows: number[] = [];
        for (let y = 0; y < grid.height; y++) {
          let blocked = 0;
          for (let x = 0; x < grid.width; x++) if (blocksMovement(cellAt(grid, { x, y })!.terrain)) blocked++;
          rows.push(blocked);
        }
        const line = rows.indexOf(Math.max(...rows));
        expect(line, `w${width} seed ${s}: the firing line is on the party's half\n${map.rows.join('\n')}`)
          .toBeGreaterThan(grid.height / 2);
      }
    }
  });

  it('offsets the warren\'s doorways, so it is not one corridor', () => {
    // Lined up, the two bands are a single passage and the board is a
    // chokepoint with extra walls in it.
    let offset = 0, checked = 0;
    for (let s = 1; s <= 60; s++) {
      const map = generateArenaMap({ width: 12, height: 12, layout: 'rooms', theme: 'stone' }, seedRng(s * 2749)).value.map;
      const grid = parseMap(map);
      const doors: number[][] = [];
      for (let y = 0; y < grid.height; y++) {
        const blocked = [...Array(grid.width).keys()].filter((x) => blocksMovement(cellAt(grid, { x, y })!.terrain));
        if (blocked.length >= grid.width - 3) {
          doors.push([...Array(grid.width).keys()].filter((x) => !blocked.includes(x)));
        }
      }
      if (doors.length < 2) continue;
      checked++;
      if (!doors[0]!.some((x) => doors[1]!.includes(x))) offset++;
    }
    expect(checked, 'no board had two bands to compare').toBeGreaterThan(40);
    expect(offset / checked, 'the warren\'s doorways line up').toBeGreaterThan(0.8);
  });
});

describe('the shooters get the sheltered cells', () => {
  it('puts what can shoot behind the cover and what cannot in front of it', () => {
    /*
     * The half a layout cannot do for itself. A pattern places a warband as a
     * shape; it does not know which of them is an archer, and a barricade line
     * with the archers in front of it and the ogres behind is the same fight as
     * an open field, drawn differently.
     */
    /*
     * `scattered`, not `far-rank`. On a far rank every cell is the same row,
     * every cell shelters equally, and the assignment has nothing to decide —
     * a first version of this test used it and was comparing a number with
     * itself. A scatter is where the cells actually differ.
     */
    let better = 0, compared = 0;
    for (let s = 1; s <= 200; s++) {
      const grid = parseMap(generateArenaMap({ height: 12, layout: 'gallery', theme: 'stone' }, seedRng(s * 7919)).value.map);
      const raw = deployPositions(grid, 5, 'scattered', seedRng(s)).value;
      // Half shooters, half not — the case where the assignment has a choice.
      const ranged = [true, false, true, false, true];
      const dealt = assignByRole(grid, raw, ranged);
      const depth = (ps: readonly { x: number; y: number }[], want: boolean) =>
        ps.filter((_, i) => ranged[i] === want).reduce((a, p) => a + p.y, 0) /
        Math.max(1, ranged.filter((r) => r === want).length);
      if (depth(raw, true) === depth(raw, false)) continue;
      compared++;
      if (depth(dealt, true) >= depth(dealt, false)) better++;
    }
    expect(compared, 'nothing to compare').toBeGreaterThan(50);
    expect(better / compared, 'the shooters are being sent to the front').toBeGreaterThan(0.95);
  });

  it('moves nobody when every member is the same kind', () => {
    // No shooters, or all shooters: there is no choice to make, and shuffling
    // the cells anyway would change fights it has nothing to say about.
    const grid = parseMap(generateArenaMap({ height: 12, layout: 'gallery', theme: 'stone' }, seedRng(5)).value.map);
    const raw = deployPositions(grid, 4, 'scattered', seedRng(3)).value;
    for (const all of [true, false]) {
      const dealt = assignByRole(grid, raw, [all, all, all, all]);
      expect(new Set(dealt.map((p) => `${p.x},${p.y}`))).toEqual(new Set(raw.map((p) => `${p.x},${p.y}`)));
    }
  });

  it('places every member exactly once', () => {
    // The failure that would be invisible: a swap that drops a monster leaves
    // a smaller, easier fight, and the budget says nothing is wrong.
    for (let s = 1; s <= 60; s++) {
      const grid = parseMap(generateArenaMap({ height: 12, theme: 'stone' }, seedRng(s)).value.map);
      const raw = deployPositions(grid, 6, 'pincer', seedRng(s * 3)).value;
      const ranged = [true, true, false, false, true, false];
      const dealt = assignByRole(grid, raw, ranged);
      expect(dealt).toHaveLength(raw.length);
      expect(new Set(dealt.map((p) => `${p.x},${p.y}`)).size, `seed ${s}: two monsters on one cell`)
        .toBe(raw.length);
    }
  });
});

describe('what the arena actually offers', () => {
  it('puts the shooting gallery behind doors and keeps the warren out', async () => {
    /*
     * The doors draw from their own list, not from the layout weights — so a
     * layout at weight 0 is not "off" if it has a door entry. `rooms` went
     * live that way by accident, with its 16-round fights, the moment it got a
     * name for the door card.
     */
    const { DOOR_LAYOUTS, gatesFor } = await import('../src/arena/gates.js');
    expect(DOOR_LAYOUTS).toContain('gallery');
    expect(DOOR_LAYOUTS).not.toContain('rooms');
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const g of gatesFor(seed, 3, 1)) seen.add(g.layout);
    expect(seen.has('rooms'), 'a door opened onto the warren').toBe(false);
    expect(seen.has('gallery'), 'no door ever opened onto the gallery').toBe(true);
  });

  it('deals the arena\'s shooters the sheltered cells', async () => {
    // Without the flags `deployFoes` keeps the pattern's order, and the
    // gallery's barricade shelters whoever happened to be drawn first.
    const { readFileSync } = await import('node:fs');
    const arena = readFileSync(new URL('../web/src/Arena.tsx', import.meta.url), 'utf8');
    expect(arena).toMatch(/deployFoes\([^;]*members\.map\(canThreatenAtRange\)/s);
  });
});
