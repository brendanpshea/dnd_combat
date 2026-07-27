import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { acOf } from '../src/data/armor.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { resolveAttack, collectAttackSources, applyDamage } from '../src/engine/rules/attack.js';
import { WEAPONS } from '../src/data/weapons.js';
import { TRINKETS, trinketSlot, RARE_WONDROUS } from '../src/data/trinkets.js';
import {
  newCampaign, rarityOf, equipBlocked, isObtainable, EQUIP_SLOTS, itemPrice,
} from '../src/campaign/campaign.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });

/**
 * The rare wondrous items, and the ring slot they arrived with.
 *
 * The trinket slot held seven uncommon items and nothing above them, so from
 * level 5 there was nothing left to want in it. What these four have in common
 * is that each is *conditional* on something — no armour, not yet hit, a spell
 * rather than an axe — which is what keeps them from being a flat bonus the
 * whole party wears without thinking.
 */

describe('Amulet of Health and the Belt of Hill Giant Strength', () => {
  it('set a floor and never lower a score that is already higher', () => {
    const bare = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    const amulet = buildCharacter({
      classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      equipped: { mainHand: 'dagger', trinket: 'amulet-health' },
    });
    expect(bare.abilities.con).toBeLessThan(19);
    expect(amulet.abilities.con).toBe(19);
    // Constitution is rolled into hit points at every level, so the amulet has
    // to move maxHp too — a Con floor that didn't would be cosmetic.
    expect(amulet.maxHp).toBeGreaterThan(bare.maxHp);

    const belted = buildCharacter({
      classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      equipped: { mainHand: 'dagger', trinket: 'belt-giant-strength-hill' },
    });
    expect(belted.abilities.str).toBe(21);
    const strong = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 7,
      equipped: { mainHand: 'longsword', trinket: 'belt-giant-strength-hill' },
    });
    expect(strong.abilities.str, 'never lowered').toBeGreaterThanOrEqual(21);
  });
});

describe('Bracers of Defense', () => {
  it('give +2 AC to someone wearing no armour and no shield', () => {
    const bare = pc('wizard', 5, { x: 0, y: 0 }, 'a', { equipped: { mainHand: 'dagger' } });
    const braced = pc('wizard', 5, { x: 0, y: 0 }, 'b', {
      equipped: { mainHand: 'dagger' }, featureIds: ['bracers-defense'],
    });
    expect(acOf(braced)).toBe(acOf(bare) + 2);
  });

  it('do nothing for anyone in armour or behind a shield', () => {
    // The condition is the item. Without it this is a flat +2 the whole party
    // would wear, and the fighter would want it most.
    const armored = pc('fighter', 5, { x: 0, y: 0 }, 'c', { equipped: { mainHand: 'longsword', armor: 'splint' } });
    const armoredBraced = pc('fighter', 5, { x: 0, y: 0 }, 'd', {
      equipped: { mainHand: 'longsword', armor: 'splint' }, featureIds: ['bracers-defense'],
    });
    expect(acOf(armoredBraced)).toBe(acOf(armored));

    const shielded = pc('wizard', 5, { x: 0, y: 0 }, 'e', { equipped: { mainHand: 'dagger', offHand: 'shield' } });
    const shieldedBraced = pc('wizard', 5, { x: 0, y: 0 }, 'f', {
      equipped: { mainHand: 'dagger', offHand: 'shield' }, featureIds: ['bracers-defense'],
    });
    expect(acOf(shieldedBraced)).toBe(acOf(shielded));
  });
});

describe('Mantle of Spell Resistance', () => {
  /**
   * The savingThrow event carries no roll mode, so this measures the effect
   * rather than reading a flag: advantage on a d20 has a mean of about 13.8
   * against a flat 10.5, which 200 rolls separates comfortably.
   */
  function meanNatural(featureIds: string[], magical: boolean): number {
    let total = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const wearer = pc('fighter', 5, { x: 0, y: 0 }, 'w', { featureIds });
      const foe = makeCombatant({ id: 'foe', team: 'team2', position: { x: 5, y: 5 } });
      const c = new Combat({ seed, mapId: 'open', combatants: [wearer, foe] });
      const r = savingThrow(c.state, 'w', 'wis', 12, magical ? { magical: true } : {});
      if (r.event.type !== 'savingThrow') throw new Error();
      total += r.event.natural;
    }
    return total / N;
  }

  it('gives advantage on a save against a spell', () => {
    const withMantle = meanNatural(['mantle-spell-resistance'], true);
    const without = meanNatural([], true);
    expect(without, `flat mean ${without}`).toBeLessThan(12);
    expect(withMantle, `mantle mean ${withMantle} vs flat ${without}`).toBeGreaterThan(12.5);
  });

  it('does nothing against an axe', () => {
    // The condition is the item: a mantle that helped against everything would
    // be a flat +save bonus, which the Cloak of Protection already is.
    const withMantle = meanNatural(['mantle-spell-resistance'], false);
    const without = meanNatural([], false);
    expect(Math.abs(withMantle - without), `${withMantle} vs ${without}`).toBeLessThan(0.001);
  });
});

