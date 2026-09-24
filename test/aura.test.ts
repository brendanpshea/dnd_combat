import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { ownerTurnEndAuras, turnStartAuras } from '../src/engine/rules/aura.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import type { Combatant } from '../src/engine/types.js';
import { makeCombatant } from './helpers.js';

/**
 * Monster auras and Legendary Resistance, SRD 5.2.1.
 */
function arena(monsterId: string, others: Partial<Combatant>[], seed = 1) {
  const m = { ...buildMonster(monsterId, 'team2', { x: 2, y: 3 }), id: 'm' };
  const rest = others.map((o, i) => makeCombatant({
    id: `c${i}`, team: 'team1', hp: 1000, maxHp: 1000, position: { x: 2, y: 4 }, ...o,
  }));
  return new Combat({ seed, mapId: 'open', combatants: [m, ...rest] });
}

const hurt = (c: Combat, id: string) => c.state.combatants[id]!.maxHp - c.state.combatants[id]!.hp;

describe('Fire Aura (end of the owner\'s turn)', () => {
  it('a fire elemental burns everyone within 10 ft, allies included, and no one further', () => {
    const c = arena('fire-elemental', [
      { position: { x: 4, y: 3 } },                      // 10 ft
      { position: { x: 5, y: 3 } },                      // 15 ft
      { position: { x: 1, y: 3 }, team: 'team2' },       // an ally, 5 ft
    ]);
    ownerTurnEndAuras(c.state, 'm');
    expect(hurt(c, 'c0')).toBeGreaterThanOrEqual(1);
    expect(hurt(c, 'c0')).toBeLessThanOrEqual(10);
    expect(hurt(c, 'c1')).toBe(0);
    expect(hurt(c, 'c2')).toBeGreaterThanOrEqual(1);
  });

  it('a salamander chooses: its allies are spared', () => {
    const c = arena('salamander', [{}, { position: { x: 1, y: 3 }, team: 'team2' }]);
    ownerTurnEndAuras(c.state, 'm');
    expect(hurt(c, 'c0')).toBeGreaterThanOrEqual(2);
    expect(hurt(c, 'c1')).toBe(0);
  });

  it('fire immunity holds against it', () => {
    const c = arena('remorhaz', [{ immunities: ['fire'] }]);
    ownerTurnEndAuras(c.state, 'm');
    expect(hurt(c, 'c0')).toBe(0);
  });

  it('an incapacitated azer does not burn anyone', () => {
    const c = arena('azer', [{}]);
    c.state.combatants['m']!.conditions.push({ id: 'stunned' });
    ownerTurnEndAuras(c.state, 'm');
    expect(hurt(c, 'c0')).toBe(0);
  });

  it('runs as the owner ends its turn', () => {
    const c = arena('remorhaz', [{}]);
    c.state.turnIndex = c.state.initiativeOrder.indexOf('m');
    c.apply({ kind: 'endTurn' });
    expect(hurt(c, 'c0')).toBeGreaterThanOrEqual(3);
  });
});

describe('Stench (start of the target\'s turn)', () => {
  /** First seed on which `c0` fails (or saves against) the stench. */
  function stench(monsterId: string, want: 'fail' | 'save', o: Partial<Combatant> = {}) {
    for (let seed = 1; seed <= 60; seed++) {
      const c = arena(monsterId, [o], seed);
      const events = turnStartAuras(c.state, 'c0');
      const save = events.find((e) => e.type === 'savingThrow');
      if (save?.type === 'savingThrow' && save.success === (want === 'save')) return c;
    }
    throw new Error(`no seed gave a ${want}`);
  }

  it('a failed save poisons until the start of the target\'s next turn', () => {
    const c = stench('hezrou', 'fail');
    const k = c.state.combatants['c0']!.conditions.find((x) => x.id === 'poisoned');
    expect(k?.sourceId).toBe('m');
    expect(k?.endsAtTurnStartOf).toBe('c0');
  });

  it('reaches 10 ft for a hezrou, and no further', () => {
    const c = arena('hezrou', [{ position: { x: 5, y: 3 } }]);
    expect(turnStartAuras(c.state, 'c0')).toEqual([]);
  });

  it('a ghast\'s stench, once saved against, never asks again', () => {
    const c = stench('ghast', 'save');
    expect(c.state.combatants['c0']!.auraImmuneTo).toEqual(['m']);
    expect(turnStartAuras(c.state, 'c0')).toEqual([]);
  });

  it('a hezrou\'s gives no such immunity', () => {
    const c = stench('hezrou', 'save');
    expect(c.state.combatants['c0']!.auraImmuneTo).toBeUndefined();
  });

  it('poison immunity keeps the condition off', () => {
    const c = stench('hezrou', 'fail', { immunities: ['poison'] });
    expect(c.state.combatants['c0']!.conditions.some((k) => k.id === 'poisoned')).toBe(false);
  });
});

describe('Legendary Resistance', () => {
  it('turns three failed saves into successes, then runs out', () => {
    const c = arena('unicorn', [{}]);
    const u = c.state.combatants['m']!;
    expect(u.featureUses['legendary-resistance']).toEqual({ current: 3, max: 3 });
    const results = [0, 1, 2, 3].map(() => savingThrow(c.state, 'm', 'str', 99, { magical: false }));
    expect(results.map((r) => r.success)).toEqual([true, true, true, false]);
    expect(results[0]!.event.type === 'savingThrow' && results[0]!.event.luck).toBe('Legendary Resistance');
    expect(u.featureUses['legendary-resistance']!.current).toBe(0);
  });

  it('is not spent on a save that succeeds anyway', () => {
    const c = arena('aboleth', [{}]);
    savingThrow(c.state, 'm', 'con', -99, { magical: false });
    expect(c.state.combatants['m']!.featureUses['legendary-resistance']!.current).toBe(3);
  });
});
