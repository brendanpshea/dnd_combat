import { describe, it, expect } from 'vitest';
import { gatesFor, gateFor, gateLocked, GATE_COUNT } from '../src/arena/gates.js';
import { buildWave, waveDifficulty, GATE_TAX, newArenaRun, recordResult } from '../src/arena/run.js';
import { generateArenaMap } from '../src/arena/map.js';
import { seedRng } from '../src/engine/rng.js';
import { parseMap } from '../src/data/maps.js';
import { blocksMovement } from '../src/engine/grid.js';

/**
 * Gates: three doors before a wave, and you take one.
 *
 * The properties worth defending here are the ones that would let the arena go
 * quietly wrong rather than visibly break:
 *
 *  - the three doors are three DIFFERENT fights (three drafts of one is a
 *    choice in name only), and
 *  - a retry offers the same three, or a lost wave becomes a slot machine you
 *    reroll until an easy door turns up.
 *
 * Difficulty is not asserted here — it is measured, in the calibration tripwire
 * in arena.test.ts and in the tables quoted in gates.ts. A unit test that
 * claimed the doors were equally hard would be asserting a number it did not
 * take.
 */

describe('gates', () => {
  it('offers three doors on three different boards', () => {
    for (let wave = 1; wave <= 20; wave++) {
      const gates = gatesFor(7, 3, wave);
      expect(gates).toHaveLength(GATE_COUNT);
      const layouts = gates.map((g) => g.layout);
      expect(new Set(layouts).size, `wave ${wave}: ${layouts.join(', ')}`).toBe(GATE_COUNT);
      expect(gates.map((g) => g.door)).toEqual([0, 1, 2]);
    }
  });

  it('makes them three different fights, not three drafts of one', () => {
    // Same wave, so the same budget: what has to differ is the roster.
    let identical = 0;
    const N = 40;
    for (let wave = 1; wave <= N; wave++) {
      const rosters = gatesFor(11, 3, wave)
        .map((g) => [...g.wave.encounter.members].sort().join(','));
      if (new Set(rosters).size < GATE_COUNT) identical++;
    }
    // A collision now and then is honest — two doors can roll the same warband.
    // A quarter of waves would mean the door seed is not doing its job.
    expect(identical / N, `${identical}/${N} waves had two identical doors`).toBeLessThan(0.25);
  });

  it('offers the same three on a retry — a lost wave is not a reroll', () => {
    const first = gatesFor(3, 4, 9);
    const again = gatesFor(3, 4, 9);
    expect(again.map((g) => g.layout)).toEqual(first.map((g) => g.layout));
    expect(again.map((g) => g.wave.encounter.members.join(',')))
      .toEqual(first.map((g) => g.wave.encounter.members.join(',')));
  });

  it('gives every door the same purse, so no door is the paying door', () => {
    for (let wave = 1; wave <= 12; wave++) {
      const purses = gatesFor(5, 3, wave).map((g) => g.wave.purse);
      expect(new Set(purses).size, `wave ${wave}: ${purses.join(', ')}`).toBe(1);
    }
  });

  it('builds every door to the same budget', () => {
    for (let wave = 1; wave <= 12; wave++) {
      const budgets = gatesFor(5, 3, wave).map((g) => g.wave.budget);
      expect(new Set(budgets).size, `wave ${wave}: ${budgets.join(', ')}`).toBe(1);
    }
  });

  it('actually delivers the ground its card promises', () => {
    // A door that says "barricaded flanks" and rolls an open field is a lie on
    // the only information the player is choosing from.
    for (let wave = 1; wave <= 15; wave++) {
      for (const g of gatesFor(23, 3, wave)) {
        const blocked = parseMap(g.wave.map).cells.filter((c) => blocksMovement(c.terrain)).length;
        if (g.layout === 'open') continue;   // deliberately nearly bare
        expect(blocked, `${g.name} (${g.layout}) on wave ${wave} had no terrain`).toBeGreaterThan(0);
      }
    }
  });

  it('picks the selected door, and falls back to the first', () => {
    const gates = gatesFor(2, 3, 5);
    expect(gateFor(gates, 2).door).toBe(2);
    expect(gateFor(gates, undefined).door, 'a save from before gates existed').toBe(0);
    expect(gateFor(gates, 99).door, 'a door that no longer exists').toBe(0);
  });

  it('locks the door once a wave has been attempted', () => {
    expect(gateLocked(0), 'you may still compare').toBe(false);
    expect(gateLocked(1), 'you lost — this is the wave you lost').toBe(true);
  });

  it('releases the door on a clear, so the next wave is a fresh choice', () => {
    let run = { ...newArenaRun(1), gate: 2 };
    run = recordResult(run, false, 0);
    expect(run.gate, 'a loss keeps you on the door you took').toBe(2);
    run = recordResult(run, true, 50);
    expect(run.gate, 'a clear starts the next wave unselected').toBe(0);
  });
});

/**
 * Every layout must actually be able to ship.
 *
 * `chokepoint` could not, and nothing noticed for as long as it existed. It
 * stamped a barricade directly in front of each gap in its wall, and since the
 * wall blocks left and right that left the gap with no orthogonal way in — so
 * every candidate board failed the connectivity check, all 24 rerolls, and the
 * generator fell back to a bare field. Because an unforced reroll draws a
 * *fresh* layout, the failure was invisible from outside: the heaviest-weighted
 * entry in the table (20 of 100) simply never appeared, and roughly a fifth of
 * every board in the game silently became one of the other five.
 *
 * This is the test that would have caught it. It is deliberately about the
 * reroll count rather than about chokepoints, because the next layout to break
 * this way will break it the same silent way.
 */
