import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { acOf } from '../src/data/armor.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position });
  return { ...c, ...over, id: over.id ?? c.id };
}

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('derived AC', () => {
  it('reflects equipment changes', () => {
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } });
    expect(acOf(f)).toBe(17);
    f.equipped.offHand = undefined; // drop the shield
    expect(acOf(f)).toBe(15);
    delete f.equipped.armor;
    expect(acOf(f)).toBe(11); // 10 + dex +1
  });

  it('monsters use their stat-block override regardless of equipment', () => {
    const c = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 7, y: 7 }, acOverride: 15 }),
      ],
    });
    expect(acOf(c.state.combatants['b']!)).toBe(15);
  });
});

describe('weapon swapping (free interaction)', () => {
  it('attacking with a stowed weapon draws it, once per turn', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        place('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr' }),
        place('rogue', 'team2', { x: 5, y: 5 }, { id: 'rog' }),
      ],
    });
    until(c, 'ftr');
    // Javelin is stowed; longsword is in hand. Ranged attack triggers the swap.
    const events = c.apply({ kind: 'attack', weaponId: 'javelin', targetId: 'rog' });
    expect(events.some((e) => e.type === 'equipped' && e.weaponId === 'javelin')).toBe(true);
    const ftr = c.state.combatants['ftr']!;
    expect(ftr.equipped.mainHand).toBe('javelin');
    expect(ftr.inventory.some((s) => s.itemId === 'longsword')).toBe(true);
    expect(ftr.turn.interacted).toBe(true);
  });

  it('stowed weapons are not attackable once the interaction is spent', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        place('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr' }),
        place('rogue', 'team2', { x: 5, y: 5 }, { id: 'rog' }),
      ],
    });
    until(c, 'ftr');
    c.apply({ kind: 'attack', weaponId: 'javelin', targetId: 'rog' }); // swap + attack
    c.apply({ kind: 'useFeature', featureId: 'action-surge' });
    // Longsword is now stowed and the interaction is used: cannot attack with it.
    expect(() => c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'rog' })).toThrow(/Illegal/);
  });

  it('off-hand attack requires light weapons in both actual hands', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        place('rogue', 'team1', { x: 3, y: 3 }, { id: 'rog' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'ftr', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'rog');
    // Swap main hand to shortbow: main is no longer light → no off-hand attack.
    c.apply({ kind: 'attack', weaponId: 'shortbow', targetId: 'ftr' });
    expect(c.state.combatants['rog']!.equipped.mainHand).toBe('shortbow');
    expect(c.legalActions().some((a) => a.kind === 'attack' && a.offhand)).toBe(false);
  });

  it('dual-wield rogue still gets the off-hand attack after a main-hand strike', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        place('rogue', 'team1', { x: 3, y: 3 }, { id: 'rog' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'ftr', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'rog');
    c.apply({ kind: 'attack', weaponId: 'shortsword', targetId: 'ftr' });
    const off = c.legalActions().find((a) => a.kind === 'attack' && a.offhand);
    expect(off).toBeDefined();
  });
});

describe('consumables', () => {
  it('potion of healing: bonus action, heals, consumed', () => {
    const c = new Combat({
      seed: 5,
      combatants: [
        place('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr', hp: 1 }),
        place('rogue', 'team2', { x: 7, y: 7 }, { id: 'rog' }),
      ],
    });
    until(c, 'ftr');
    const events = c.apply({ kind: 'useItem', itemId: 'potion-healing', targets: [] });
    const healed = events.find((e) => e.type === 'healed')!;
    if (healed.type !== 'healed') throw new Error();
    expect(healed.amount).toBeGreaterThanOrEqual(4); // 2d4+2
    const ftr = c.state.combatants['ftr']!;
    expect(ftr.turn.bonusActionUsed).toBe(true);
    expect(ftr.turn.actionUsed).toBe(false);
    expect(ftr.inventory.some((s) => s.itemId === 'potion-healing')).toBe(false);
    // Gone: using it again is illegal.
    expect(() => c.apply({ kind: 'useItem', itemId: 'potion-healing', targets: [] })).toThrow(/Illegal/);
  });

  it('potion can be given to an adjacent ally, not a distant one', () => {
    const c = new Combat({
      seed: 5,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, { id: 'near', hp: 1 }),
        place('rogue', 'team1', { x: 5, y: 5 }, { id: 'far', hp: 1 }),
        place('wizard', 'team2', { x: 7, y: 7 }, { id: 'foe' }),
      ],
    });
    until(c, 'clr');
    expect(() => c.apply({ kind: 'useItem', itemId: 'potion-healing', targets: [{ combatantId: 'far' }] })).toThrow(/Illegal/);
    const events = c.apply({ kind: 'useItem', itemId: 'potion-healing', targets: [{ combatantId: 'near' }] });
    expect(events.some((e) => e.type === 'healed' && e.targetId === 'near')).toBe(true);
  });

  it('scroll casts the spell without consuming a slot', () => {
    const c = new Combat({
      seed: 7,
      combatants: [
        place('wizard', 'team1', { x: 0, y: 0 }, { id: 'wiz' }),
        place('fighter', 'team2', { x: 5, y: 5 }, { id: 'ftr', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const before = c.state.combatants['wiz']!.spellSlots[0]!.current;
    const events = c.apply({
      kind: 'useItem', itemId: 'scroll-magic-missile',
      targets: [{ combatantId: 'ftr' }, { combatantId: 'ftr' }, { combatantId: 'ftr' }],
    });
    expect(events.filter((e) => e.type === 'damageDealt')).toHaveLength(3);
    expect(c.state.combatants['wiz']!.spellSlots[0]!.current).toBe(before); // no slot spent
    expect(c.state.combatants['wiz']!.inventory.some((s) => s.itemId === 'scroll-magic-missile')).toBe(false);
  });

  it("alchemist's fire: thrown attack, fire damage on hit", () => {
    let sawHit = false;
    for (let seed = 1; seed <= 40 && !sawHit; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          place('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr' }),
          place('rogue', 'team2', { x: 3, y: 3 }, { id: 'rog', hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'ftr');
      const events = c.apply({ kind: 'useItem', itemId: 'alchemists-fire', targets: [{ combatantId: 'rog' }] });
      const roll = events.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(c.state.combatants['ftr']!.turn.actionUsed).toBe(true);
      if (roll.hit) {
        const dmg = events.find((e) => e.type === 'damageDealt')!;
        if (dmg.type !== 'damageDealt') throw new Error();
        expect(dmg.damageType).toBe('fire');
        sawHit = true;
      }
    }
    expect(sawHit).toBe(true);
  });

  it('default kits: every class carries a healing potion', () => {
    for (const classId of ['fighter', 'wizard', 'cleric', 'rogue']) {
      const c = buildCharacter({ classId, team: 'team1', position: { x: 0, y: 0 } });
      expect(c.inventory.some((s) => s.itemId === 'potion-healing' && s.qty > 0)).toBe(true);
    }
  });
});
