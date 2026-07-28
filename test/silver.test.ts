/**
 * Silver, and the monsters that make you want it.
 *
 * Silvering is an alchemical treatment of the metal, and the weapon it produces
 * is COMMON magic. It does two things and no third: it counts as magical, and
 * it deals extra damage to a creature that changes shape.
 *
 * The thing it deliberately does NOT do is gate. The 2014 lycanthropes could
 * not be hurt at all by an unsilvered blade, and SRD 5.2.1 dropped that clause
 * along with silver itself — its five lycanthrope blocks resist nothing. A
 * monster a party simply cannot damage is a wall rather than a fight, and at
 * CR 2, where a wererat is the first one you meet, that would be a wall you hit
 * before you could possibly have bought the key. So silver is a bonus: it
 * helps, and going without it costs damage rather than the whole fight.
 *
 * There is also no separate notion of silver anywhere in the rules code.
 * `magic: true` is what makes it magical, `bonusDiceVsShapechanger` is what
 * makes it silver, and neither needs a resistance axis of its own.
 */
import { describe, it, expect } from 'vitest';
import { WEAPONS, SILVERED_WEAPONS, baseWeaponId } from '../src/data/weapons.js';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { buildCharacter } from '../src/builder/character.js';
import { Combat } from '../src/engine/combat.js';
import { isMagicWeapon, applyDamage } from '../src/engine/rules/attack.js';
import { SHOP_STOCK, MAGIC_SPOILS, isObtainable, isMagicalWare, itemPrice, rarityOf } from '../src/campaign/campaign.js';
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

  it('carries no flat bonus — it is situational, not an upgrade', () => {
    // If silver ever carried +1 it would become the weapon you always want, and
    // the interesting version of the decision — carry a second one for a
    // specific enemy — would be gone.
    for (const id of SILVERED_WEAPONS) {
      const w = WEAPONS[id]!;
      expect(w.attackBonus, id).toBeUndefined();
      expect(w.damageBonus, id).toBeUndefined();
      expect(isMagicWeapon(w), `${id} counts as magical`).toBe(true);
      expect(w.bonusDiceVsShapechanger, id).toBe('1d6');
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

  it('is common magic, and is treasure', () => {
    // The moon-touched tier: magical, but the cheapest thing that can honestly
    // be called so. No bonus to hit, no bonus to damage, one effect.
    for (const id of SILVERED_WEAPONS) {
      expect(isObtainable(id), id).toBe(true);
      expect(isMagicalWare(id), id).toBe(true);
      expect(rarityOf(id), id).toBe('common');
      expect(MAGIC_SPOILS, id).toContain(id);
      expect(SHOP_STOCK, `${id} is won, not bought`).not.toContain(id);
    }
  });

  it('is not tracked separately from magic', () => {
    // `magic: true` is what makes it magical; there is no silver axis in the
    // resistance rules, and no monster carries a silver-specific field.
    for (const id of SILVERED_WEAPONS) expect(WEAPONS[id]!.magic, id).toBe(true);
    for (const m of Object.values(MONSTERS)) {
      expect(Object.keys(m), `${m.id} has a silver-specific field`).not.toContain('resistSilver');
    }
  });

  it('arrives early, because that is what it is for', () => {
    // Permanent magic is gated to level 4 by `spoilTierFor`, and rightly — a
    // Mace +1 at level 1 was the complaint that put the gate there. Silver is
    // the exception because it has no bonus to be early with.
    expect(spoilPool('consumable', 1).filter((i) => i.startsWith('silvered-')).length)
      .toBeGreaterThan(0);
  });
});

describe('the lycanthropes', () => {
  it('are all here', () => {
    for (const id of LYCANTHROPES) expect(MONSTERS[id], id).toBeDefined();
  });

  it('resist nothing at all, which is the 5.2.1 stat block', () => {
    // The 2014 versions were famous for the opposite. The 2024 revision dropped
    // "nonmagical attacks that aren't silvered" along with silver itself, and
    // an ordinary sword now hurts a werewolf exactly as much as a silvered one.
    for (const id of LYCANTHROPES) {
      const m = MONSTERS[id]!;
      expect(m.resistNonmagical, `${id} must not gate damage behind an item`).toBeUndefined();
      expect(m.resistances ?? [], id).toEqual([]);
      expect(m.immunities ?? [], id).toEqual([]);
    }
  });

  it('are what silver is for', () => {
    for (const id of LYCANTHROPES) expect(MONSTERS[id]!.shapechanger, id).toBe(true);
  });

  it('start below CR 4, so the reward has somewhere early to land', () => {
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

  it('carries no bonus to hit or damage — that is what makes it safe early', () => {
    // The Mace +1 at level 1 was wrong because of the +1. Everything in the
    // early pool has to be an answer to a problem rather than a general
    // upgrade, and this is the assertion that keeps it that way.
    for (const id of spoilPool('consumable', 1)) {
      const w = WEAPONS[id];
      if (!w) continue;
      expect(w.attackBonus, `${id} is in the early pool with a to-hit bonus`).toBeUndefined();
      expect(w.damageBonus, `${id} is in the early pool with a damage bonus`).toBeUndefined();
    }
  });
});

describe('silver in an actual fight', () => {
  /** Swing `weaponId` at `monsterId` until it connects; return the damage. */
  function hitFor(weaponId: string, monsterId: string): number {
    for (let seed = 1; seed <= 200; seed++) {
      const hero = buildCharacter({
        classId: 'fighter', team: 'team1', position: { x: 1, y: 1 },
        speciesId: 'human', name: 'H', level: 5,
      });
      hero.equipped = { ...hero.equipped, mainHand: weaponId };
      // `buildMonster`'s last argument is a suffix, not the id — take the id
      // the thing actually got rather than the one we asked for.
      const foe = { ...buildMonster(monsterId, 'team2', { x: 2, y: 1 }), hp: 500, maxHp: 500 };
      const c = new Combat({ seed, combatants: [hero, foe] });
      let guard = 0;
      while (c.activeId !== hero.id && guard++ < 40) c.apply({ kind: 'endTurn' });
      if (c.activeId !== hero.id) continue;
      const before = c.state.combatants[foe.id]!.hp;
      const events = c.apply({ kind: 'attack', weaponId, targetId: foe.id });
      const roll = events.find((e) => e.type === 'attackRolled');
      if (roll?.type === 'attackRolled' && roll.hit && !roll.crit) {
        return before - c.state.combatants[foe.id]!.hp;
      }
    }
    throw new Error(`never landed a clean ${weaponId} on ${monsterId}`);
  }

  it('hurts a shapechanger more than a plain blade does', () => {
    // Averaged over many landed hits, because both weapons roll 1d8 and only
    // the extra 1d6 separates them. Same base weapon, same level, same target.
    const sample = (weaponId: string) => {
      let total = 0;
      for (let i = 0; i < 12; i++) total += hitFor(weaponId, 'werewolf');
      return total / 12;
    };
    expect(sample('silvered-longsword')).toBeGreaterThan(sample('longsword'));
  });

  it('does nothing extra to something that does not change shape', () => {
    const plainOnOrc = hitFor('longsword', 'orc');
    const silverOnOrc = hitFor('silvered-longsword', 'orc');
    // Identical dice: 1d8 + Str either way, no rider, no resistance.
    expect(Math.abs(plainOnOrc - silverOnOrc)).toBeLessThanOrEqual(7);
    expect(MONSTERS['orc']!.shapechanger).toBeUndefined();
  });

  it('an ordinary sword still hurts a werewolf in full', () => {
    // The gate that is deliberately absent. If a lycanthrope ever regains
    // `resistNonmagical`, this is what says so.
    const wolf = buildMonster('werewolf', 'team2', { x: 0, y: 0 });
    const state = { combatants: { [wolf.id]: wolf } } as unknown as Parameters<typeof applyDamage>[0];
    const before = wolf.hp;
    applyDamage(state, wolf.id, wolf.id, 10, 'slashing', [], { magical: false });
    expect(before - wolf.hp).toBe(10);
  });
});