describe('every layout can survive validation', () => {
  it('ships without exhausting its rerolls', () => {
    for (const layout of ['chokepoint', 'pillars', 'redoubt', 'crossfire', 'ruin', 'open'] as const) {
      let rng = seedRng(5);
      let gaveUp = 0, worst = 0;
      const N = 40;
      for (let i = 0; i < N; i++) {
        const m = generateArenaMap({ layout }, rng); rng = m.state;
        worst = Math.max(worst, m.value.rerolls);
        if (m.value.rerolls >= 24) gaveUp++;
      }
      expect(gaveUp, `${layout} fell back to a bare field ${gaveUp}/${N} times`).toBe(0);
      expect(worst, `${layout} needed ${worst} rerolls at worst`).toBeLessThan(8);
    }
  });

  it('puts a real gap in the chokepoint wall', () => {
    // The specific shape of the bug: a band with no way through it.
    let rng = seedRng(17);
    for (let i = 0; i < 40; i++) {
      const m = generateArenaMap({ layout: 'chokepoint' }, rng); rng = m.state;
      const banded = m.value.map.rows.filter((r) => (r.match(/#/g) ?? []).length >= 4);
      expect(banded.length, 'no wall band was stamped at all').toBeGreaterThan(0);
      for (const row of banded) expect(row, `sealed band: ${row}`).toMatch(/\./);
    }
  });
});

describe('forcing a layout', () => {
  it('produces the layout asked for, and still validates', () => {
    let rng = seedRng(5);
    for (const layout of ['chokepoint', 'crossfire', 'redoubt', 'ruin', 'pillars'] as const) {
      let withTerrain = 0;
      const N = 30;
      for (let i = 0; i < N; i++) {
        const m = generateArenaMap({ layout }, rng); rng = m.state;
        const grid = parseMap(m.value.map);
        if (grid.cells.some((c) => blocksMovement(c.terrain))) withTerrain++;
        // The deploy ranks stay clear whatever is forced — the validator's job,
        // asserted here because a forced layout is a new way to reach it.
        for (const y of [0, grid.height - 1]) {
          for (let x = 0; x < grid.width; x++) {
            expect(blocksMovement(grid.cells[y * grid.width + x]!.terrain)).toBe(false);
          }
        }
      }
      expect(withTerrain, `${layout} produced bare boards`).toBeGreaterThan(N * 0.8);
    }
  });

  it('still lays the theme\'s hazards on top of a forced layout', () => {
    // Forcing the blocking shape must not skip the pools step that follows it,
    // or every gated board would be a dry one and Into the Fire would go dead.
    let rng = seedRng(9);
    let withHazard = 0;
    const N = 40;
    for (let i = 0; i < N; i++) {
      const m = generateArenaMap({ layout: 'open', theme: 'ember' }, rng); rng = m.state;
      if (m.value.map.rows.some((r) => r.includes('^'))) withHazard++;
    }
    expect(withHazard, `${withHazard}/${N} ember boards had fire`).toBeGreaterThan(N * 0.5);
  });

  it('is the layout that changes, and only the layout', () => {
    const a = generateArenaMap({ layout: 'open', theme: 'ember', height: 12 }, seedRng(9));
    const b = generateArenaMap({ layout: 'chokepoint', theme: 'ember', height: 12 }, seedRng(9));
    expect(a.value.map.rows.join('\n')).not.toBe(b.value.map.rows.join('\n'));
    // The chokepoint's band is walls; the open field has none at all.
    expect(b.value.map.rows.some((r) => r.includes('#'))).toBe(true);
    expect(a.value.map.rows.some((r) => r.includes('#'))).toBe(false);
  });
});

/**
 * The gate tax. Three draws and a pick is easier than one draw and no pick,
 * and `waveDifficulty` carries the correction — see the measurement table on
 * GATE_TAX for what it is worth and why it is only partial.
 */
describe('the price of choosing', () => {
  it('makes every wave a little dearer than it used to be', () => {
    expect(GATE_TAX).toBeGreaterThan(1);
    for (const wave of [1, 8, 16, 24]) {
      const untaxed = 0.55 + 0.03 * (wave - 1);
      expect(waveDifficulty(wave)).toBeCloseTo(untaxed * GATE_TAX, 6);
    }
  });

  it('is a scale, not a shift — the ramp keeps its shape', () => {
    // A flat surcharge would hit wave 1 hardest in relative terms, which is the
    // wave a run can least afford to lose.
    const step = (w: number) => waveDifficulty(w + 1) / waveDifficulty(w);
    expect(step(1) / step(10)).toBeGreaterThan(1);   // still decelerating
    expect(waveDifficulty(16)).toBeCloseTo(GATE_TAX, 6);
  });

  it('stays modest — it is meant to price the choice, not erase it', () => {
    // If this ever grows past a tenth, the doors have stopped being a choice
    // and become a tax with three flavours.
    expect(GATE_TAX).toBeLessThan(1.1);
  });
});

describe('buildWave still works without a door', () => {
  it('defaults to door 0 and no forced layout', () => {
    const a = buildWave(4, 3, 6);
    const b = buildWave(4, 3, 6);
    expect(a.encounter.members).toEqual(b.encounter.members);
    expect(a.budget).toBe(b.budget);
  });

  it('gives different doors different fights from the same wave seed', () => {
    const rosters = [0, 1, 2].map((d) => buildWave(4, 3, 6, undefined, d).encounter.members.join(','));
    expect(new Set(rosters).size, 'the door index does not reach the seed').toBeGreaterThan(1);
  });
});
