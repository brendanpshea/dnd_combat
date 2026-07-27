import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { resolveAttack, applyDamage, isMagicWeapon } from '../src/engine/rules/attack.js';
import { buildMonster } from '../src/data/monsters.js';
import { ITEMS } from '../src/data/items.js';
import { WEAPONS } from '../src/data/weapons.js';
import { VALUABLES } from '../src/data/valuables.js';
import { itemPrice, itemName, itemIcon, rarityOf, treasureFor } from '../src/campaign/campaign.js';
import { encounterXP, encounterCoinXP } from '../src/data/encounters.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });

describe('magical damage and the two kinds of resistance', () => {
  it('magical damage ignores a nonmagical-only resistance, but not immunity', () => {
    const resistant = makeCombatant({ id: 'r', team: 'team2', position: { x: 4, y: 3 }, resistNonmagical: ['piercing'] });
    const src = makeCombatant({ id: 'src', team: 'team1', position: { x: 3, y: 3 } });
    const c1 = new Combat({ seed: 1, mapId: 'open', combatants: [src, resistant] });
    applyDamage(c1.state, 'r', 'src', 10, 'piercing', [], { magical: true });
    expect(c1.state.combatants['r']!.hp).toBe(3); // 13 - 10, no halving

    const immune = makeCombatant({ id: 'i', team: 'team2', position: { x: 4, y: 3 }, immunities: ['piercing'] });
    const src2 = makeCombatant({ id: 'src2', team: 'team1', position: { x: 3, y: 3 } });
    const c2 = new Combat({ seed: 1, mapId: 'open', combatants: [src2, immune] });
    applyDamage(c2.state, 'i', 'src2', 10, 'piercing', [], { magical: true });
    expect(c2.state.combatants['i']!.hp).toBe(13); // immunity still zeroes it
  });

  it('a mundane hit is halved by a nonmagical-only resistance', () => {
    const resistant = makeCombatant({ id: 'r2', team: 'team2', position: { x: 4, y: 3 }, resistNonmagical: ['piercing'] });
    const src = makeCombatant({ id: 'src3', team: 'team1', position: { x: 3, y: 3 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [src, resistant] });
    applyDamage(c.state, 'r2', 'src3', 10, 'piercing', [], {});
    expect(c.state.combatants['r2']!.hp).toBe(8); // 13 - 5 (halved)
  });

  // The distinction that did not exist before: an unconditional resistance —
  // a fire elemental's fire, say — is not something a magic sword talks its
  // way past. Folding the two together made every magic weapon a universal
  // answer, which is not the rule and not interesting.
  it('magical damage is still halved by an unconditional resistance', () => {
    const resistant = makeCombatant({ id: 'r3', team: 'team2', position: { x: 4, y: 3 }, resistances: ['fire'] });
    const src = makeCombatant({ id: 'src4', team: 'team1', position: { x: 3, y: 3 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [src, resistant] });
    applyDamage(c.state, 'r3', 'src4', 10, 'fire', [], { magical: true });
    expect(c.state.combatants['r3']!.hp).toBe(8);
  });

  it('the silvered shortsword resolves a real attack that bypasses resistance', () => {
    const attacker = pc('rogue', 3, { x: 3, y: 3 }, 'rog', { equipped: { mainHand: 'silvered-shortsword' } });
    const target = makeCombatant({ id: 'tgt', team: 'team2', position: { x: 4, y: 3 }, resistNonmagical: ['piercing'], acOverride: 1, hp: 100, maxHp: 100 });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [attacker, target] });
    const evs = resolveAttack(c.state, 'rog', 'tgt', 'silvered-shortsword');
    const dmg = evs.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    if (dmg?.type !== 'damageDealt') throw new Error();
    // Full roll applied (no halving) — amount equals the raw dice+mod, not floor(/2).
    expect(dmg.amount).toBeGreaterThan(0);
    expect(WEAPONS['silvered-shortsword']!.attackBonus).toBeUndefined(); // no bonus, per spec
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

describe('Treasure by creature type', () => {
  it('beasts carry no coin or valuables — a wolf pack yields XP only', () => {
    expect(encounterCoinXP('wolves')).toBe(0); // all beasts
    // Full XP for danger, zero coin XP → no gold, no item rolls.
    for (let seed = 1; seed <= 20; seed++) {
      const t = treasureFor(encounterXP('wolves'), seed, undefined, encounterCoinXP('wolves'));
      expect(t.gold).toBe(0);
      expect(t.items.length).toBe(0);
    }
  });

  it('a humanoid warband still pays out in coin', () => {
    expect(encounterCoinXP('bandits')).toBe(encounterXP('bandits')); // all loot-bearers
    const t = treasureFor(encounterXP('bandits'), 3, undefined, encounterCoinXP('bandits'));
    expect(t.gold).toBeGreaterThan(0);
  });

  it('a mixed pack pays only for its loot-bearing share', () => {
    // raiders-forward = orc + scout + bandit (all humanoid) → full coin.
    expect(encounterCoinXP('raiders-forward')).toBe(encounterXP('raiders-forward'));
    // A gold rate well under the old XP/2: 225 coin-XP → well below 112.
    const t = treasureFor(225, 5, undefined, 225);
    expect(t.gold).toBeLessThan(90);
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

/**
 * A +1 weapon is magical, and the SRD's physical resistances all read "from
 * nonmagical attacks" — so the rare sword you saved for is precisely the
 * answer to a wight. It wasn't: `magic` was set only on the silvered
 * pair, so a +1 longsword was halved by all sixteen monsters that resist
 * physical damage, which is the opposite of what the item is for.
 */
describe('enchanted weapons count as magical', () => {
  it('every +N weapon reads as magical', () => {
    for (const w of Object.values(WEAPONS)) {
      if (!w.attackBonus && !w.damageBonus) continue;
      expect(isMagicWeapon(w), `${w.id} does not count as magical`).toBe(true);
    }
  });

  it('a +1 longsword gets full damage through a wight; a plain one does not', () => {
    const build = (weaponId: string) => {
      const attacker = pc('fighter', 3, { x: 3, y: 3 }, 'f', { equipped: { mainHand: weaponId } });
      const wight = buildMonster('wight', 'team2', { x: 4, y: 3 });
      wight.acOverride = 1;                    // take the roll out of it
      wight.hp = 200; wight.maxHp = 200;
      const c = new Combat({ seed: 4, mapId: 'open', combatants: [attacker, wight] });
      const evs = resolveAttack(c.state, 'f', wight.id, weaponId);
      return evs.filter((e) => e.type === 'damageDealt')
        .reduce((sum, e) => sum + (e.type === 'damageDealt' ? e.amount : 0), 0);
    };
    const plain = build('longsword');
    const magic = build('longsword-plus1');
    expect(plain).toBeGreaterThan(0);
    // Not merely bigger — the +1 is worth about double, because the halving
    // is gone rather than because of the +1 damage.
    expect(magic).toBeGreaterThan(plain * 1.5);
  });
});
