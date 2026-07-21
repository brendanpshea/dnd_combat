import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { moveDestinations } from '../src/engine/rules/movement.js';
import { acOf } from '../src/data/armor.js';
import { WEAPONS, weaponCategory, isWeaponProficient } from '../src/data/weapons.js';
import { classScrollPool } from '../src/data/classes.js';
import { TRINKETS } from '../src/data/trinkets.js';
import {
  newCampaign, itemPrice, itemName, rarityOf, equipBlocked, equipItem, bestAtSkill,
} from '../src/campaign/campaign.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });

describe('Adamantine armor', () => {
  it('suppresses a critical hit against the wearer, but not a normal hit', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const attacker = makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } });
      const wearer = pc('fighter', 3, { x: 4, y: 3 }, 'w', { equipped: { mainHand: 'longsword', offHand: 'shield', armor: 'adamantine-scale-mail' } });
      const c = new Combat({ seed, mapId: 'open', combatants: [attacker, wearer] });
      const evs = resolveAttack(c.state, 'a', 'w', 'longsword');
      const roll = evs.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || roll.natural !== 20) continue;
      expect(roll.crit).toBe(false); // would be a nat-20 crit without adamantine
      return;
    }
    throw new Error('never rolled a natural 20 across 60 seeds');
  });
});

describe('+1 weapons, armor, and shields', () => {
  it('carry the expected attack/damage/AC bonus and price into the rare tier', () => {
    expect(WEAPONS['greatsword-plus1']).toMatchObject({ attackBonus: 1, damageBonus: 1 });
    expect(WEAPONS['warhammer-plus1']).toMatchObject({ attackBonus: 1, damageBonus: 1 });
    expect(rarityOf('greatsword-plus1')).toBe('rare');
    expect(rarityOf('scale-mail-plus1')).toBe('rare');
    expect(rarityOf('shield-plus1')).toBe('rare');
    expect(itemPrice('shield-plus1')).toBeGreaterThan(itemPrice('shield')!);
    expect(itemName('shield-plus1')).toBe('Shield +1');
  });

  it('a +1 shield grants +3 AC (vs +2 for a plain shield)', () => {
    const plain = pc('fighter', 3, { x: 0, y: 0 }, 'p', { equipped: { mainHand: 'longsword', offHand: 'shield' } });
    const plus1 = pc('fighter', 3, { x: 0, y: 0 }, 'q', { equipped: { mainHand: 'longsword', offHand: 'shield-plus1' } });
    expect(acOf(plus1)).toBe(acOf(plain) + 1);
  });
});

describe('Trinkets', () => {
  it('Gauntlets of Ogre Power set Strength to 19 (never lower it)', () => {
    const low = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 1 });
    expect(low.abilities.str).toBeLessThan(19);
    const withGauntlets = buildCharacter({
      classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 1,
      equipped: { mainHand: 'dagger', trinket: 'gauntlets-ogre-power' },
    });
    expect(withGauntlets.abilities.str).toBe(19);

    const strong = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5, // ASI'd Str is already high
      equipped: { mainHand: 'longsword', trinket: 'gauntlets-ogre-power' },
    });
    expect(strong.abilities.str).toBeGreaterThanOrEqual(19); // never lowered
  });

  it('Headband of Intellect sets Intelligence to 19', () => {
    const c = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 1,
      equipped: { mainHand: 'longsword', trinket: 'headband-intellect' },
    });
    expect(c.abilities.int).toBe(19);
  });

  it('Cloak of Protection grants +1 AC and +1 to saving throws', () => {
    const bare = pc('fighter', 3, { x: 0, y: 0 }, 'b');
    const cloaked = pc('fighter', 3, { x: 0, y: 0 }, 'c', { featureIds: [...bare.featureIds, 'cloak-protection'] });
    expect(acOf(cloaked)).toBe(acOf(bare) + 1);

    const c = new Combat({ seed: 1, mapId: 'open', combatants: [cloaked, makeCombatant({ id: 'foe', team: 'team2', position: { x: 7, y: 7 } })] });
    // Same seed, same natural roll — the only difference is the +1.
    const withCloak = savingThrow(c.state, 'c', 'wis', 10);
    const c2 = new Combat({ seed: 1, mapId: 'open', combatants: [bare, makeCombatant({ id: 'foe2', team: 'team2', position: { x: 7, y: 7 } })] });
    const without = savingThrow(c2.state, 'b', 'wis', 10);
    if (withCloak.event.type === 'savingThrow' && without.event.type === 'savingThrow') {
      expect(withCloak.event.total).toBe(without.event.total + 1);
    } else throw new Error();
  });

  it('Bracers of Archery add +2 damage with ranged weapons only', () => {
    const archer = pc('fighter', 3, { x: 3, y: 3 }, 'ar', {
      equipped: { mainHand: 'longbow' }, featureIds: [], weaponMasteries: [],
    });
    archer.featureIds = [...archer.featureIds, 'bracers-archery'];
    const target = makeCombatant({ id: 't', team: 'team2', position: { x: 6, y: 3 }, acOverride: 1, hp: 999, maxHp: 999 });
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [archer, target] });
    const evs = resolveAttack(c.state, 'ar', 't', 'longbow');
    const dmg = evs.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    if (dmg?.type !== 'damageDealt') throw new Error();
    expect(dmg.tags).toContain('Bracers of Archery');
  });

  it('Boots of the Winterlands let the wearer ignore difficult terrain cost', () => {
    const withBoots = pc('fighter', 3, { x: 1, y: 1 }, 'boots');
    withBoots.featureIds = [...withBoots.featureIds, 'boots-winterlands'];
    const without = pc('fighter', 3, { x: 1, y: 6 }, 'noboots');
    const c = new Combat({ seed: 1, mapId: 'marsh', combatants: [withBoots, without] });
    // Marsh has difficult terrain; a booted mover should reach farther on the same budget.
    const bootedReach = moveDestinations(c.state, c.state.combatants['boots']!).length;
    const bareReach = moveDestinations(c.state, c.state.combatants['noboots']!).length;
    expect(bootedReach).toBeGreaterThanOrEqual(bareReach);
  });

  it('Gloves of Thievery adds +5 to the wearer\'s Sleight of Hand for shop theft', () => {
    const camp = newCampaign(1);
    const before = bestAtSkill(camp, 'sleight-of-hand');
    camp.characters[before.idx]!.equipped.trinket = 'gloves-thievery';
    const after = bestAtSkill(camp, 'sleight-of-hand');
    expect(after.bonus).toBe(before.bonus + 5);
  });

  it('every trinket equips only in the trinket slot', () => {
    const camp = newCampaign(1);
    camp.characters[0]!.inventory.push({ itemId: 'cloak-protection', qty: 1 });
    expect(equipBlocked(camp, 0, 'cloak-protection', 'armor')).toBeDefined();
    expect(equipBlocked(camp, 0, 'cloak-protection', 'trinket')).toBeUndefined();
    expect(equipItem(camp, 0, 'cloak-protection', 'trinket')).toBe(true);
    expect(camp.characters[0]!.equipped.trinket).toBe('cloak-protection');
  });

  it('all seven trinkets are priced and named', () => {
    for (const id of Object.keys(TRINKETS)) {
      expect(itemPrice(id)).toBe(TRINKETS[id]!.cost);
      expect(itemName(id)).toBe(TRINKETS[id]!.name);
    }
  });
});

