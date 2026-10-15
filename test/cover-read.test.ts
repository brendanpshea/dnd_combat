/**
 * Reading cover off the board, so the interface can show it.
 *
 * What these defend is a promise: the badge says "+2 AC" and `resolveAttack`
 * has to agree. A marker that promises protection the dice do not deliver is
 * worse than no marker, because a player will plan around it.
 *
 * The conditions the real rule has — ranged only, worth exactly 2 (or 5) — are
 * checked here against `resolveAttack` itself rather than against a copy of the
 * numbers, so the two cannot drift apart quietly. (A third, "not for Large and
 * up", went with the size gate: SRD 5.2.1 has none.)
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

  it('covers a Large creature too — the SRD has no size gate', () => {
    const c = board({ x: 3, y: 2 }, { x: 3, y: 6 }, 'large');
    const read = coverReadFor(c.state, 'hero');
    expect(read.covered).toBe(true);
    expect(read.level).toBe('half');

    const target = c.state.combatants['hero']!;
    const bare = acOf(target);
    const events = resolveAttack(c.state, 'foe', 'hero', 'shortbow');
    const roll = events.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.targetAc - bare, 'the engine agrees').toBe(read.ac);
  });

  it('counts a creature on the line, and says three-quarters behind high cover', () => {
    const c = board({ x: 3, y: 1 }, { x: 3, y: 3 });
    // No barricade between y=1 and y=3; a bystander at y=2 is the cover.
    c.state.combatants['ally'] = makeCombatant({ id: 'ally', team: 'team1', position: { x: 3, y: 2 } });
    c.state.grid.cells[2 * 8 + 3]!.occupantId = 'ally';
    const read = coverReadAt(c.state, { x: 3, y: 1 }, 'team1');
    expect(read.level).toBe('half');
    // A mover asking about where it is going ignores the square it stands on.
    expect(coverReadAt(c.state, { x: 3, y: 1 }, 'team1', 'ally').covered).toBe(false);

    const high = board({ x: 3, y: 2 }, { x: 3, y: 6 });
    high.state.grid.cells[4 * 8 + 3]!.terrain = 'high-cover';
    const r = coverReadAt(high.state, { x: 3, y: 2 }, 'team1');
    expect(r.level).toBe('three-quarters');
    expect(r.ac).toBe(5);
    const roll = resolveAttack(high.state, 'foe', 'hero', 'shortbow').find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.targetAc - acOf(high.state.combatants['hero']!)).toBe(5);
    expect(roll.coverLevel).toBe('three-quarters');
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
