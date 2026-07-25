import { describe, it, expect } from 'vitest';
import { MONSTERS, MONSTER_XP, buildMonster } from '../src/data/monsters.js';
import {
  generateEncounter, arenaRoster, adjustedXp, rawXp, groupMultiplier, ARENA_EXCLUDED,
} from '../src/arena/encounter.js';
import { generateArenaMap, validateArenaMap } from '../src/arena/map.js';
import { parseMap } from '../src/data/maps.js';
import {
  buildWave, newArenaRun, recordResult, winRate, waveBudget, evenBudgetFor, waveDifficulty,
} from '../src/arena/run.js';
import { seedRng } from '../src/engine/rng.js';
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import {
  newCampaign, buildCampaignParty, applyArenaVictory, longRest,
} from '../src/campaign/campaign.js';
import { chooseAction } from '../src/ai/greedy.js';

/**
 * The guard that makes "new monsters join the arena automatically" safe. A
 * monster without an XP entry reads as free, so the generator would stack six
 * of them into a fight it believes is within budget; one without a creature
 * type breaks the two-types-per-fight rule. Both are silent failures, which is
 * exactly why they're asserted rather than trusted.
 */
describe('arena roster coverage', () => {
  it('every monster has an XP value and a creature type', () => {
    const noXp: string[] = [];
    const noType: string[] = [];
    for (const m of Object.values(MONSTERS)) {
      if (!MONSTER_XP[m.id]) noXp.push(m.id);
      if (!m.creatureType) noType.push(m.id);
    }
    expect(noXp, `monsters missing MONSTER_XP: ${noXp.join(', ')}`).toEqual([]);
    expect(noType, `monsters missing creatureType: ${noType.join(', ')}`).toEqual([]);
  });

  it('the roster is every monster except the deliberate exclusions', () => {
    const roster = arenaRoster();
    expect(roster.length).toBe(Object.keys(MONSTERS).length - ARENA_EXCLUDED.size);
    // Everything on it must actually build, or a wave will throw mid-run.
    for (const m of roster) {
      expect(() => buildMonster(m.id, 'team2', { x: 0, y: 0 }), m.id).not.toThrow();
    }
  });
});