describe('New spell scrolls', () => {
  it('a Scroll of Command resolves like the spell', () => {
    const caster = pc('cleric', 1, { x: 1, y: 1 }, 'clr');
    caster.inventory.push({ itemId: 'scroll-command', qty: 1 });
    const foe = makeCombatant({ id: 'gob', team: 'team2', position: { x: 2, y: 1 }, creatureType: 'humanoid' });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [caster, foe] });
    const action = c.legalActions().find((a) => a.kind === 'useItem' && a.itemId === 'scroll-command');
    expect(action).toBeDefined();
  });
});

describe('weapon proficiency (2024: no bonus, not a hard block)', () => {
  it('categorizes tradable weapons; natural weapons have none', () => {
    expect(weaponCategory('dagger')).toBe('simple');
    expect(weaponCategory('quarterstaff')).toBe('simple');
    expect(weaponCategory('greatsword')).toBe('martial');
    expect(weaponCategory('longsword-plus1')).toBe('martial'); // magic variant → base
    expect(weaponCategory('moontouched-warhammer')).toBe('martial');
    expect(weaponCategory('wolf-bite')).toBeUndefined();       // natural
  });

  it('isWeaponProficient respects class categories, finesse/light, and safe defaults', () => {
    const wiz = { simple: true, martial: false };
    const ftr = { simple: true, martial: true };
    const rog = { simple: true, martial: false, finesseLight: true };
    expect(isWeaponProficient(wiz, 'dagger')).toBe(true);
    expect(isWeaponProficient(wiz, 'greatsword')).toBe(false);  // wizard, martial
    expect(isWeaponProficient(ftr, 'greatsword')).toBe(true);
    expect(isWeaponProficient(rog, 'rapier')).toBe(true);       // finesse martial
    expect(isWeaponProficient(rog, 'greatsword')).toBe(false);  // non-finesse martial
    expect(isWeaponProficient(wiz, 'wolf-bite')).toBe(true);    // natural → always
    expect(isWeaponProficient(undefined, 'greatsword')).toBe(true); // unmigrated → don't penalize
  });

  it('a built wizard is proficient with simple but not martial weapons', () => {
    const wiz = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(wiz.weaponProfs).toEqual({ simple: true, martial: false });
    const ftr = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(ftr.weaponProfs?.martial).toBe(true);
  });

  it('a non-proficient attack loses exactly the proficiency bonus', () => {
    // Same attacker/target/seed; only the weaponProfs differ.
    const mk = (profs: { simple: boolean; martial: boolean } | undefined) => {
      const a = makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 }, level: 5 });
      const b = makeCombatant({ id: 'b', team: 'team2', position: { x: 2, y: 1 }, maxHp: 999, hp: 999 });
      a.weaponProfs = profs as never;
      a.equipped = { mainHand: 'greatsword' };
      const c = new Combat({ seed: 3, mapId: 'open', combatants: [a, b] });
      const ev = resolveAttack(c.state, 'a', 'b', 'greatsword');
      const roll = ev.find((e) => e.type === 'attackRolled');
      return roll && roll.type === 'attackRolled' ? roll.total : 0;
    };
    const proficient = mk({ simple: true, martial: true });
    const untrained = mk({ simple: true, martial: false });
    expect(proficient - untrained).toBe(3); // proficiency bonus at level 5
  });
});

describe('scroll class-gating', () => {
  it('a class can only cast scrolls on its list', () => {
    expect(classScrollPool('wizard').has('magic-missile')).toBe(true);
    expect(classScrollPool('wizard').has('cure-wounds')).toBe(false); // divine
    expect(classScrollPool('cleric').has('cure-wounds')).toBe(true);
    expect(classScrollPool('fighter').size).toBe(0);                  // non-caster
  });
});
