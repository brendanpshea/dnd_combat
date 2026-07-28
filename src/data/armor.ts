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
  /**
   * Strength score the armor expects. Below it you are not barred from wearing
   * it — SRD 5.2.1 costs you 10 feet of speed instead, which is the right
   * shape: a wizard *can* put on plate, and will regret it.
   */
  strMin?: number;
  /** Disadvantage on Dexterity (Stealth) checks while worn. */
  stealthDisadvantage?: true;
}

/**
 * The SRD armor table, in full.
 *
 * Two columns beyond AC do the real work here. Stealth disadvantage is why
 * Breastplate exists at all — it is Scale Mail's armor class for eight times
 * the price, and the only thing you are buying is the ability to Hide in it,
 * which for a party with a rogue's bounties on the line is worth every copper.
 * The Strength minimum is why Plate is not simply the answer: a hero who cannot
 * carry it loses 10 feet of speed, and on an eight-wide board that is a turn.
 *
 * Padded, Hide and Ring Mail are here for completeness rather than for play —
 * each is dominated by something a few gold pieces away, and a party that
 * starts with 100gp will never seriously want one. They are cheap to carry in
 * the table and their absence is the kind of hole that makes a reference doc
 * untrustworthy.
 */
export const ARMOR: Record<Id, ArmorData> = {
  // Light — Dex applies in full.
  padded:            { id: 'padded',           name: 'Padded',           base: 11, dexCap: 'full', category: 'light',  metal: false, cost: 5,   rarity: 'common', stealthDisadvantage: true },
  leather:           { id: 'leather',           name: 'Leather',          base: 11, dexCap: 'full', category: 'light',  metal: false, cost: 10,  rarity: 'common' },
  'studded-leather': { id: 'studded-leather',  name: 'Studded Leather',  base: 12, dexCap: 'full', category: 'light',  metal: false, cost: 45,  rarity: 'common' },

  // Medium — Dex up to +2.
  hide:              { id: 'hide',              name: 'Hide',             base: 12, dexCap: 2,      category: 'medium', metal: false, cost: 10,  rarity: 'common' },
  'chain-shirt':     { id: 'chain-shirt',      name: 'Chain Shirt',      base: 13, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common' },
  'scale-mail':      { id: 'scale-mail',       name: 'Scale Mail',       base: 14, dexCap: 2,      category: 'medium', metal: true,  cost: 50,  rarity: 'common', stealthDisadvantage: true },
  breastplate:       { id: 'breastplate',       name: 'Breastplate',      base: 14, dexCap: 2,      category: 'medium', metal: true,  cost: 400, rarity: 'uncommon' },
  'half-plate':      { id: 'half-plate',       name: 'Half Plate',       base: 15, dexCap: 2,      category: 'medium', metal: true,  cost: 750, rarity: 'uncommon', stealthDisadvantage: true },

  // Heavy — no Dex at all, and the two heaviest want Strength.
  'ring-mail':       { id: 'ring-mail',         name: 'Ring Mail',        base: 14, dexCap: 'none', category: 'heavy',  metal: true,  cost: 30,  rarity: 'common', stealthDisadvantage: true },
  'chain-mail':      { id: 'chain-mail',       name: 'Chain Mail',       base: 16, dexCap: 'none', category: 'heavy',  metal: true,  cost: 75,  rarity: 'common', strMin: 13, stealthDisadvantage: true },
  splint:            { id: 'splint',           name: 'Splint',           base: 17, dexCap: 'none', category: 'heavy',  metal: true,  cost: 200, rarity: 'uncommon', strMin: 15, stealthDisadvantage: true },
  // The top of the mundane table, and deliberately the most expensive thing
  // money can buy: 1,500gp is roughly two full runs of savings, which is what
  // an aspirational purchase is supposed to feel like.
  plate:             { id: 'plate',             name: 'Plate',            base: 18, dexCap: 'none', category: 'heavy',  metal: true,  cost: 1500, rarity: 'rare', strMin: 15, stealthDisadvantage: true },

  // Adamantine: same protection, but you can't be critically hit. Metal only.
  'adamantine-scale-mail': { id: 'adamantine-scale-mail', name: 'Adamantine Scale Mail', base: 14, dexCap: 2,      category: 'medium', metal: true, cost: 550,  rarity: 'uncommon', noCrit: true, stealthDisadvantage: true },
  'adamantine-half-plate': { id: 'adamantine-half-plate', name: 'Adamantine Half Plate', base: 15, dexCap: 2,      category: 'medium', metal: true, cost: 900,  rarity: 'uncommon', noCrit: true, stealthDisadvantage: true },
  'adamantine-chain-mail': { id: 'adamantine-chain-mail', name: 'Adamantine Chain Mail', base: 16, dexCap: 'none', category: 'heavy',  metal: true, cost: 575,  rarity: 'uncommon', noCrit: true, strMin: 13, stealthDisadvantage: true },
  'adamantine-splint':     { id: 'adamantine-splint',     name: 'Adamantine Splint',     base: 17, dexCap: 'none', category: 'heavy',  metal: true, cost: 700,  rarity: 'uncommon', noCrit: true, strMin: 15, stealthDisadvantage: true },
  'adamantine-plate':      { id: 'adamantine-plate',      name: 'Adamantine Plate',      base: 18, dexCap: 'none', category: 'heavy',  metal: true, cost: 2000, rarity: 'rare',     noCrit: true, strMin: 15, stealthDisadvantage: true },

  // +1 armor: +1 AC baked into the base. Rare tier, higher-level reward.
  'scale-mail-plus1': { id: 'scale-mail-plus1', name: 'Scale Mail +1', base: 15, dexCap: 2,      category: 'medium', metal: true, cost: 1000, rarity: 'rare', stealthDisadvantage: true },
  'breastplate-plus1': { id: 'breastplate-plus1', name: 'Breastplate +1', base: 15, dexCap: 2,   category: 'medium', metal: true, cost: 1300, rarity: 'rare' },
  'half-plate-plus1': { id: 'half-plate-plus1', name: 'Half Plate +1', base: 16, dexCap: 2,      category: 'medium', metal: true, cost: 1400, rarity: 'rare', stealthDisadvantage: true },
  // Splint +1 costs more than Plate for the same armor class. That is not a
  // slip: Plate is common stock you can plan to buy, while +1 armor is rare and
  // may simply never be offered — and once magic gear moves out of shops
  // entirely, the enchanted one stops being purchasable at all.
  'splint-plus1':     { id: 'splint-plus1',     name: 'Splint +1',     base: 18, dexCap: 'none', category: 'heavy',  metal: true, cost: 1600, rarity: 'rare', strMin: 15, stealthDisadvantage: true },
  'plate-plus1':      { id: 'plate-plus1',      name: 'Plate +1',      base: 19, dexCap: 'none', category: 'heavy',  metal: true, cost: 2500, rarity: 'rare', strMin: 15, stealthDisadvantage: true },
};

/** Does wearing this armor give disadvantage on Dexterity (Stealth) checks? */
export function armorStealthDisadvantage(armorId: Id | undefined): boolean {
  return armorId !== undefined && (ARMOR[armorId]?.stealthDisadvantage ?? false);
}

/**
 * Feet of speed lost to armor too heavy for the wearer (SRD 5.2.1: 10 feet
 * below the listed Strength). Returns 0 for anything they can carry.
 */
export function armorSpeedPenalty(armorId: Id | undefined, strScore: number): number {
  const min = armorId !== undefined ? ARMOR[armorId]?.strMin : undefined;
  return min !== undefined && strScore < min ? 10 : 0;
}


/**
 * Shields, as a table rather than as string comparisons scattered about.
 *
 * There were two of them and they were special-cased in eight places — name,
 * price, icon, category, rarity, the AC maths, the stock list, the loot pool.
 * A third would have meant finding all eight, and the failure mode is quiet:
 * a shield with no price is free, and one with no name shows its id.
 */
export interface ShieldData {
  id: Id;
  name: string;
  cost: number;
  rarity: Rarity;
  /** AC while held. */
  ac: number;
  /** Extra AC against ranged attacks only (Arrow-Catching Shield). */
  rangedAc?: number;
}

export const SHIELDS: Record<Id, ShieldData> = {
  shield: { id: 'shield', name: 'Shield', cost: 10, rarity: 'common', ac: 2 },
  'shield-plus1': { id: 'shield-plus1', name: 'Shield +1', cost: 500, rarity: 'uncommon', ac: 3 },
  'shield-arrow-catching': {
    id: 'shield-arrow-catching', name: 'Arrow-Catching Shield', cost: 1200, rarity: 'rare',
    // A plain shield's AC, plus two more against anything shot at you. The
    // condition is what keeps it from simply being a better shield: against a
    // warband that closes to melee it is an ordinary shield, and against
    // archers it is the best one in the game — and which of those a wave is,
    // the gate card tells you before you choose.
    ac: 2, rangedAc: 2,
  },
};

export const SHIELD_COST = SHIELDS['shield']!.cost;
export const SHIELD_PLUS1_COST = SHIELDS['shield-plus1']!.cost;

/** Is an off-hand entry a shield (plain or magic)? */
export function isShield(offHand: Id | undefined): boolean {
  return offHand !== undefined && SHIELDS[offHand] !== undefined;
}

/** The AC an off-hand shield contributes (0 if none). */
export function shieldBonus(offHand: Id | undefined): number {
  return offHand !== undefined ? SHIELDS[offHand]?.ac ?? 0 : 0;
}

/** Extra AC a shield gives against ranged attacks only (see SHIELDS). */
export function shieldRangedBonus(offHand: Id | undefined): number {
  return offHand !== undefined ? SHIELDS[offHand]?.rangedAc ?? 0 : 0;
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
  // Rust never takes armour below no armour at all: the plates are pitted, not
  // gone, and a corroded knight should not end up worse off than a naked one.
  const rust = c.corroded ?? 0;
  const shield = shieldBonus(c.equipped.offHand);
  if (c.mageArmor && c.equipped.armor === undefined) {
    return 13 + abilityMod(c.abilities.dex) + shield + trinketAc(c) + shieldedAc(c) + wardedAc(c) + hastedAc(c) + bondedAc(c);
  }
  // Unarmored Defense: 10 + Dex + Con, with a shield still allowed. This is
  // the barbarian's armour, so it has to beat what it replaces or the class
  // simply wears half plate instead — and the whole point of the feature is
  // that a barbarian does not.
  // Unarmored Defense, twice: the barbarian adds Constitution, the monk adds
  // Wisdom, and the monk may not use a shield with it. Two features rather than
  // one with a parameter, because they are two class features that happen to
  // share a name — and the shield clause is a real difference, not a detail.
  const unarmored = c.equipped.armor === undefined
    ? c.featureIds.includes('unarmored-defense') ? 'con'
      : c.featureIds.includes('monk-defense') && !isShield(c.equipped.offHand) ? 'wis'
      : undefined
    : undefined;
  if (unarmored) {
    return 10 + abilityMod(c.abilities.dex) + abilityMod(c.abilities[unarmored])
      + shield + trinketAc(c) + shieldedAc(c) + wardedAc(c) + hastedAc(c) + bondedAc(c);
  }
  const base = armorClass(c.equipped.armor, abilityMod(c.abilities.dex), shield);
  // Fighting Style: Defense — +1 AC while wearing any armor.
  const defense = c.equipped.armor !== undefined && c.featureIds.includes('defense') ? 1 : 0;
  const floor = 10 + abilityMod(c.abilities.dex);
  const armored = base + defense + trinketAc(c) + shieldedAc(c) + wardedAc(c) + hastedAc(c) + bondedAc(c);
  return Math.max(armored - rust, Math.min(armored, floor));
}

/**
 * Worn wondrous items that change AC, granted as features the builder folds.
 *
 * Bracers of Defense are conditional on wearing neither armour nor a shield,
 * which is what stops them being a flat +2 for the whole party — they are the
 * wizard's item, and useless to the fighter in splint.
 */
function trinketAc(c: Combatant): number {
  const cloak = c.featureIds.includes('cloak-protection') ? 1 : 0;
  const bracers = c.featureIds.includes('bracers-defense') &&
    c.equipped.armor === undefined && !isShield(c.equipped.offHand) ? 2 : 0;
  return cloak + bracers;
}

/** Shield spell reaction: +5 AC until the caster's next turn. */
function shieldedAc(c: Combatant): number {
  return c.conditions.some((k) => k.id === 'shielded') ? 5 : 0;
}

/** Warding Bond: +1 AC while the bond holds. */
function bondedAc(c: Combatant): number {
  return c.conditions.some((k) => k.id === 'bonded') ? 1 : 0;
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