describe('Cloak of Displacement', () => {
  const wearerAndFoe = () => {
    const wearer = pc('rogue', 5, { x: 1, y: 1 }, 'w', { featureIds: ['cloak-displacement'] });
    const foe = makeCombatant({ id: 'foe', team: 'team2', position: { x: 2, y: 1 } });
    return { wearer, foe, c: new Combat({ seed: 5, mapId: 'open', combatants: [wearer, foe] }) };
  };

  it('gives attackers disadvantage while it is up', () => {
    const { c } = wearerAndFoe();
    const src = collectAttackSources(
      c.state, c.state.combatants['foe']!, c.state.combatants['w']!, WEAPONS['longsword']!, true);
    expect(src.dis).toContain('displacement');
  });

  it('goes down the moment something lands, and comes back on the wearer\'s turn', () => {
    const { c } = wearerAndFoe();
    applyDamage(c.state, 'w', 'foe', 3, 'slashing');
    expect(c.state.combatants['w']!.displacementBroken).toBe(true);
    const after = collectAttackSources(
      c.state, c.state.combatants['foe']!, c.state.combatants['w']!, WEAPONS['longsword']!, true);
    expect(after.dis, 'the illusion is down').not.toContain('displacement');

    // Round the initiative order until the wearer's turn starts again.
    for (let i = 0; i < 12 && c.state.combatants['w']!.displacementBroken; i++) c.apply({ kind: 'endTurn' });
    expect(c.state.combatants['w']!.displacementBroken, 'settles at the start of its turn').toBe(false);
  });

  it('breaks on a hit soaked entirely by temporary hit points', () => {
    // The SRD's trigger is *taking damage*, not losing hit points. Reading it
    // the other way would make a cleric's temp HP quietly protect the cloak.
    const { c } = wearerAndFoe();
    c.state.combatants['w']!.tempHp = 50;
    applyDamage(c.state, 'w', 'foe', 4, 'slashing');
    expect(c.state.combatants['w']!.hp).toBe(c.state.combatants['w']!.maxHp);
    expect(c.state.combatants['w']!.displacementBroken).toBe(true);
  });

  it('is suppressed at Speed 0 — an illusion of stepping aside needs a step', () => {
    const { c } = wearerAndFoe();
    c.state.combatants['w']!.speed = 0;
    const src = collectAttackSources(
      c.state, c.state.combatants['foe']!, c.state.combatants['w']!, WEAPONS['longsword']!, true);
    expect(src.dis).not.toContain('displacement');
  });

  it('actually reaches a real attack roll, not just the source list', () => {
    const { c } = wearerAndFoe();
    const evs = resolveAttack(c.state, 'foe', 'w', 'longsword');
    const roll = evs.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error('no attack');
    expect(roll.disSources).toContain('displacement');
    expect(roll.mode).toBe('disadvantage');
  });
});

describe('rings', () => {
  it('grant resistance to the type they name', () => {
    const c = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      equipped: { mainHand: 'longsword', ring: 'ring-resistance-fire' },
    });
    expect(c.resistances).toContain('fire');
    expect(c.resistances).not.toContain('cold');
  });

  it('cover every damage type a ring should, one item each', () => {
    // The SRD writes this as one item whose gemstone picks the type. Split so
    // that a player can *choose* which resistance to buy against the wave they
    // can see — an item whose key property is rolled at drop time is not a
    // decision.
    const rings = Object.values(TRINKETS).filter((t) => t.id.startsWith('ring-resistance-'));
    expect(rings.length).toBeGreaterThanOrEqual(10);
    for (const r of rings) {
      expect(trinketSlot(r), `${r.id} is not a ring`).toBe('ring');
      expect(r.grants.resistances?.length, `${r.id} grants nothing`).toBe(1);
    }
  });

  it('are worn alongside a trinket, not instead of one', () => {
    // The whole reason the ring slot exists. In one slot these would compete,
    // and the choice would be an artefact of the implementation.
    const both = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5,
      equipped: { mainHand: 'longsword', trinket: 'cloak-protection', ring: 'ring-resistance-fire' },
    });
    expect(both.featureIds).toContain('cloak-protection');
    expect(both.resistances).toContain('fire');
  });

  it('cannot be worn in the wrong slot', () => {
    const camp = newCampaign(1);
    // equipBlocked also checks possession, so put both in the pack first.
    camp.characters[0]!.inventory.push({ itemId: 'ring-resistance-fire', qty: 1 });
    camp.characters[0]!.inventory.push({ itemId: 'cloak-protection', qty: 1 });
    expect(equipBlocked(camp, 0, 'ring-resistance-fire', 'trinket')).toBeTruthy();
    expect(equipBlocked(camp, 0, 'cloak-protection', 'ring')).toBeTruthy();
    expect(equipBlocked(camp, 0, 'ring-resistance-fire', 'ring')).toBeUndefined();
    expect(equipBlocked(camp, 0, 'cloak-protection', 'trinket')).toBeUndefined();
  });
});

describe('the new items reach a player', () => {
  it('every rare wondrous item drops and can be obtained', () => {
    // A trinket that exists but never appears is dead data with a data file.
    for (const id of RARE_WONDROUS) {
      expect(rarityOf(id), id).toBe('rare');
      expect(isObtainable(id), `${id} cannot be obtained by any route`).toBe(true);
      expect(itemPrice(id), `${id} has no price`).toBeGreaterThan(0);
    }
    expect(RARE_WONDROUS.length).toBeGreaterThanOrEqual(15);
  });

  it('RARE_WONDROUS is derived, so a new trinket cannot be forgotten', () => {
    const declared = Object.values(TRINKETS).filter((t) => t.rarity === 'rare').map((t) => t.id).sort();
    expect(RARE_WONDROUS).toEqual(declared);
  });

  it('has a slot for every kind of thing it can equip', () => {
    for (const t of Object.values(TRINKETS)) {
      expect(EQUIP_SLOTS, `${t.id} wants a slot that does not exist`).toContain(trinketSlot(t));
    }
  });
});
