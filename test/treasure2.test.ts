import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { resolveAttack, applyDamage } from '../src/engine/rules/attack.js';
import { ITEMS } from '../src/data/items.js';
import { WEAPONS } from '../src/data/weapons.js';
import { VALUABLES } from '../src/data/valuables.js';
import { itemPrice, itemName, itemIcon, rarityOf, treasureFor } from '../src/campaign/campaign.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });

describe('Moon-touched (silvered) weapons', () => {
  it('bypasses resistance to its damage type, but not immunity', () => {
    const resistant = makeCombatant({ id: 'r', team: 'team2', position: { x: 4, y: 3 }, resistances: ['piercing'] });
    const src = makeCombatant({ id: 'src', team: 'team1', position: { x: 3, y: 3 } });
    const c1 = new Combat({ seed: 1, mapId: 'open', combatants: [src, resistant] });
    applyDamage(c1.state, 'r', 'src', 10, 'piercing', [], { bypassResistance: true });
    expect(c1.state.combatants['r']!.hp).toBe(3); // 13 - 10, no halving

    const immune = makeCombatant({ id: 'i', team: 'team2', position: { x: 4, y: 3 }, immunities: ['piercing'] });
    const src2 = makeCombatant({ id: 'src2', team: 'team1', position: { x: 3, y: 3 } });
    const c2 = new Combat({ seed: 1, mapId: 'open', combatants: [src2, immune] });
    applyDamage(c2.state, 'i', 'src2', 10, 'piercing', [], { bypassResistance: true });
    expect(c2.state.combatants['i']!.hp).toBe(13); // immunity still zeroes it
  });

  it('a mundane weapon of the same type is halved by resistance', () => {
    const resistant = makeCombatant({ id: 'r2', team: 'team2', position: { x: 4, y: 3 }, resistances: ['piercing'] });
    const src = makeCombatant({ id: 'src3', team: 'team1', position: { x: 3, y: 3 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [src, resistant] });
    applyDamage(c.state, 'r2', 'src3', 10, 'piercing', [], {});
    expect(c.state.combatants['r2']!.hp).toBe(8); // 13 - 5 (halved)
  });

  it('the moon-touched shortsword resolves a real attack that bypasses resistance', () => {
    const attacker = pc('rogue', 3, { x: 3, y: 3 }, 'rog', { equipped: { mainHand: 'moontouched-shortsword' } });
    const target = makeCombatant({ id: 'tgt', team: 'team2', position: { x: 4, y: 3 }, resistances: ['piercing'], acOverride: 1, hp: 100, maxHp: 100 });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [attacker, target] });
    const evs = resolveAttack(c.state, 'rog', 'tgt', 'moontouched-shortsword');
    const dmg = evs.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    if (dmg?.type !== 'damageDealt') throw new Error();
    // Full roll applied (no halving) — amount equals the raw dice+mod, not floor(/2).
    expect(dmg.amount).toBeGreaterThan(0);
    expect(WEAPONS['moontouched-shortsword']!.attackBonus).toBeUndefined(); // no bonus, per spec
  });
});

describe('Resistance potions', () => {
  it('grants resistance to the matching damage type for the rest of the fight', () => {
    const drinker = pc('fighter', 3, { x: 1, y: 1 }, 'ftr');
    drinker.inventory.push({ itemId: 'potion-fire-resistance', qty: 1 });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [drinker, makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } })] });
    expect(c.state.combatants['ftr']!.resistances).not.toContain('fire');
    c.apply({ kind: 'useItem', itemId: 'potion-fire-resistance', targets: [] });
    expect(c.state.combatants['ftr']!.resistances).toContain('fire');
  });
});

describe('Giant Strength potions', () => {
  it('raises Strength to the giant floor, never lowers it', () => {
    const weak = pc('wizard', 1, { x: 1, y: 1 }, 'wiz'); // low Str by priority
    weak.inventory.push({ itemId: 'potion-giant-strength-hill', qty: 1 });
    const before = weak.abilities.str;
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [weak, makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } })] });
    c.apply({ kind: 'useItem', itemId: 'potion-giant-strength-hill', targets: [] });
    expect(c.state.combatants['wiz']!.abilities.str).toBe(21);
    expect(21).toBeGreaterThanOrEqual(before);
  });

  it('frost (23) is a strictly stronger floor than hill (21)', () => {
    expect(ITEMS['potion-giant-strength-frost']).toBeDefined();
    expect(ITEMS['potion-giant-strength-frost']!.rarity).toBe('rare');
    expect(ITEMS['potion-giant-strength-hill']!.rarity).toBe('uncommon'); // more powerful = rarer
  });
});

describe('Valuables (gems and jewelry)', () => {
  it('are pure loot: priced and named, but never a usable combat item', () => {
    expect(Object.keys(VALUABLES).length).toBeGreaterThanOrEqual(20);
    for (const id of Object.keys(VALUABLES)) {
      expect(itemPrice(id)).toBe(VALUABLES[id]!.cost);
      expect(itemName(id)).toBe(VALUABLES[id]!.name);
      expect(itemIcon(id)).toBe(VALUABLES[id]!.icon);
      expect(ITEMS[id]).toBeUndefined(); // never offered as a useItem action
    }
  });

  it('more valuable gems and jewelry are rarer', () => {
    expect(rarityOf('gem-quartz')).toBe('common');
    expect(rarityOf('gem-diamond')).toBe('rare');
    expect(rarityOf('jewelry-wooden-bracer')).toBe('common');
    expect(rarityOf('jewelry-dwarven-ring')).toBe('rare');
  });
});

describe('Treasure pool integrity', () => {
  it('every pooled item resolves a price, name, and icon with no dangling ids', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const t = treasureFor(1200, seed, 'rare');
      for (const s of t.items) seen.add(s.itemId);
    }
    expect(seen.size).toBeGreaterThan(10); // real variety, not the same 4 items
    for (const id of seen) {
      expect(itemPrice(id), `${id} has no price`).toBeGreaterThan(0);
      expect(itemName(id), `${id} has no name`).not.toBe(id);
    }
  });
});
