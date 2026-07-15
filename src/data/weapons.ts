/**
 * Weapon data. Adding a weapon is an entry here — never an engine edit.
 */
import type { Id, DamageType, Ability, ConditionId } from '../engine/types.js';

export type WeaponProperty = 'finesse' | 'light' | 'thrown' | 'two-handed' | 'versatile';
export type MasteryId = 'sap' | 'vex';

export interface WeaponData {
  id: Id;
  name: string;
  damage: string; // dice expr, e.g. '1d8'
  damageType: DamageType;
  properties: WeaponProperty[];
  /** Present for ranged/thrown weapons; feet. Absent = melee only, reach 5. */
  range?: { normal: number; long: number };
  /** Thrown weapons and pure melee weapons can attack in melee. */
  melee: boolean;
  mastery?: MasteryId;
  /** Extra damage dice when the attack roll had advantage (goblin scimitar). */
  bonusDiceOnAdvantage?: string;
  /** Condition applied automatically on a hit (wolf bite → prone). */
  onHitCondition?: 'prone';
  /**
   * On a hit, the target makes a save or gains a save-ends condition
   * (ghoul claws → paralyzed, giant spider bite → poisoned).
   */
  onHitSave?: { condition: ConditionId; ability: Ability; dc: number };
  /** Extra damage of a second type on every hit (spider bite → poison). */
  extraDamage?: { dice: string; type: DamageType };
  /** Store price in gp; absent for natural/monster weapons (not tradable). */
  cost?: number;
  /** Magic weapon bonuses (+1 sword: both are 1). */
  attackBonus?: number;
  damageBonus?: number;
}

export const WEAPONS: Record<Id, WeaponData> = {
  longsword: {
    id: 'longsword', name: 'Longsword', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 15,
  },
  javelin: {
    id: 'javelin', name: 'Javelin', damage: '1d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true, cost: 1,
  },
  mace: {
    id: 'mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, cost: 5,
  },
  quarterstaff: {
    id: 'quarterstaff', name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, cost: 1,
  },
  shortsword: {
    id: 'shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, mastery: 'vex', cost: 10,
  },
  shortbow: {
    id: 'shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false, mastery: 'vex', cost: 25,
  },
  dagger: {
    id: 'dagger', name: 'Dagger', damage: '1d4', damageType: 'piercing',
    properties: ['finesse', 'light', 'thrown'], range: { normal: 20, long: 60 }, melee: true, cost: 2,
  },
  greatsword: {
    id: 'greatsword', name: 'Greatsword', damage: '2d6', damageType: 'slashing',
    properties: ['two-handed'], melee: true, cost: 50,
  },
  longbow: {
    id: 'longbow', name: 'Longbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false, cost: 50,
  },
  'longsword-plus1': {
    id: 'longsword-plus1', name: 'Longsword +1', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 500,
    attackBonus: 1, damageBonus: 1,
  },
  'shortsword-plus1': {
    id: 'shortsword-plus1', name: 'Shortsword +1', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, mastery: 'vex', cost: 500,
    attackBonus: 1, damageBonus: 1,
  },

  // --- monster natural weapons and gear (SRD 5.2.1 stat blocks) ------------
  'goblin-scimitar': {
    id: 'goblin-scimitar', name: 'Scimitar', damage: '1d6', damageType: 'slashing',
    properties: ['finesse', 'light'], melee: true, bonusDiceOnAdvantage: '1d4',
  },
  'goblin-shortbow': {
    id: 'goblin-shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false,
    bonusDiceOnAdvantage: '1d4',
  },
  bite: {
    id: 'bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: ['finesse'], melee: true, onHitCondition: 'prone',
  },
  greatclub: {
    id: 'greatclub', name: 'Greatclub', damage: '2d8', damageType: 'bludgeoning',
    properties: ['two-handed'], melee: true,
  },
  'ogre-javelin': {
    id: 'ogre-javelin', name: 'Javelin', damage: '2d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true,
  },
  slam: {
    id: 'slam', name: 'Slam', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  scimitar: {
    id: 'scimitar', name: 'Scimitar', damage: '1d6', damageType: 'slashing',
    properties: ['finesse', 'light'], melee: true,
  },
  'light-crossbow': {
    id: 'light-crossbow', name: 'Light Crossbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false,
  },
  'dire-wolf-bite': {
    id: 'dire-wolf-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: ['finesse'], melee: true, onHitCondition: 'prone',
  },
  'ghoul-bite': {
    id: 'ghoul-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'ghoul-claws': {
    id: 'ghoul-claws', name: 'Claws', damage: '2d4', damageType: 'slashing',
    properties: ['finesse'], melee: true,
    onHitSave: { condition: 'paralyzed', ability: 'con', dc: 10 },
  },
  'spider-bite': {
    id: 'spider-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: ['finesse'], melee: true,
    extraDamage: { dice: '1d6', type: 'poison' },
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 11 },
  },
  sling: {
    id: 'sling', name: 'Sling', damage: '1d4', damageType: 'bludgeoning',
    properties: [], range: { normal: 30, long: 120 }, melee: false,
  },
  greataxe: {
    id: 'greataxe', name: 'Greataxe', damage: '1d12', damageType: 'slashing',
    properties: ['two-handed'], melee: true, cost: 30,
  },
  'bear-bite': {
    id: 'bear-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'bear-claws': {
    id: 'bear-claws', name: 'Claws', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true,
  },
};
