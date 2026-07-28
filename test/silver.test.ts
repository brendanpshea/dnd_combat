/**
 * Silver, and the monsters that make you want it.
 *
 * TWO HOUSE RULES, BOTH DELIBERATE
 *
 * SRD 5.2.1 dropped silver entirely: the word appears in it zero times, and its
 * five lycanthrope stat blocks carry no damage immunity or resistance of any
 * kind — the 2014 "nonmagical attacks that aren't silvered" clause is gone.
 * `resistNonmagical` is this game's own field and always was.
 *
 * It is kept because fifteen monsters already use it — every elemental and most
 * of the undead — and they cluster at CR 4-5, so nothing below that ever asks a
 * martial character to solve a problem with equipment. A wererat at CR 2 is the
 * earliest the question can be posed, and silver is the answer players already
 * reach for.
 */
import { describe, it, expect } from 'vitest';
import { WEAPONS, SILVERED_WEAPONS, baseWeaponId } from '../src/data/weapons.js';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { isMagicWeapon, applyDamage } from '../src/engine/rules/attack.js';
import { SHOP_STOCK, MAGIC_SPOILS, isObtainable, isMagicalWare, itemPrice } from '../src/campaign/campaign.js';
import { spoilPool } from '../src/arena/spoils.js';

const LYCANTHROPES = ['wererat', 'werewolf', 'wereboar', 'weretiger', 'werebear'];

describe('the silvered weapons', () => {
  it('covers every melee weapon a player can buy', () => {
    const melee = Object.values(WEAPONS)
      .filter((w) => w.melee && w.cost !== undefined && !w.magic
        && !/-plus1$|^vicious-|^silvered-/.test(w.id))
      .map((w) => w.id);
    expect(melee.length, 'the base list has emptied out').toBeGreaterThan(10);
    for (const id of melee) expect(WEAPONS[`silvered-${id}`], id).toBeDefined();
  });

  it('adds nothing but the ability to hurt the thing', () => {
    // The point of silver is that it is NOT an upgrade. If it ever carries a
    // bonus it becomes the weapon you always want, and the interesting version
    // of the decision — carry a second weapon for one kind of enemy — is gone.
    for (const id of SILVERED_WEAPONS) {
      const w = WEAPONS[id]!;
      expect(w.attackBonus, id).toBeUndefined();
      expect(w.damageBonus, id).toBeUndefined();
      expect(isMagicWeapon(w), `${id} must get through nonmagical resistance`).toBe(true);
    }
  });

  it('keeps the base weapon it was made from', () => {
    for (const id of SILVERED_WEAPONS) {
      const base = WEAPONS[baseWeaponId(id)]!;
      expect(WEAPONS[id]!.damage, id).toBe(base.damage);
      expect(WEAPONS[id]!.damageType, id).toBe(base.damageType);
      expect(WEAPONS[id]!.properties, id).toEqual(base.properties);
      expect(itemPrice(id)!, id).toBeGreaterThan(itemPrice(base.id)!);
    }
  });

  it('is a staple on the shelf, not treasure', () => {
    // Silvering is a craft, so you can go and buy the answer to the wraith
    // behind door two. Treasure-only silver would arrive by luck instead,
    // which is the opposite of the decision it exists to offer.
    for (const id of SILVERED_WEAPONS) {
      expect(isObtainable(id), id).toBe(true);
      expect(SHOP_STOCK, id).toContain(id);
      expect(MAGIC_SPOILS, id).not.toContain(id);
      expect(isMagicalWare(id), `${id} is a coating, not an enchantment`).toBe(false);
    }
  });

  it('never turns up as a "consumable" award', () => {
    for (const level of [1, 3, 5]) {
      expect(spoilPool('consumable', level).filter((i) => i.startsWith('silvered-'))).toEqual([]);
    }
  });
});

describe('the lycanthropes', () => {
  it('are all here', () => {
    for (const id of LYCANTHROPES) expect(MONSTERS[id], id).toBeDefined();
  });

  it('shrug off ordinary steel, and only ordinary steel', () => {
    // The house rule, stated exactly: physical damage from a plain weapon is
    // halved, and everything else lands in full. A fireball hurts a werewolf
    // as much as it hurts anyone.
    for (const id of LYCANTHROPES) {
      const m = MONSTERS[id]!;
      expect(m.resistNonmagical, id).toEqual(['bludgeoning', 'piercing', 'slashing']);
      expect(m.resistances ?? [], `${id} must not resist elemental damage too`).toEqual([]);
      expect(m.immunities ?? [], id).toEqual([]);
    }
  });

  it('put the question below CR 4, which is the whole reason for them', () => {
    // Everything else carrying resistNonmagical is CR 4 or 5, so before this
    // there was no level at which a martial could be asked to buy an answer.
    const crs = LYCANTHROPES.map((id) => MONSTERS[id]!.cr ?? 99);
    expect(Math.min(...crs)).toBeLessThan(4);
  });

  it('can be built and fielded', () => {
    for (const id of LYCANTHROPES) {
      const m = buildMonster(id, 'team2', { x: 0, y: 0 });
      expect(m.hp, id).toBeGreaterThan(0);
      // The built combatant carries its weapons in the pack; the stat block is
      // where the ids live.
      const ids = MONSTERS[id]!.weaponIds ?? [];
      expect(ids.length, id).toBeGreaterThan(0);
      for (const w of ids) expect(WEAPONS[w], `${id} carries an unknown weapon ${w}`).toBeDefined();
    }
  });
});

describe('early martial kit', () => {
  it('reaches a fighter before level 4, which permanent magic does not', () => {
    const early = spoilPool('consumable', 1).filter((i) => i.includes('adamantine'));
    expect(early.length).toBeGreaterThan(0);
  });

  it('leaves full plate out of it', () => {
    // AC 18 at level 1 is a different conversation, and it is the one piece
    // here a party could not otherwise reach for years.
    expect(spoilPool('consumable', 1)).not.toContain('adamantine-plate');
    expect(spoilPool('consumable', 3)).not.toContain('adamantine-plate');
  });

  it('carries no bonus to hit or damage — it is defence, not an arms race', () => {
    for (const id of spoilPool('consumable', 1).filter((i) => i.includes('adamantine'))) {
      expect(WEAPONS[id], `${id} should be armour, not a weapon`).toBeUndefined();
    }
  });
});

describe('silver in an actual fight', () => {
  it('halves a plain blade and lands a silvered one in full', () => {
    // The claim the whole feature rests on, checked through applyDamage rather
    // than by reading the resistance table.
    const wolf = buildMonster('werewolf', 'team2', { x: 0, y: 0 }, 'w');
    const state = { combatants: { w: wolf } } as unknown as Parameters<typeof applyDamage>[0];

    const before = wolf.hp;
    applyDamage(state, 'w', 'w', 10, 'slashing', [], { magical: false });
    const plain = before - wolf.hp;

    wolf.hp = before;
    applyDamage(state, 'w', 'w', 10, 'slashing', [], { magical: true });
    const silvered = before - wolf.hp;

    expect(plain, 'a plain sword is halved').toBe(5);
    expect(silvered, 'silver lands in full').toBe(10);
  });

  it('does not protect it from fire', () => {
    const wolf = buildMonster('werewolf', 'team2', { x: 0, y: 0 }, 'w');
    const state = { combatants: { w: wolf } } as unknown as Parameters<typeof applyDamage>[0];
    const before = wolf.hp;
    applyDamage(state, 'w', 'w', 10, 'fire', [], { magical: false });
    expect(before - wolf.hp).toBe(10);
  });
});
