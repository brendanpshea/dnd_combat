import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { acOf } from '../src/data/armor.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';
import { newCampaign, itemFitFor } from '../src/campaign/campaign.js';

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
    delete f.equipped.offHand; // drop the shield
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
        // Level 2 for Action Surge (a 2024 level-2 feature), used here to get a
        // second action after the free weapon swap is spent.
        { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 2 }), id: 'ftr' },
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

describe('what an item is worth to the hero buying it', () => {
  /**
   * `itemFitFor` was private to the adventure shop until the arena's stall
   * needed the same answer. It is the one thing a shop can tell you that the
   * row itself cannot — a breastplate bought for someone who cannot wear it is
   * a mistake you discover two screens later, at the point of equipping.
   */
  it('says a fighter can use plate and a wizard cannot', () => {
    const c = newCampaign(3);
    const fighter = c.characters.findIndex((ch) => ch.classId === 'fighter');
    const wizard = c.characters.findIndex((ch) => ch.classId === 'wizard');
    if (fighter < 0 || wizard < 0) return;   // comp without both; nothing to say
    expect(itemFitFor(c, fighter, 'plate')).toBe('fits');
    expect(itemFitFor(c, wizard, 'plate')).toBe('noequip');
  });

  it('separates "cannot hold it" from "holds it badly"', () => {
    // A wizard's greatsword is the case the middle value exists for: equippable
    // and useless, which reads very differently from unequippable.
    const c = newCampaign(3);
    const wizard = c.characters.findIndex((ch) => ch.classId === 'wizard');
    if (wizard < 0) return;
    expect(itemFitFor(c, wizard, 'greatsword')).toBe('noprof');
  });

  it('has nothing to say about a potion', () => {
    const c = newCampaign(3);
    expect(itemFitFor(c, 0, 'potion-healing')).toBeNull();
  });

  it('never mutates the party while answering', () => {
    // It probes on a shallow clone. Asking a question must not put the item in
    // anybody's pack, which is exactly what a careless implementation would do.
    const c = newCampaign(3);
    const before = c.characters.map((ch) => ch.inventory.map((s) => `${s.itemId}x${s.qty}`).join());
    itemFitFor(c, 0, 'plate');
    itemFitFor(c, 1, 'greatsword');
    expect(c.characters.map((ch) => ch.inventory.map((s) => `${s.itemId}x${s.qty}`).join())).toEqual(before);
  });
});
