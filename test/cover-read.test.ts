/**
 * Reading cover off the board, so the interface can show it.
 *
 * What these defend is a promise: the badge says "+2 AC" and `resolveAttack`
 * has to agree. A marker that promises protection the dice do not deliver is
 * worse than no marker, because a player will plan around it.
 *
 * The three conditions the real rule has — ranged only, not for Large and up,
 * worth exactly 2 — are checked here against `resolveAttack` itself rather than
 * against a copy of the numbers, so the two cannot drift apart quietly.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { coverReadAt, coverReadFor, COVER_AC } from '../src/engine/rules/cover.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { acOf } from '../src/data/armor.js';
import { makeCombatant } from './helpers.js';
import type { CreatureSize, Position } from '../src/engine/types.js';

/**
 * A board with a barricade running across the middle.
 *
 * `parseMap` stores rows top-down but the grid reads bottom-up, so the LAST
 * string is the party's rank at y=0 — a fact that has produced upside-down test
 * boards more than once in this repository.
 */
const MAP = {
  id: 't', name: 't', theme: 'stone' as const,
  rows: [
    '........',   // y=7
    '........',
    '........',
    '++++++++',   // y=4, the barricade
    '........',
    '........',
    '........',
    '........',   // y=0
  ],
};

function board(heroAt: Position, foeAt: Position, size: CreatureSize = 'medium') {
  const hero = makeCombatant({ id: 'hero', team: 'team1', position: heroAt, size });
  const foe = makeCombatant({ id: 'foe', team: 'team2', position: foeAt });
  return new Combat({ seed: 1, map: MAP, combatants: [hero, foe] });
}

describe('what the badge reports', () => {
  it('sees cover when a barricade lies between you and the nearest watcher', () => {
    // Hero south of the barricade, foe north of it: the line crosses it.
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    const read = coverReadAt(c.state, { x: 3, y: 2 }, 'team1');
    expect(read.covered).toBe(true);
    expect(read.ac).toBe(COVER_AC);
    expect(read.fromId, 'cover is always cover FROM something').toBe('foe');
  });

  it('sees none when nothing is in the way', () => {
    // Both south of the barricade.
    const c = board({ x: 3, y: 1 }, { x: 3, y: 3 });
    const read = coverReadAt(c.state, { x: 3, y: 1 }, 'team1');
    expect(read.covered).toBe(false);
    expect(read.ac).toBe(0);
  });

  it('says so when nobody can see the cell', () => {
    // The distinction matters: "no cover" and "no threat" look identical on a
    // board and mean completely different things to a player choosing a square.
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    delete c.state.combatants['foe'];
    const read = coverReadAt(c.state, { x: 3, y: 2 }, 'team1');
    expect(read.unseen).toBe(true);
    expect(read.covered).toBe(false);
  });

  it('ignores an enemy that cannot see — a blinded one is not a threat', () => {
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    c.state.combatants['foe']!.conditions.push({ id: 'blinded', sourceId: 'foe' });
    expect(coverReadAt(c.state, { x: 3, y: 2 }, 'team1').unseen).toBe(true);
  });

  it('ignores a downed enemy', () => {
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    c.state.combatants['foe']!.hp = 0;
    c.state.combatants['foe']!.conditions.push({ id: 'unconscious', sourceId: 'foe' });
    expect(coverReadAt(c.state, { x: 3, y: 2 }, 'team1').unseen).toBe(true);
  });

  it('reports on the NEAREST watcher, not just any of them', () => {
    // Cover is directional, so which enemy you pick decides the answer. One foe
    // is close and in the open with you; one is far and across the barricade.
    // The near one is the honest report.
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    const near = makeCombatant({ id: 'near', team: 'team2', position: { x: 5, y: 2 } });
    c.state.combatants['near'] = near;
    const read = coverReadAt(c.state, { x: 3, y: 2 }, 'team1');
    expect(read.fromId).toBe('near');
    expect(read.covered, 'nothing between us and the close one').toBe(false);
  });
});

describe('the promise matches the dice', () => {
  it('is worth exactly what resolveAttack adds', () => {
    // Measured against the engine rather than against a copy of the number: if
    // one of them ever moves, this fails instead of the badge quietly lying.
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    const target = c.state.combatants['hero']!;
    const bare = acOf(target);
    const events = resolveAttack(c.state, 'foe', 'hero', 'shortbow');
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll, 'no attack was rolled').toBeDefined();
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.targetAc - bare, 'the badge and the maths disagree')
      .toBe(coverReadAt(c.state, { x: 3, y: 2 }, 'team1').ac);
  });

  it('does not apply to a melee attack, which reaches over it', () => {
    // The badge says "against ranged attacks" for exactly this reason, and this
    // is the only board on which the difference is observable.
    //
    // `isMeleeAttack` is "in reach AND a melee weapon", so an ordinary sword
    // swung across a barricade is not melee at all — it is out of reach, and
    // the engine scores it as ranged. And a genuinely adjacent attacker has no
    // cell between it and its target, so `coverBetween` is false anyway.
    //
    // A bugbear's Long-Limbed reach of 10 feet is the case that separates them:
    // in reach, holding a melee weapon, with the barricade in between.
    const c = board({ x: 3, y: 3 }, { x: 3, y: 5 });
    c.state.combatants['foe']!.featureIds.push('long-limbed');
    const target = c.state.combatants['hero']!;
    const bare = acOf(target);
    // The read still reports cover — it is honest about the ranged case.
    expect(coverReadAt(c.state, { x: 3, y: 3 }, 'team1').covered).toBe(true);

    const events = resolveAttack(c.state, 'foe', 'hero', 'longsword');
    const roll = events.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error('no attack rolled');
    expect(roll.targetAc, 'a reaching melee attack goes over the barricade').toBe(bare);
  });

  it('gives an ogre nothing, and says which reason applies', () => {
    // A barricade is chest-high to a person and knee-high to a giant. Reported
    // as `tooBig` rather than plain `covered: false`, because "you are standing
    // in the wrong place" and "you are too large to duck" are different facts
    // and a player can only act on one of them.
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 }, 'large');
    const read = coverReadFor(c.state, 'hero');
    expect(read.covered).toBe(false);
    expect(read.tooBig).toBe(true);

    const target = c.state.combatants['hero']!;
    const bare = acOf(target);
    const events = resolveAttack(c.state, 'foe', 'hero', 'shortbow');
    const roll = events.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.targetAc, 'the engine agrees the ogre gets nothing').toBe(bare);
  });
});

describe('reading a combatant where it stands', () => {
  it('agrees with reading its own square', () => {
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    expect(coverReadFor(c.state, 'hero')).toEqual(coverReadAt(c.state, { x: 3, y: 2 }, 'team1'));
  });

  it('reports nothing for someone who is not there', () => {
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    expect(coverReadFor(c.state, 'nobody').covered).toBe(false);
  });
});
