/**
 * Weapon data. Adding a weapon is an entry here — never an engine edit.
 */
import type { Id, DamageType, Ability, ConditionId } from '../engine/types.js';

export type WeaponProperty = 'finesse' | 'light' | 'thrown' | 'two-handed' | 'versatile';
export type MasteryId = 'sap' | 'vex' | 'slow' | 'push' | 'topple' | 'graze';

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
  /** Condition applied automatically on a hit (wolf bite → prone, snake constrict → restrained). */
  onHitCondition?: ConditionId;
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
  /**
   * Moon-touched/silvered: no attack or damage bonus, but its damage bypasses
   * resistance (were-creatures, certain elementals) — see the bypassResistance
   * option on applyDamage.
   */
  magic?: boolean;
}

export const WEAPONS: Record<Id, WeaponData> = {
  longsword: {
    id: 'longsword', name: 'Longsword', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 15,
  },
  javelin: {
    id: 'javelin', name: 'Javelin', damage: '1d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true, mastery: 'slow', cost: 1,
  },
  mace: {
    id: 'mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, mastery: 'sap', cost: 5,
  },
  quarterstaff: {
    id: 'quarterstaff', name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 1,
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
    properties: ['two-handed'], melee: true, mastery: 'graze', cost: 50,
  },
  longbow: {
    id: 'longbow', name: 'Longbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false, mastery: 'slow', cost: 50,
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

  // --- +1 weapons (rare tier, higher-level rewards) -------------------------
  'greatsword-plus1': {
    id: 'greatsword-plus1', name: 'Greatsword +1', damage: '2d6', damageType: 'slashing',
    properties: ['two-handed'], melee: true, mastery: 'graze', cost: 1000, attackBonus: 1, damageBonus: 1,
  },
  'longbow-plus1': {
    id: 'longbow-plus1', name: 'Longbow +1', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false, mastery: 'slow', cost: 1000, attackBonus: 1, damageBonus: 1,
  },
  'warhammer-plus1': {
    id: 'warhammer-plus1', name: 'Warhammer +1', damage: '1d8', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'push', cost: 800, attackBonus: 1, damageBonus: 1,
  },
  'rapier-plus1': {
    id: 'rapier-plus1', name: 'Rapier +1', damage: '1d8', damageType: 'piercing',
    properties: ['finesse'], melee: true, mastery: 'vex', cost: 800, attackBonus: 1, damageBonus: 1,
  },

  // --- greater weapon variety (mundane, tradable) ---------------------------
  handaxe: {
    id: 'handaxe', name: 'Handaxe', damage: '1d6', damageType: 'slashing',
    properties: ['light', 'thrown'], range: { normal: 20, long: 60 }, melee: true, mastery: 'vex', cost: 5,
  },
  spear: {
    id: 'spear', name: 'Spear', damage: '1d6', damageType: 'piercing',
    properties: ['thrown', 'versatile'], range: { normal: 20, long: 60 }, melee: true, mastery: 'sap', cost: 1,
  },
  rapier: {
    id: 'rapier', name: 'Rapier', damage: '1d8', damageType: 'piercing',
    properties: ['finesse'], melee: true, mastery: 'vex', cost: 25,
  },
  warhammer: {
    id: 'warhammer', name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'push', cost: 15,
  },
  battleaxe: {
    id: 'battleaxe', name: 'Battleaxe', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 10,
  },
  morningstar: {
    id: 'morningstar', name: 'Morningstar', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, mastery: 'sap', cost: 15,
  },

  // --- moon-touched (silvered) — no bonus, bypasses resistance -------------
  'moontouched-shortsword': {
    id: 'moontouched-shortsword', name: 'Moon-Touched Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, mastery: 'vex', cost: 150, magic: true,
  },
  'moontouched-warhammer': {
    id: 'moontouched-warhammer', name: 'Moon-Touched Warhammer', damage: '1d8', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'push', cost: 150, magic: true,
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
    properties: ['two-handed'], melee: true, mastery: 'push',
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
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false, mastery: 'slow',
  },
  'hand-crossbow': {
    id: 'hand-crossbow', name: 'Hand Crossbow', damage: '1d6', damageType: 'piercing',
    properties: ['light'], range: { normal: 30, long: 120 }, melee: false, mastery: 'slow', cost: 75,
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
  'minotaur-greataxe': {
    id: 'minotaur-greataxe', name: 'Greataxe', damage: '2d12', damageType: 'slashing',
    properties: ['two-handed'], melee: true,
  },
  'minotaur-gore': {
    id: 'minotaur-gore', name: 'Gore', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'ettin-battleaxe': {
    id: 'ettin-battleaxe', name: 'Battleaxe', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'ettin-morningstar': {
    id: 'ettin-morningstar', name: 'Morningstar', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'badger-claws': {
    id: 'badger-claws', name: 'Claws', damage: '2d4', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'toad-bite': {
    id: 'toad-bite', name: 'Bite', damage: '1d10', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '1d10', type: 'poison' },
  },
  'hyena-bite': {
    id: 'hyena-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'boar-tusk': {
    id: 'boar-tusk', name: 'Tusk', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true,
  },
  'snake-constrict': {
    id: 'snake-constrict', name: 'Constrict', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true,
    onHitCondition: 'restrained',
  },
  'gargoyle-bite': {
    id: 'gargoyle-bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'gargoyle-claws': {
    id: 'gargoyle-claws', name: 'Claws', damage: '1d6', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'fire-touch': {
    id: 'fire-touch', name: 'Touch', damage: '2d6', damageType: 'fire',
    properties: [], melee: true,
    extraDamage: { dice: '1d6', type: 'fire' },
  },
  'water-slam': {
    id: 'water-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'earth-slam': {
    id: 'earth-slam', name: 'Slam', damage: '2d10', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'air-slam': {
    id: 'air-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'sprite-shortbow': {
    id: 'sprite-shortbow', name: 'Shortbow', damage: '1d4', damageType: 'piercing',
    properties: [], range: { normal: 40, long: 160 }, melee: false,
    onHitCondition: 'poisoned',
  },
  'satyr-shortsword': {
    id: 'satyr-shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['light'], melee: true,
  },
  'satyr-ram': {
    id: 'satyr-ram', name: 'Ram', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'dryad-club': {
    id: 'dryad-club', name: 'Shillelagh Club', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'hag-claws': {
    id: 'hag-claws', name: 'Claws', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'unicorn-horn': {
    id: 'unicorn-horn', name: 'Horn', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '2d8', type: 'radiant' },
  },
  'unicorn-hooves': {
    id: 'unicorn-hooves', name: 'Hooves', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'cockatrice-bite': {
    id: 'cockatrice-bite', name: 'Bite', damage: '1d4', damageType: 'piercing',
    properties: [], melee: true,
    onHitCondition: 'restrained',
  },
  'harpy-claws': {
    id: 'harpy-claws', name: 'Claws', damage: '2d4', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'harpy-club': {
    id: 'harpy-club', name: 'Club', damage: '1d4', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'manticore-spike': {
    id: 'manticore-spike', name: 'Tail Spike', damage: '1d8', damageType: 'piercing',
    properties: [], range: { normal: 100, long: 200 }, melee: false,
  },
  'manticore-bite': {
    id: 'manticore-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'manticore-claws': {
    id: 'manticore-claws', name: 'Claws', damage: '1d6', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'owlbear-beak': {
    id: 'owlbear-beak', name: 'Beak', damage: '1d10', damageType: 'piercing',
    properties: [], melee: true,
  },
  'owlbear-claws': {
    id: 'owlbear-claws', name: 'Claws', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'gorgon-gore': {
    id: 'gorgon-gore', name: 'Gore', damage: '2d12', damageType: 'piercing',
    properties: [], melee: true,
  },
  'gorgon-hooves': {
    id: 'gorgon-hooves', name: 'Hooves', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
};
