import type { Id } from '../engine/types.js';

export interface ArmorData {
  id: Id;
  name: string;
  base: number;
  /** How much Dex applies: 'full' (light/none), capped (medium), 'none' (heavy). */
  dexCap: 'full' | 'none' | number;
  metal: boolean; // Shocking Grasp gets advantage vs metal armor
}

export const ARMOR: Record<Id, ArmorData> = {
  none:            { id: 'none',            name: 'Unarmored',       base: 10, dexCap: 'full', metal: false },
  'studded-leather': { id: 'studded-leather', name: 'Studded Leather', base: 12, dexCap: 'full', metal: false },
  'scale-mail':    { id: 'scale-mail',      name: 'Scale Mail',      base: 14, dexCap: 2,      metal: true },
  'chain-mail':    { id: 'chain-mail',      name: 'Chain Mail',      base: 16, dexCap: 'none', metal: true },
};

export function armorClass(armorId: Id, dexMod: number, shield: boolean): number {
  const a = ARMOR[armorId] ?? ARMOR['none']!;
  const dex = a.dexCap === 'full' ? dexMod : a.dexCap === 'none' ? 0 : Math.min(dexMod, a.dexCap);
  return a.base + dex + (shield ? 2 : 0);
}
