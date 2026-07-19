import type { Id, Combatant } from '../engine/types.js';
import { abilityMod } from '../engine/types.js';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type ArmorCategory = 'light' | 'medium' | 'heavy';

export interface ArmorData {
  id: Id;
  name: string;
  base: number;
  /** How much Dex applies: 'full' (light/none), capped (medium), 'none' (heavy). */
  dexCap: 'full' | 'none' | number;
  category: ArmorCategory;
  metal: boolean; // Shocking Grasp gets advantage vs metal armor
  cost: number;   // gp
  rarity: Rarity;
  /** Adamantine: any critical hit against the wearer becomes a normal hit. */
  noCrit?: boolean;
}

export const ARMOR: Record<Id, ArmorData> = {
  leather:           { id: 'leather',           name: 'Leather',          base: 11, dexCap: 'full', category: 'light',  metal: false, cost: 10,  rarity: 'common' },
  'studded-leather': { id: 'studded-leather',  name: 'Studded Leather',  base: 12, dexCap: 'full', category: 'light',  metal: false, cost: 45,  rarity: 'common' },
  'chain-shirt':     { id: 'chain-shirt',      name: 'Chain Shirt',      base: 13, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common' },
  'scale-mail':      { id: 'scale-mail',       name: 'Scale Mail',       base: 14, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common' },
  'half-plate':      { id: 'half-plate',       name: 'Half Plate',       base: 15, dexCap: 2,      category: 'medium', metal: true,  cost: 400, rarity: 'uncommon' },
  'chain-mail':      { id: 'chain-mail',       name: 'Chain Mail',       base: 16, dexCap: 'none', category: 'heavy',  metal: true,  cost: 75,  rarity: 'common' },
  splint:            { id: 'splint',           name: 'Splint',           base: 17, dexCap: 'none', category: 'heavy',  metal: true,  cost: 200, rarity: 'uncommon' },

  // Adamantine: same protection, but you can't be critically hit. Metal only.
  'adamantine-scale-mail': { id: 'adamantine-scale-mail', name: 'Adamantine Scale Mail', base: 14, dexCap: 2,      category: 'medium', metal: true, cost: 550,  rarity: 'uncommon', noCrit: true },
  'adamantine-half-plate': { id: 'adamantine-half-plate', name: 'Adamantine Half Plate', base: 15, dexCap: 2,      category: 'medium', metal: true, cost: 900,  rarity: 'uncommon', noCrit: true },
  'adamantine-chain-mail': { id: 'adamantine-chain-mail', name: 'Adamantine Chain Mail', base: 16, dexCap: 'none', category: 'heavy',  metal: true, cost: 575,  rarity: 'uncommon', noCrit: true },
  'adamantine-splint':     { id: 'adamantine-splint',     name: 'Adamantine Splint',     base: 17, dexCap: 'none', category: 'heavy',  metal: true, cost: 700,  rarity: 'uncommon', noCrit: true },

  // +1 armor: +1 AC baked into the base. Rare tier, higher-level reward.
  'scale-mail-plus1': { id: 'scale-mail-plus1', name: 'Scale Mail +1', base: 15, dexCap: 2,      category: 'medium', metal: true, cost: 1000, rarity: 'rare' },
  'half-plate-plus1': { id: 'half-plate-plus1', name: 'Half Plate +1', base: 16, dexCap: 2,      category: 'medium', metal: true, cost: 1400, rarity: 'rare' },
  'splint-plus1':     { id: 'splint-plus1',     name: 'Splint +1',     base: 18, dexCap: 'none', category: 'heavy',  metal: true, cost: 1200, rarity: 'rare' },
};

export const SHIELD_COST = 10;
export const SHIELD_PLUS1_COST = 500;

/** Is an off-hand entry a shield (plain or magic)? */
export function isShield(offHand: Id | undefined): boolean {
  return offHand === 'shield' || offHand === 'shield-plus1';
}

/** The AC an off-hand shield contributes (0 if none). */
export function shieldBonus(offHand: Id | undefined): number {
  return offHand === 'shield-plus1' ? 3 : offHand === 'shield' ? 2 : 0;
}

export function armorClass(armorId: Id | undefined, dexMod: number, shieldAc: number): number {
  const a = armorId !== undefined ? ARMOR[armorId] : undefined;
  const base = a?.base ?? 10;
  const cap = a?.dexCap ?? 'full';
  const dex = cap === 'full' ? dexMod : cap === 'none' ? 0 : Math.min(dexMod, cap);
  return base + dex + shieldAc;
}

/** A combatant's current AC: stat-block override (monsters) or derived from equipment. */
export function acOf(c: Combatant): number {
  if (c.acOverride !== undefined) return c.acOverride;
  const shield = shieldBonus(c.equipped.offHand);
  if (c.mageArmor && c.equipped.armor === undefined) {
    return 13 + abilityMod(c.abilities.dex) + shield + trinketAc(c) + shieldedAc(c) + wardedAc(c) + hastedAc(c);
  }
  const base = armorClass(c.equipped.armor, abilityMod(c.abilities.dex), shield);
  // Fighting Style: Defense — +1 AC while wearing any armor.
  const defense = c.equipped.armor !== undefined && c.featureIds.includes('defense') ? 1 : 0;
  return base + defense + trinketAc(c) + shieldedAc(c) + wardedAc(c) + hastedAc(c);
}

/** Cloak of Protection (trinket): +1 AC, granted as a feature the builder folds. */
function trinketAc(c: Combatant): number {
  return c.featureIds.includes('cloak-protection') ? 1 : 0;
}

/** Shield spell reaction: +5 AC until the caster's next turn. */
function shieldedAc(c: Combatant): number {
  return c.conditions.some((k) => k.id === 'shielded') ? 5 : 0;
}

/** Shield of Faith: +2 AC, held by concentration. */
function wardedAc(c: Combatant): number {
  return c.conditions.some((k) => k.id === 'warded') ? 2 : 0;
}

/** Haste: +2 AC (on top of the speed/extra-attack pieces read elsewhere). */
function hastedAc(c: Combatant): number {
  return c.conditions.some((k) => k.id === 'hasted') ? 2 : 0;
}

/** Is the combatant wearing metal armor (Shocking Grasp rider)? */
export function wearsMetal(c: Combatant): boolean {
  return c.equipped.armor !== undefined && (ARMOR[c.equipped.armor]?.metal ?? false);
}