describe('encounter generation', () => {
  const BUDGETS = [200, 500, 1000, 2000, 4000, 8000];

  it('prices a group by 5e headcount multipliers, not raw XP', () => {
    expect(groupMultiplier(1)).toBe(1);
    expect(groupMultiplier(2)).toBe(1.5);
    expect(groupMultiplier(4)).toBe(2);
    expect(groupMultiplier(8)).toBe(2.5);
    // Same raw XP, more bodies, more dangerous — the thing raw XP hides.
    const solo = ['ogre'];
    const pack = ['wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf'];
    expect(rawXp(pack)).toBeCloseTo(rawXp(solo), -1);
    expect(adjustedXp(pack)).toBeGreaterThan(adjustedXp(solo) * 2);
  });

  it('lands near the budget, never wildly over, across the whole range', () => {
    let rng = seedRng(4);
    for (const budget of BUDGETS) {
      for (let i = 0; i < 40; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        const fill = r.value.adjustedXp / budget;
        expect(fill, `budget ${budget} underfilled: ${r.value.members.join(',')}`).toBeGreaterThan(0.6);
        expect(fill, `budget ${budget} overfilled: ${r.value.members.join(',')}`).toBeLessThan(1.35);
      }
    }
  });

  it('fields at most two creature types, and at most six bodies', () => {
    let rng = seedRng(9);
    for (const budget of BUDGETS) {
      for (let i = 0; i < 40; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        expect(r.value.types.length, r.value.members.join(',')).toBeLessThanOrEqual(2);
        expect(r.value.members.length).toBeGreaterThan(0);
        expect(r.value.members.length).toBeLessThanOrEqual(6);
      }
    }
  });

  // Action economy doesn't care about XP: one huge monster "fits" a budget the
  // party cannot survive, because they can't chip it down before it kills them.
  it('never spends the whole budget on a single monster', () => {
    let rng = seedRng(11);
    for (const budget of [2000, 4000, 8000]) {
      for (let i = 0; i < 30; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        if (r.value.members.length !== 1) continue;
        expect(rawXp(r.value.members), 'solo over the cap').toBeLessThanOrEqual(budget * 0.75);
      }
    }
  });

  it('scales headcount with budget rather than always fielding one heavyweight', () => {
    let rng = seedRng(13);
    const mean = (budget: number) => {
      let total = 0;
      for (let i = 0; i < 60; i++) { const r = generateEncounter({ budget }, rng); rng = r.state; total += r.value.members.length; }
      return total / 60;
    };
    expect(mean(8000)).toBeGreaterThan(mean(500));
  });

  /**
   * The draw floor is a share of the slot's own budget, not a share of the
   * dearest monster that happens to fit — a pool-relative floor rises as a
   * type gains expensive members, which quietly retires that type's cheap
   * ones (adding the CR 6-10 dragons pushed the wyrmlings out of high-budget
   * waves this way).
   *
   * Honest scope: this asserts cheap-but-fitting monsters get drawn at all. It
   * does NOT discriminate against the old pool-relative floor, which also
   * passes here — that difference is a frequency shift, measured by hand at
   * the top of the budget range and too narrow to pin as an assertion without
   * making it brittle.
   */
  it('fields cheap monsters whose price fits a slot share', () => {
    let rng = seedRng(41);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = generateEncounter({ budget: 4500 }, rng); rng = r.state;
      for (const m of r.value.members) seen.add(m);
    }
    // Every wyrmling costs 450-1,100 against a per-head share of roughly 560
    // here, so all five belong in the draw.
    for (const w of ['black-wyrmling', 'green-wyrmling', 'white-wyrmling', 'blue-wyrmling', 'red-wyrmling']) {
      expect(seen.has(w), `${w} never drawn at a budget it fits`).toBe(true);
    }
  });

  /**
   * A type whose cheapest member costs more than the solo cap must not be
   * offered at all. Otherwise rollCount finds no headcount it can pay for,
   * falls back to a single body, and the "always leave something affordable"
   * floor waves that over-cap monster through. Aberrations (cheapest 1,800)
   * hit exactly this when they were added.
   */
  it('never offers a type whose cheapest member breaks the solo cap', () => {
    let rng = seedRng(47);
    for (const budget of [500, 1000, 2000]) {
      for (let i = 0; i < 200; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        if (r.value.members.length !== 1) continue;
        expect(rawXp(r.value.members), `solo over cap at ${budget}: ${r.value.members[0]}`)
          .toBeLessThanOrEqual(budget * 0.75);
      }
    }
  });

  it('never fields an excluded monster', () => {
    expect(ARENA_EXCLUDED.has('unicorn'), 'the unicorn is a benign guardian').toBe(true);
    expect(arenaRoster().some((m) => m.id === 'unicorn')).toBe(false);
    let rng = seedRng(43);
    for (const budget of [500, 4500, 14000, 20000]) {
      for (let i = 0; i < 150; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        for (const id of r.value.members) {
          expect(ARENA_EXCLUDED.has(id), `${id} is excluded but was fielded`).toBe(false);
        }
      }
    }
  });

  it('is deterministic on the seed', () => {
    const a = generateEncounter({ budget: 1500 }, seedRng(21)).value;
    const b = generateEncounter({ budget: 1500 }, seedRng(21)).value;
    expect(a.members).toEqual(b.members);
  });
});

