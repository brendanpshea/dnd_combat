import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { buildCharacter } from '../src/builder/character.js';
import { applyDamage, canAttackWith } from '../src/engine/rules/attack.js';
import { legalActions, step } from '../src/engine/actions.js';
import { isDown } from '../src/engine/types.js';
import type { Combatant, GameState } from '../src/engine/types.js';

/**
 * Stat-block details from SRD 5.2.1 that the numbers test cannot see: what a
 * Multiattack lets a monster swing, a troll's regeneration at 0 HP, fly speeds.
 */

const hero = (id: string, x: number, y: number): Combatant =>
  ({ ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x, y }, level: 5 }), id, hp: 500, maxHp: 500 });

function duel(monsterId: string): { c: Combat; id: string } {
  const m = { ...buildMonster(monsterId, 'team2', { x: 3, y: 4 }), id: 'm' };
  const c = new Combat({ seed: 2, width: 8, height: 8, combatants: [hero('h', 3, 3), m] });
  let guard = 0;
  while (c.activeId !== 'm' && guard++ < 10) c.apply({ kind: 'endTurn' });
  return { c, id: 'm' };
}

const swings = (state: GameState, id: string) => [...new Set(legalActions(state, id)
  .filter((a) => a.kind === 'attack' && !a.offhand && !a.frenzy)
  .map((a) => (a as { weaponId: string }).weaponId))].sort();

const swing = (c: Combat, id: string, weaponId: string) => {
  const a = legalActions(c.state, id).find((x) => x.kind === 'attack' && x.weaponId === weaponId && !x.offhand && !x.frenzy);
  expect(a, `${weaponId} should be legal`).toBeDefined();
  c.apply(a!);
};

describe('a Multiattack that names its attacks (SRD 5.2.1)', () => {
  it('a wyvern bites once and stings once', () => {
    const { c, id } = duel('wyvern');
    expect(swings(c.state, id)).toEqual(['wyvern-bite', 'wyvern-sting']);
    swing(c, id, 'wyvern-bite');
    expect(swings(c.state, id)).toEqual(['wyvern-sting']);
    swing(c, id, 'wyvern-sting');
    expect(swings(c.state, id)).toEqual([]);
  });

  it('a giant scorpion makes two Claw attacks and one Sting, in any order', () => {
    const { c, id } = duel('giant-scorpion');
    swing(c, id, 'scorpion-sting');
    expect(swings(c.state, id)).toEqual(['scorpion-claw']);
    swing(c, id, 'scorpion-claw');
    swing(c, id, 'scorpion-claw');
    expect(swings(c.state, id)).toEqual([]);
  });

  it('a ghoul makes two Bites — or its one Claw', () => {
    const bites = duel('ghoul');
    swing(bites.c, bites.id, 'ghoul-bite');
    expect(swings(bites.c.state, bites.id)).toEqual(['ghoul-bite']);
    const claw = duel('ghoul');
    swing(claw.c, claw.id, 'ghoul-claws');
    expect(swings(claw.c.state, claw.id)).toEqual([]);
    expect(claw.c.state.combatants['m']!.turn.attacksLeft).toBe(0);
  });

  it('a vampire spawn claws twice and bites', () => {
    const { c, id } = duel('vampire-spawn');
    swing(c, id, 'spawn-claws');
    swing(c, id, 'spawn-bite');
    expect(swings(c.state, id)).toEqual(['spawn-claws']);
  });

  it('"any combination" stays any combination', () => {
    const { c, id } = duel('goblin-boss');
    expect(c.state.combatants[id]!.routines).toBeUndefined();
  });
});

describe('regeneration at 0 HP (SRD 5.2.1, Troll)', () => {
  function trollFight() {
    const troll = { ...buildMonster('troll', 'team2', { x: 3, y: 4 }), id: 't' };
    const ogre = { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'o' };
    const c = new Combat({ seed: 5, width: 8, height: 8, combatants: [hero('h', 3, 3), troll, ogre] });
    return c;
  }

  it('dropped by a blade, it is down rather than dead — and can still be hit', () => {
    const c = trollFight();
    applyDamage(c.state, 't', 'h', 999, 'slashing', [], { magical: false });
    const t = c.state.combatants['t']!;
    expect(t.alive).toBe(true);
    expect(isDown(t)).toBe(true);
    expect(canAttackWith(c.state, c.state.combatants['h']!, 'longsword', 't')).toBe(true);
  });

  it('gets back up on its turn with its regeneration', () => {
    const c = trollFight();
    applyDamage(c.state, 't', 'h', 999, 'slashing', [], { magical: false });
    let guard = 0;
    while (c.activeId !== 't' && !c.isOver() && guard++ < 10) c.apply({ kind: 'endTurn' });
    const t = c.state.combatants['t']!;
    expect(c.activeId).toBe('t');
    expect(t.hp).toBe(15);
    expect(t.conditions.map((k) => k.id)).not.toContain('unconscious');
  });

  it('dies if acid or fire stopped it — the blow that drops it, or one after', () => {
    const burnt = trollFight();
    applyDamage(burnt.state, 't', 'h', 999, 'fire', [], { magical: true });
    expect(burnt.state.combatants['t']!.alive).toBe(false);

    const later = trollFight();
    applyDamage(later.state, 't', 'h', 999, 'slashing', [], { magical: false });
    applyDamage(later.state, 't', 'h', 1, 'acid', [], { magical: true });
    expect(later.state.combatants['t']!.alive).toBe(false);
  });

  it('does not hold the fight open once it is the last one standing', () => {
    const troll = { ...buildMonster('troll', 'team2', { x: 3, y: 4 }), id: 't' };
    const c = new Combat({ seed: 5, width: 8, height: 8, combatants: [hero('h', 3, 3), troll] });
    applyDamage(c.state, 't', 'h', 999, 'slashing', [], { magical: false });
    expect(c.state.winner).toBe('team1');
  });
});

describe('fly speeds', () => {
  it('a flier crosses the board at its Fly speed', () => {
    expect(buildMonster('wyvern', 'team2', { x: 0, y: 0 }).speed).toBe(80);
    expect(buildMonster('ghost', 'team2', { x: 0, y: 0 }).speed).toBe(40);
    expect(buildMonster('ogre', 'team2', { x: 0, y: 0 }).speed).toBe(40);
  });
});

describe('physical resistance only where the SRD prints it', () => {
  it('a wight, a mummy and a vampire spawn take a mundane blade in full', () => {
    for (const id of ['wight', 'mummy', 'vampire-spawn']) {
      const { c } = duel(id);
      const m = c.state.combatants['m']!;
      const before = m.hp;
      applyDamage(c.state, 'm', 'h', 10, 'slashing', [], { magical: false });
      expect(before - m.hp, id).toBe(10);
    }
  });
});

describe('a routine is still legal to the step function', () => {
  it('rejects a swing the routine does not allow', () => {
    const { c, id } = duel('wyvern');
    swing(c, id, 'wyvern-bite');
    expect(() => step(c.state, { kind: 'attack', weaponId: 'wyvern-bite', targetId: 'h' })).toThrow();
  });
});
