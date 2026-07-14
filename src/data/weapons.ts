/**
 * Weapon data. Adding a weapon is an entry here — never an engine edit.
 */
import type { Id, DamageType } from '../engine/types.js';

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
  /** Condition applied to the target on a hit (wolf bite → prone). */
  onHitCondition?: 'prone';
}

export const WEAPONS: Record<Id, WeaponData> = {
  longsword: {
    id: 'longsword', name: 'Longsword', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap',
  },
  javelin: {
    id: 'javelin', name: 'Javelin', damage: '1d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true,
  },
  mace: {
    id: 'mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  quarterstaff: {
    id: 'quarterstaff', name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true,
  },
  shortsword: {
    id: 'shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, mastery: 'vex',
  },
  shortbow: {
    id: 'shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false, mastery: 'vex',
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
};
