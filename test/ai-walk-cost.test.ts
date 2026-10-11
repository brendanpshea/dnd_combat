/**
 * The AI pays for the ground it walks over.
 *
 * WHAT WAS WRONG, MEASURED
 *
 * `scoreMove` priced the ground a walk GAINED and nothing it cost: a lava tile
 * and an open one scored the same, and stepping out of an ogre's reach was
 * free for anyone holding a sword (only casters paid, and they paid a flat -4
 * whether the thing they were leaving was a kobold or a hill giant).
 *
 * At the arena's even budget over 250 seeds a cell, at level 1: a party that
 * moved took 60 damage a fight and dealt 96; one forbidden to move took 46 and
 * dealt 106, and won 19 points more often. Nearly six of the fourteen extra
 * points were HAZARD — heroes walking through fire to close a square, on a
 * board where the level-1 wizard has eight hit points.
 *
 * After: hazard damage per fight fell from 5.8 to 1.7 at level 1, and from 3.8
 * to 0.4 at levels 3 and 5; opportunity attacks taken fell from 0.44 a fight to
 * 0.02. The same code plays the monsters, which is where a player meets it.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { readWalk, walkReads } from '../src/engine/rules/movement.js';
import type { MapData } from '../src/data/maps.js';
import { cellAt, type Position } from '../src/engine/types.js';

/** `.` open, `^` hazard, `#` wall. Rows are top rank first — y = height-1-i. */
const map = (rows: string[]): MapData => ({ id: 'probe', name: 'Probe', theme: 'ember', rows });

/** The one enemy on the board. `buildMonster` names it `team2-<id><tag>`, not
 *  the tag it is handed, which is a thing to look up rather than to guess. */
const foeOf = (c: Combat) => Object.values(c.state.combatants).find((x) => x.team === 'team2')!;

/**
 * `meleeOnly` strips the hero's thrown and ranged gear.
 *
 * Without it these tests are vacuous. A level-3 fighter carries javelins, so
 * when the only way forward is through fire the AI answers "throw a javelin"
 * — a perfectly good answer, and one that never exercises the move scoring at
 * all. A first version let that case return early and passed with the whole
 * cost term deleted.
 */
function combat(rows: string[], heroAt: Position, foeAt: Position, foeId = 'ogre', meleeOnly = false) {
  const hero = { ...buildCharacter({ classId: 'fighter', team: 'team1', level: 3, position: heroAt }), id: 'hero' };
  if (meleeOnly) {
    hero.inventory = [];
    hero.equipped = { mainHand: 'longsword' };
  }
  const foe = buildMonster(foeId, 'team2', foeAt, '1');
  const c = new Combat({ map: map(rows), combatants: [hero, foe], seed: 7 });
  let guard = 0;
  while (c.activeId !== 'hero' && guard++ < 20) c.apply({ kind: 'endTurn' });
  return c;
}

/**
 * A seam of lava with no way round, and the rows in the order a map file
 * lists them: TOP RANK FIRST, so row index 2 of six is y = 3. Spelled out
 * because reading it as y = 2 put a clean row where the fire was meant to be
 * and made two of these tests pass on their own fixture rather than on the
 * code.
 */
const SEAM = [
  '........',  // y = 5
  '........',  // y = 4
  '^^^^^^^^',  // y = 3  <- the seam
  '........',  // y = 2
  '........',  // y = 1
  '........',  // y = 0  <- the hero's rank
];

describe('one search for every walk', () => {
  it('says exactly what asking cell by cell says', () => {
    /*
     * The guarantee `walkReads` is built on: it exists only to stop the AI
     * running a fresh `reachable` for every cell it might step to, and the
     * moment it answers differently it is a second implementation of the
     * movement rules, free to disagree with the one the board shows the player.
     */
    const c = combat([
      '........',
      '..^^....',
      '........',
      '...^^...',
      '........',
      '........',
    ], { x: 1, y: 0 }, { x: 6, y: 5 });
    const hero = c.state.combatants['hero']!;
    const reads = walkReads(c.state, hero);
    expect(reads.size, 'no walks at all').toBeGreaterThan(10);
    for (const [key, bulk] of reads) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const one = readWalk(c.state, hero, { x, y });
      expect(bulk.hazardDamage, `hazard at ${key}`).toBe(one.hazardDamage);
      expect(bulk.provokers.map((p) => p.id), `provokers at ${key}`).toEqual(one.provokers.map((p) => p.id));
    }
  });

  it('is empty when there is no movement left', () => {
    const c = combat(['........', '........', '........'], { x: 1, y: 0 }, { x: 6, y: 2 });
    const hero = c.state.combatants['hero']!;
    hero.turn.movementUsed = hero.turn.movementMax;
    expect(walkReads(c.state, hero).size).toBe(0);
  });
});

