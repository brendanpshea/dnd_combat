import { describe, it, expect } from 'vitest';
import { MONSTERS, MONSTER_XP, buildMonster } from '../src/data/monsters.js';
import {
  generateEncounter, arenaRoster, adjustedXp, rawXp, groupMultiplier, ARENA_EXCLUDED,
} from '../src/arena/encounter.js';
import { generateArenaMap, validateArenaMap } from '../src/arena/map.js';
import { parseMap } from '../src/data/maps.js';
import { deployFoes } from '../src/arena/deploy.js';
import {
  buildWave, newArenaRun, recordResult, winRate, waveBudget, evenBudgetFor, waveDifficulty,
  memberCapFor, maxCountFor,
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

  it('fields at most three creature types, and at most six bodies', () => {
    // Two chosen flavours, plus at most one outsider brought in to give the
    // wave some reach: pick 'construct' and 'ooze' and every slot draws from
    // creatures that must walk the length of the board, which was a third of
    // all waves. See ensureRangedPresence in arena/encounter.ts.
    let rng = seedRng(9);
    for (const budget of BUDGETS) {
      for (let i = 0; i < 40; i++) {
        const r = generateEncounter({ budget }, rng); rng = r.state;
        expect(r.value.types.length, r.value.members.join(',')).toBeLessThanOrEqual(3);
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
  it('produces only 8-wide boards, half 10 deep and half 12', () => {
    let rng = seedRng(5);
    const heights: number[] = [];
    for (let i = 0; i < 200; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      const g = parseMap(m.value.map);
      expect(g.width).toBe(8);
      heights.push(g.height);
    }
    // 8 rows used to be half of all boards, and it is below the depth at which
    // position means anything: the longest possible shot on an 8x8 is 35 ft
    // while a shortbow reaches 80, so nobody ever needs to move. See the note
    // in arena/map.ts for the measurement.
    //
    // The ceiling is a phone, not a preference. The board is 8 wide, so an
    // aspect over ~1.5 makes the width formula in styles.css spend most of the
    // screen height on the board and squeeze the bars around it: 8x16 is
    // aspect 2.0 and took ~607px of an 844px phone. Depth above 12 buys
    // nothing anyway — win rate is flat across depths, it is the ranged band
    // that changes — so 12 is both the useful maximum and the safe one.
    const tall = heights.filter((h) => h === 12).length;
    expect(heights.every((h) => h === 10 || h === 12)).toBe(true);
    expect(heights.every((h) => h / 8 <= 1.5), 'aspect over 1.5 does not fit a phone').toBe(true);
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
    // Which wave it crosses on is a tuning decision (it moved from 6 to 16 to
    // make the level cap reachable); that it crosses at all is the invariant.
    expect(waveBudget(3, 20)).toBeGreaterThan(evenBudgetFor(3));
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
 * 0.30–0.65 separates those. A failure means **go re-measure** (150 fights a
 * point, find the budget where the win rate crosses 50%, update EVEN_BUDGET),
 * not that something is broken. Re-measuring is a few minutes; widening this
 * band to make it pass is how the constants went stale in the first place.
 *
 * `npx tsx scripts/playtest.ts` is the other half of this: the tripwire catches
 * a level whose even point has drifted, the playtest catches a whole run that
 * cannot be finished.
 */
describe('arena difficulty calibration', () => {
  it('an even-budget fight is still roughly even', () => {
    const files = [3, 1, 5, 2, 6, 0, 7, 4];
    // Every level, not just 3 and 5. Those two were the only ones checked, and
    // they were the only two that stayed honest: a playthrough sweep found L1
    // at 77%, L2 at 38% and L4 at 41% while these two sat at 47% and 51%.
    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      const budget = evenBudgetFor(level);
      let rng = seedRng(level * 7919);
      let wins = 0;
      // N=40 carries about +-8 points, and this reads a quantity that sits
      // near 45%: it flaked at exactly 0.65 on a change that moved the true
      // rate by nothing (re-measured at N=150: 42.0%, where N=40 said 65%).
      // 120 fights per level is ~3s for all seven and halves the error bar,
      // which is the difference between a tripwire and a coin toss.
      const N = 120;
      for (let i = 0; i < N; i++) {
        // The caps are part of what a budget buys — without them this measures
        // a fight the arena would never actually generate.
        const e = generateEncounter(
          { budget, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level },
          rng,
        ); rng = e.state;
        const m = generateArenaMap({}, rng); rng = m.state;
        const g = parseMap(m.value.map);
        // Deploy the way the arena screen does. Hand-placing every foe on the
        // far rank measured a fight the game no longer generates: it read L5 at
        // 75% while the shipping deployment put it at 60%, and the gap was the
        // test's own layout, not the calibration.
        const spots = deployFoes(g, e.value.members.length, rng); rng = spots.state;
        const foes = e.value.members.map((mid, k) =>
          buildMonster(mid, 'team2', spots.value.positions[k] ?? { x: 0, y: g.height - 1 }, String(k + 1)));
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
        .toBeGreaterThan(0.30);
      expect(rate, `L${level} at budget ${budget}: ${Math.round(rate * 100)}% — EVEN_BUDGET needs re-measuring`)
        .toBeLessThan(0.65);
    }
  }, 120000);
});

/**
 * The budget guards the *fight*; this guards the *hit*.
 *
 * A share-of-budget cap says nothing about whether one attack deletes a
 * character. At level 1 the squishiest hero has 7 HP, and 85 of the 132
 * monsters average that or more on a single hit — a CR 3 giant scorpion
 * averages 24 across three attacks. Paired with something cheap it fits a
 * wave-6 level-1 budget honestly, and it is miserable to meet, because
 * nothing the player does changes the outcome of a sting.
 */
describe('level-appropriate members', () => {
  it('never fields a monster far above the party', () => {
    for (const level of [1, 2, 3, 4]) {
      const cap = memberCapFor(level);
      for (let seed = 1; seed <= 60; seed++) {
        for (let wave = 1; wave <= 10; wave++) {
          const w = buildWave(seed, level, wave);
          for (const m of w.encounter.members) {
            expect(MONSTER_XP[m] ?? 0, `L${level} w${wave}: ${m} over the cap ${cap}`)
              .toBeLessThanOrEqual(cap);
          }
        }
      }
    }
  });

  // The cap must not starve the generator: a level-1 wave still has to be a
  // fight, and still has to vary.
  it('leaves the low levels plenty to draw on', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) {
      for (let wave = 1; wave <= 8; wave++) {
        const w = buildWave(seed, 1, wave);
        expect(w.encounter.members.length).toBeGreaterThan(0);
        for (const m of w.encounter.members) seen.add(m);
      }
    }
    expect(seen.size, 'level 1 draws from too small a pool').toBeGreaterThan(40);
  });

  // …and must not cap the top, where the CR 6-10 shelf is the whole point.
  it('does not cap a level-5 party', () => {
    expect(memberCapFor(5)).toBe(Infinity);
    expect(maxCountFor(5)).toBe(6);
  });

  /**
   * Headcount is capped separately from XP because 5e's group multiplier
   * under-prices a crowd against low-level heroes, and not by a little:
   * six giant badgers cost 600 adjusted XP and beat a level-1 party 75% of
   * the time, while five orcs at 1,000 lose 70% of the time. With 7-13 HP
   * what matters is attacks per round, which the multiplier flattens.
   */
  it('caps how many bodies a low-level party faces', () => {
    // The numbers themselves are a measurement and move when the roster does —
    // level 1 sat at 3 until a playthrough sweep found it could not spend its
    // budget. What must stay true is that the cap exists and rises with level.
    expect(maxCountFor(1)).toBeLessThanOrEqual(4);
    expect(maxCountFor(2)).toBeLessThanOrEqual(4);
    expect(maxCountFor(1)).toBeLessThanOrEqual(maxCountFor(3));
    for (const level of [1, 2, 3]) {
      for (let seed = 1; seed <= 40; seed++) {
        for (let wave = 1; wave <= 10; wave++) {
          const w = buildWave(seed, level, wave);
          expect(w.encounter.members.length, `L${level} w${wave}: ${w.encounter.members.join('+')}`)
            .toBeLessThanOrEqual(maxCountFor(level));
        }
      }
    }
  });
});

/**
 * The level floor: a way to keep a monster out of fights below a given party
 * level, for danger an XP budget cannot see.
 *
 * Nothing declares one today. It was added for the harpy, whose Luring Song
 * used to delete a hero from the fight outright, and fixing the song to the
 * rule it should have followed — charmed, incapacitated, drawn toward the
 * singer, saving every turn — took three harpies against a level-1 party from
 * about 10% to 92% and made the floor unnecessary. The mechanism stays,
 * tested, because the next monster whose trick outclasses its price will want
 * it and because a floor is the honest answer when a stat block is fine and
 * only the pairing is wrong.
 */
describe('monsters with a level floor', () => {
  const withFloor = (id: string, floor: number, run: () => void) => {
    const m = MONSTERS[id]!;
    const before = m.minPartyLevel;
    (m as { minPartyLevel?: number }).minPartyLevel = floor;
    try { run(); } finally { (m as { minPartyLevel?: number }).minPartyLevel = before; }
  };

  it('arenaRoster drops a floored monster below its level, and only below it', () => {
    withFloor('harpy', 3, () => {
      expect(arenaRoster(1).some((m) => m.id === 'harpy')).toBe(false);
      expect(arenaRoster(2).some((m) => m.id === 'harpy')).toBe(false);
      expect(arenaRoster(3).some((m) => m.id === 'harpy')).toBe(true);
      // No level asked for, no floor applied — the roster helper is also used
      // for coverage checks that must see every monster.
      expect(arenaRoster().some((m) => m.id === 'harpy')).toBe(true);
    });
  });

  it('generated waves respect a floor', () => {
    withFloor('harpy', 3, () => {
      for (let seed = 1; seed <= 60; seed++) {
        for (let wave = 1; wave <= 8; wave++) {
          expect(buildWave(seed, 1, wave).encounter.members).not.toContain('harpy');
          expect(buildWave(seed, 2, wave).encounter.members).not.toContain('harpy');
        }
      }
    });
  });

  // Vacuous while nothing is floored, and load-bearing the moment one is.
  it('every declared floor is honoured', () => {
    for (const m of Object.values(MONSTERS)) {
      const floor = m.minPartyLevel ?? 1;
      for (let level = 1; level < floor; level++) {
        expect(arenaRoster(level).some((r) => r.id === m.id), `${m.id} at L${level}`).toBe(false);
      }
    }
  });
});