describe('map generation', () => {
  it('produces only 8-wide boards, half 8x8 and half 8x12', () => {
    let rng = seedRng(5);
    const heights: number[] = [];
    for (let i = 0; i < 200; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      const g = parseMap(m.value.map);
      expect(g.width).toBe(8);
      heights.push(g.height);
    }
    const tall = heights.filter((h) => h === 12).length;
    expect(heights.every((h) => h === 8 || h === 12)).toBe(true);
    expect(tall, `tall share ${tall}/200`).toBeGreaterThan(60);
    expect(tall).toBeLessThan(140);
  });

  it('every generated map passes validation', () => {
    let rng = seedRng(6);
    for (let i = 0; i < 300; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      expect(validateArenaMap(m.value.map), m.value.map.rows.join('/')).toEqual([]);
    }
  });

  // The failure that doesn't look like a failure: a sealed-off board produces a
  // battle where the AI can never reach anyone and the fight never ends.
  it('validation catches sealed regions, blocked spawns and hazardous spawns', () => {
    const sealed = {
      id: 'x', name: 'x', theme: 'stone' as const,
      rows: ['........', '########', '........', '........', '........', '........', '........', '........'],
    };
    expect(validateArenaMap(sealed)).toContain('disconnected');

    const blocked = {
      id: 'x', name: 'x', theme: 'stone' as const,
      rows: ['........', '........', '........', '........', '........', '........', '........', '##..####'],
    };
    expect(validateArenaMap(blocked)).toContain('deploy-blocked');

    const fiery = {
      id: 'x', name: 'x', theme: 'ember' as const,
      rows: ['........', '........', '........', '........', '........', '........', '^^^^^^^^', '........'],
    };
    expect(validateArenaMap(fiery)).toContain('spawn-hazard');
  });

  it('is deterministic on the seed', () => {
    const a = generateArenaMap({}, seedRng(31)).value.map;
    const b = generateArenaMap({}, seedRng(31)).value.map;
    expect(a.rows).toEqual(b.rows);
  });
});

describe('arena run', () => {
  it('escalates: later waves cost more than earlier ones', () => {
    expect(waveDifficulty(1)).toBeLessThan(1);
    expect(waveBudget(3, 1)).toBeLessThan(waveBudget(3, 5));
    expect(waveBudget(3, 5)).toBeLessThan(waveBudget(3, 10));
    // …and crosses an even fight partway in, so a run has a natural ceiling.
    expect(waveBudget(3, 6)).toBeGreaterThan(evenBudgetFor(3) * 0.95);
  });

  it('a retry regenerates the same fight, not a fresh roll', () => {
    const a = buildWave(1234, 3, 4);
    const b = buildWave(1234, 3, 4);
    expect(a.encounter.members).toEqual(b.encounter.members);
    expect(a.map.rows).toEqual(b.map.rows);
    // …and a different wave is a different fight.
    expect(buildWave(1234, 3, 5).encounter.members).not.toEqual(a.encounter.members);
  });

  it('tracks first-try clears separately from total wins', () => {
    let run = newArenaRun(7);
    run = recordResult(run, true, 100);      // wave 1, first try
    run = recordResult(run, false, 100);     // wave 2, failed
    run = recordResult(run, true, 120);      // wave 2, second try
    expect(run.cleared).toBe(2);
    expect(run.clearedFirstTry).toBe(1);
    expect(run.wave).toBe(3);
    expect(run.gold).toBe(220);
    expect(winRate(run)).toBeCloseTo(2 / 3);
    // A loss keeps the player on the same wave and banks no gold.
    const before = run.gold;
    run = recordResult(run, false, 999);
    expect(run.wave).toBe(3);
    expect(run.gold).toBe(before);
    expect(run.attempts).toBe(1);
  });

  it('every wave builds into a runnable fight', () => {
    for (let wave = 1; wave <= 8; wave++) {
      const w = buildWave(99, 3, wave);
      expect(w.encounter.members.length).toBeGreaterThan(0);
      expect(validateArenaMap(w.map)).toEqual([]);
      for (const mid of w.encounter.members) {
        expect(() => buildMonster(mid, 'team2', { x: 0, y: 0 }), mid).not.toThrow();
      }
    }
  });
});