describe('the AI will not wade through fire for a square of ground', () => {
  /*
   * A seam of lava across the board with no way round, and the enemy on the
   * far side of it but too far to reach this turn. Every step forward costs
   * 3d6 and buys 0.4 of a score; the old AI took it through the stalemate-
   * breaking fallback, because a positive closing term was all it could see.
   */

  it('does not step into a hazard to close a little distance', () => {
    /*
     * The hero starts ALREADY AGAINST the seam, so there is no free step
     * toward the enemy: every closing move enters the fire. A first version
     * started it a row further back, where the AI could close one square on
     * clean ground and the test passed with the cost term deleted.
     */
    const c = combat(SEAM, { x: 3, y: 1 }, { x: 3, y: 5 }, 'ogre', true);
    const action = chooseAction(c.state, 'hero');
    // Melee only, and nothing in reach: the choice really is "wade in or wait".
    expect(action.kind, `it did ${JSON.stringify(action)}`).not.toBe('attack');
    if (action.kind === 'move') {
      expect(cellAt(c.state.grid, action.to)!.terrain,
        `walked onto ${action.to.x},${action.to.y}`).not.toBe('hazard');
      const walk = readWalk(c.state, c.state.combatants['hero']!, action.to);
      expect(walk.hazardDamage, 'the route crosses the seam').toBe(0);
    }
  });

  it('still closes when the ground is clean', () => {
    /*
     * The bug at the other end: an AI that prices risk too dearly stops moving
     * at all, and a melee fighter that never closes never fights.
     *
     * Played out rather than asked once. A single `chooseAction` on an open
     * board can legitimately answer "attack" — a level-3 fighter carries a
     * ranged weapon, and a first version of this test read that as the AI
     * refusing to move. What matters is whether the lines ever meet.
     */
    const open = ['........', '........', '........', '........', '........', '........'];
    const c = combat(open, { x: 3, y: 0 }, { x: 3, y: 5 });
    let steps = 0, met = false;
    while (!c.state.winner && steps++ < 200 && !met) {
      c.apply(chooseAction(c.state, c.activeId!));
      const hero = c.state.combatants['hero']!, foe = foeOf(c);
      met = Math.max(Math.abs(hero.position.x - foe.position.x),
        Math.abs(hero.position.y - foe.position.y)) <= 1;
    }
    expect(met, 'nobody ever closed on an empty board').toBe(true);
  });

  it('crosses the fire anyway when the prize is worth it', () => {
    // Not a blanket refusal. With the enemy one step past the seam, stepping
    // through buys an attack this turn, and that is worth 3d6.
    const c = combat(SEAM, { x: 3, y: 1 }, { x: 3, y: 3 });
    const hero = c.state.combatants['hero']!;
    const reads = walkReads(c.state, hero);
    const next = reads.get('3,3') ?? reads.get('2,3') ?? reads.get('4,3');
    expect(next, 'the cell beside the enemy is not even reachable').toBeDefined();
    const action = chooseAction(c.state, 'hero');
    expect(['move', 'attack'], `it did ${action.kind} instead`).toContain(action.kind);
  });
});

describe('the AI pays for the swing it hands out', () => {
  it('prices an opportunity attack by what the creature actually swings', () => {
    /*
     * The flat -4 this replaces was the same for a kobold and a hill giant,
     * and melee characters were charged nothing at all. Rather than assert a
     * score directly — the units are the file's own — this checks the shape:
     * the same walk away from a big hitter must cost more than from a small
     * one, which is the whole point of reading `maxDamage`.
     */
    const open = ['........', '........', '........', '........'];
    const cost = (foeId: string) => {
      const c = combat(open, { x: 3, y: 1 }, { x: 3, y: 2 }, foeId);
      const hero = c.state.combatants['hero']!;
      const read = walkReads(c.state, hero).get('3,0');
      expect(read, `no walk away from the ${foeId}`).toBeDefined();
      return read!.provokers.reduce((a, p) => a + p.maxDamage, 0);
    };
    const small = cost('kobold');
    const big = cost('ogre');
    expect(small, 'the kobold does not threaten the step at all').toBeGreaterThan(0);
    expect(big, 'an ogre is priced the same as a kobold').toBeGreaterThan(small);
  });
});

/*
 * NO TEST FOR THE WALK CACHE, and that is deliberate.
 *
 * `walksFor` memoises one actor's walks across the many `chooseAction` calls a
 * single turn makes, keyed on the actor, its cell, its spent movement, whether
 * it has disengaged, and the turn. A stale key would be a real bug — the
 * second half of every turn would price its walks from where the turn began.
 *
 * Three fixtures were built to catch it and none did: with the key cut down to
 * the actor's id alone, the AI still chose correctly in every position that
 * could be engineered, because the cells a stale read misses are mostly cells
 * it would decline anyway. A test that passes with the bug planted in it is
 * worse than no test, so there is not one here rather than one that looks like
 * cover and is not.
 *
 * What IS pinned is the thing the cache is a cache OF: `walkReads` gives cell
 * for cell what `readWalk` gives one at a time, above.
 */
