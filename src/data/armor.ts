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
}

export const ARMOR: Record<Id, ArmorData> = {
  leather:           { id: 'leather',           name: 'Leather',          base: 11, dexCap: 'full', category: 'light',  metal: false, cost: 10,  rarity: 'common' },
  'studded-leather': { id: 'studded-leather',  name: 'Studded Leather',  base: 12, dexCap: 'full', category: 'light',  metal: false, cost: 45,  rarity: 'common' },
  'chain-shirt':     { id: 'chain-shirt',      name: 'Chain Shirt',      base: 13, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common' },
  'scale-mail':      { id: 'scale-mail',       name: 'Scale Mail',       base: 14, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common' },
  'half-plate':      { id: 'half-plate',       name: 'Half Plate',       base: 15, dexCap: 2,      category: 'medium', metal: true,  cost: 400, rarity: 'uncommon' },
  'chain-mail':      { id: 'chain-mail',       name: 'Chain Mail',       base: 16, dexCap: 'none', category: 'heavy',  metal: true,  cost: 75,  rarity: 'common' },
  splint:            { id: 'splint',           name: 'Splint',           base: 17, dexCap: 'none', category: 'heavy',  metal: true,  cost: 200, rarity: 'uncommon' },
};

export const SHIELD_COST = 10;

export function armorClass(armorId: Id | undefined, dexMod: number, shield: boolean): number {
  const a = armorId !== undefined ? ARMOR[armorId] : undefined;
  const base = a?.base ?? 10;
  const cap = a?.dexCap ?? 'full';
  const dex = cap === 'full' ? dexMod : cap === 'none' ? 0 : Math.min(dexMod, cap);
  return base + dex + (shield ? 2 : 0);
}

/** A combatant's current AC: stat-block override (monsters) or derived from equipment. */
export function acOf(c: Combatant): number {
  if (c.acOverride !== undefined) return c.acOverride;
  return armorClass(c.equipped.armor, abilityMod(c.abilities.dex), c.equipped.offHand === 'shield');
}

/** Is the combatant wearing metal armor (Shocking Grasp rider)? */
export function wearsMetal(c: Combatant): boolean {
  return c.equipped.armor !== undefined && (ARMOR[c.equipped.armor]?.metal ?? false);
}