describe('arena plumbing', () => {
  it('Combat accepts a generated map by value', () => {
    const w = buildWave(77, 2, 3);
    const grid = parseMap(w.map);
    const c = new Combat({
      seed: 1, map: w.map,
      combatants: [...buildParty('team1', 0, 2)],
    });
    expect(c.state.grid.width).toBe(grid.width);
    expect(c.state.grid.height).toBe(grid.height);
    // The terrain really came from the generated board, not a blank grid.
    expect(c.state.grid.cells.map((x) => x.terrain))
      .toEqual(grid.cells.map((x) => x.terrain));
  });

  it('applyArenaVictory awards XP and treasure from raw XP, without a stage', () => {
    const camp = newCampaign(3);
    camp.partyReady = true;
    const before = { xp: camp.xp, gold: camp.gold, stage: camp.stage };
    const party = buildCampaignParty(camp);
    const result = applyArenaVictory(camp, party, 1200, 9);
    expect(result.xpGained).toBe(Math.round(1200 / camp.characters.length));
    expect(camp.xp).toBe(before.xp + result.xpGained);
    expect(camp.gold).toBeGreaterThanOrEqual(before.gold);
    // The arena is not the ladder — it must never advance the campaign stage.
    expect(camp.stage).toBe(before.stage);
  });

  it('a full rest between waves puts the party back to full', () => {
    const camp = newCampaign(4);
    camp.partyReady = true;
    for (const ch of camp.characters) ch.hp = 1;
    longRest(camp);
    const party = buildCampaignParty(camp);
    for (const p of party) expect(p.hp, p.name).toBe(p.maxHp);
  });
});

/**
 * The end-to-end guard: generated fights must actually resolve. A composition
 * or a board that stalls produces a battle nobody can finish, and it would only
 * ever show up in play.
 */
describe('generated fights complete', () => {
  it('runs a spread of waves to a winner under AI control', () => {
    for (const wave of [1, 4, 7]) {
      const w = buildWave(2024, 2, wave);
      const grid = parseMap(w.map);
      const files = [3, 1, 5, 2, 6, 0, 7, 4];
      const foes = w.encounter.members.slice(0, 8).map((mid, i) =>
        buildMonster(mid, 'team2', { x: files[i]!, y: grid.height - 1 }, String(i + 1)));
      const c = new Combat({
        seed: 5, width: grid.width, height: grid.height,
        combatants: [...buildParty('team1', 0, 2), ...foes],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 3000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `wave ${wave} did not resolve: ${w.encounter.members.join(',')}`).toBe(true);
    }
  }, 60000);
});

/**
 * EVEN_BUDGET is a *measurement*, not a rule, and measurements decay. The
 * first calibration was taken against a 58-monster roster; by the time anyone
 * checked again the bestiary had grown to 132 and the party was winning 78%
 * at the L3 "even" budget instead of 50% — every wave softer than the ramp
 * claimed, with nothing in the suite noticing.
 *
 * This is a tripwire, not a calibration. It is fully seeded, so it computes a
 * fixed number for a given roster rather than sampling — the band is set from
 * measurement, not from a confidence interval:
 *
 *   calibrated constants   L3 53%   L5 55%
 *   the stale ones         L3 62%   L5 67%
 *
 * 0.35–0.60 separates those. A failure means **go re-measure** (80 fights a
 * point, find the budget where the win rate crosses 50%, update EVEN_BUDGET),
 * not that something is broken. Re-measuring is a few minutes; widening this
 * band to make it pass is how the constants went stale in the first place.
 */
describe('arena difficulty calibration', () => {
  it('an even-budget fight is still roughly even', () => {
    const files = [3, 1, 5, 2, 6, 0, 7, 4];
    for (const level of [3, 5]) {
      const budget = evenBudgetFor(level);
      let rng = seedRng(level * 7919);
      let wins = 0;
      const N = 60;
      for (let i = 0; i < N; i++) {
        const e = generateEncounter({ budget }, rng); rng = e.state;
        const m = generateArenaMap({}, rng); rng = m.state;
        const g = parseMap(m.value.map);
        const foes = e.value.members.map((mid, k) =>
          buildMonster(mid, 'team2', { x: files[k % 8]!, y: g.height - 1 }, String(k + 1)));
        const c = new Combat({
          seed: i + 1, map: m.value.map,
          combatants: [...buildParty('team1', 0, level), ...foes],
        });
        let steps = 0;
        while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
        if (c.winner() === 'team1') wins++;
      }
      const rate = wins / N;
      expect(rate, `L${level} at budget ${budget}: ${Math.round(rate * 100)}% — EVEN_BUDGET needs re-measuring`)
        .toBeGreaterThan(0.35);
      expect(rate, `L${level} at budget ${budget}: ${Math.round(rate * 100)}% — EVEN_BUDGET needs re-measuring`)
        .toBeLessThan(0.6);
    }
  }, 120000);
});
