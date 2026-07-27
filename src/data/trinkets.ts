/**
 * Wondrous items worn in the single "trinket" accessory slot. Each grants a
 * bundle the character builder folds exactly like species/choice grants —
 * feature ids (whose effects are checked by the relevant rules), damage
 * resistances, and ability-score floors. So a new trinket is data plus, at
 * most, one feature check somewhere.
 *
 * Feature effects wired elsewhere:
 *   cloak-protection  → +1 AC (acOf), +1 to all saves (savingThrow)
 *   brooch-shielding  → force resistance (grant) + Magic Missile immunity (magic-missile.cast)
 *   bracers-archery   → +2 damage with ranged weapons (resolveAttack)
 *   boots-winterlands → cold resistance (grant) + ignore difficult terrain (reachable)
 *   gloves-thievery   → +5 Sleight of Hand for shop theft (skillBonus)
 * Gauntlets/Headband have no feature — they set an ability floor directly.
 */
import type { Id, DamageType, Ability } from '../engine/types.js';
import type { Rarity } from './armor.js';

export interface TrinketGrant {
  featureIds?: Id[];
  resistances?: DamageType[];
  /** Raise these abilities to at least this score (Gauntlets of Ogre Power → Str 19). */
  abilityFloor?: Partial<Record<Ability, number>>;
}

export interface TrinketData {
  id: Id;
  name: string;
  cost: number;
  rarity: Rarity;
  icon: string;
  blurb: string;
  grants: TrinketGrant;
  /**
   * Which slot it occupies. Absent = the trinket slot.
   *
   * Rings live in the same table and use the same grant machinery — they are
   * wondrous items in every way that matters to the builder — but they have
   * their own slot, so a Ring of Resistance and a Cloak of Protection can be
   * worn together. Folding rings into the single accessory slot would have been
   * a decision made for the implementation's convenience rather than the game's.
   */
  slot?: 'trinket' | 'ring';
}

/** Where a wondrous item is worn (see TrinketData.slot). */
export function trinketSlot(t: TrinketData): 'trinket' | 'ring' {
  return t.slot ?? 'trinket';
}

export const TRINKETS: Record<Id, TrinketData> = {
  'gauntlets-ogre-power': {
    id: 'gauntlets-ogre-power', name: 'Gauntlets of Ogre Power', cost: 400, rarity: 'uncommon', icon: '🧤',
    blurb: 'Your Strength is 19.',
    grants: { abilityFloor: { str: 19 } },
  },
  'headband-intellect': {
    id: 'headband-intellect', name: 'Headband of Intellect', cost: 400, rarity: 'uncommon', icon: '🎗️',
    blurb: 'Your Intelligence is 19.',
    grants: { abilityFloor: { int: 19 } },
  },
  'cloak-protection': {
    id: 'cloak-protection', name: 'Cloak of Protection', cost: 500, rarity: 'uncommon', icon: '🧥',
    blurb: '+1 to AC and all saving throws.',
    grants: { featureIds: ['cloak-protection'] },
  },
  'brooch-shielding': {
    id: 'brooch-shielding', name: 'Brooch of Shielding', cost: 400, rarity: 'uncommon', icon: '📌',
    blurb: 'Resistance to force damage; immune to Magic Missile.',
    grants: { featureIds: ['brooch-shielding'], resistances: ['force'] },
  },
  'bracers-archery': {
    id: 'bracers-archery', name: 'Bracers of Archery', cost: 400, rarity: 'uncommon', icon: '🏹',
    blurb: '+2 damage with ranged weapons.',
    grants: { featureIds: ['bracers-archery'] },
  },
  'boots-winterlands': {
    id: 'boots-winterlands', name: 'Boots of the Winterlands', cost: 350, rarity: 'uncommon', icon: '🥾',
    blurb: 'Cold resistance; ignore difficult terrain.',
    grants: { featureIds: ['boots-winterlands'], resistances: ['cold'] },
  },
  'gloves-thievery': {
    id: 'gloves-thievery', name: 'Gloves of Thievery', cost: 300, rarity: 'uncommon', icon: '🧤',
    blurb: '+5 to Sleight of Hand (helps shop theft).',
    grants: { featureIds: ['gloves-thievery'] },
  },

  // --- rare tier: the defensive set -----------------------------------------
  //
  // The trinket slot held seven uncommon items and nothing above them, so from
  // level 5 there was simply nothing left to want. These four are the SRD's
  // Rare wondrous items that do something in a fight, which is the bar — a
  // Bag of Holding is a fine item and changes no decision on a grid.
  'amulet-health': {
    id: 'amulet-health', name: 'Amulet of Health', cost: 900, rarity: 'rare', icon: '📿',
    blurb: 'Your Constitution is 19.',
    // Exactly the Gauntlets pattern, and worth more than it looks: Constitution
    // is the one score that pays every character, because hit points are rolled
    // per level and the modifier applies to all of them.
    grants: { abilityFloor: { con: 19 } },
  },
  'bracers-defense': {
    id: 'bracers-defense', name: 'Bracers of Defense', cost: 900, rarity: 'rare', icon: '🦾',
    blurb: '+2 AC while wearing no armour and no shield.',
    // The condition is what stops this being a flat +2 for the whole party: it
    // is the wizard's and the unarmoured rogue's item, and useless to the
    // fighter in splint who would otherwise want it most.
    grants: { featureIds: ['bracers-defense'] },
  },
  'cloak-displacement': {
    id: 'cloak-displacement', name: 'Cloak of Displacement', cost: 1200, rarity: 'rare', icon: '🌀',
    blurb: 'Attacks against you have disadvantage — until something hits you.',
    grants: { featureIds: ['cloak-displacement'] },
  },
  'mantle-spell-resistance': {
    id: 'mantle-spell-resistance', name: 'Mantle of Spell Resistance', cost: 1100, rarity: 'rare', icon: '🧿',
    blurb: 'Advantage on saving throws against spells.',
    grants: { featureIds: ['mantle-spell-resistance'] },
  },
  'belt-giant-strength-hill': {
    id: 'belt-giant-strength-hill', name: 'Belt of Hill Giant Strength', cost: 1000, rarity: 'rare', icon: '🎽',
    blurb: 'Your Strength is 21.',
    // The SRD's belt comes in five grades — hill 21, frost/stone 23, fire 25,
    // cloud 27, storm 29 — and only the hill belt is Rare. The rest are Very
    // Rare and Legendary, tiers this game has no rarity for and no levels to
    // reach, so adding them would be adding items nothing can ever offer.
    grants: { abilityFloor: { str: 21 } },
  },

  // --- rings ----------------------------------------------------------------
  //
  // Ring of Resistance, one per damage type. The SRD writes it as a single item
  // whose gemstone picks the type; here each is its own id, because an item
  // whose most important property is chosen at drop time cannot be shopped for,
  // and choosing which resistance to buy against the wave you can see is the
  // entire decision.
  //
  // Gemstones are the SRD's, so the names carry the information twice — a
  // player who reads "Garnet" learns nothing, but the ones who notice the
  // pattern get something to notice.
  'ring-resistance-fire': {
    id: 'ring-resistance-fire', name: 'Ring of Fire Resistance', cost: 800, rarity: 'rare', icon: '🔴',
    blurb: 'Resistance to fire damage. (Garnet.)',
    slot: 'ring',
    grants: { resistances: ['fire'] },
  },
  'ring-resistance-cold': {
    id: 'ring-resistance-cold', name: 'Ring of Cold Resistance', cost: 800, rarity: 'rare', icon: '🔵',
    blurb: 'Resistance to cold damage. (Tourmaline.)',
    slot: 'ring',
    grants: { resistances: ['cold'] },
  },
  'ring-resistance-acid': {
    id: 'ring-resistance-acid', name: 'Ring of Acid Resistance', cost: 800, rarity: 'rare', icon: '⚪',
    blurb: 'Resistance to acid damage. (Pearl.)',
    slot: 'ring',
    grants: { resistances: ['acid'] },
  },
  'ring-resistance-lightning': {
    id: 'ring-resistance-lightning', name: 'Ring of Lightning Resistance', cost: 800, rarity: 'rare', icon: '🟡',
    blurb: 'Resistance to lightning damage. (Citrine.)',
    slot: 'ring',
    grants: { resistances: ['lightning'] },
  },
  'ring-resistance-poison': {
    id: 'ring-resistance-poison', name: 'Ring of Poison Resistance', cost: 800, rarity: 'rare', icon: '🟣',
    blurb: 'Resistance to poison damage. (Amethyst.)',
    slot: 'ring',
    grants: { resistances: ['poison'] },
  },
  'ring-resistance-necrotic': {
    id: 'ring-resistance-necrotic', name: 'Ring of Necrotic Resistance', cost: 800, rarity: 'rare', icon: '⚫',
    blurb: 'Resistance to necrotic damage. (Jet.)',
    slot: 'ring',
    grants: { resistances: ['necrotic'] },
  },
  'ring-resistance-radiant': {
    id: 'ring-resistance-radiant', name: 'Ring of Radiant Resistance', cost: 800, rarity: 'rare', icon: '🟠',
    blurb: 'Resistance to radiant damage. (Topaz.)',
    slot: 'ring',
    grants: { resistances: ['radiant'] },
  },
  'ring-resistance-force': {
    id: 'ring-resistance-force', name: 'Ring of Force Resistance', cost: 800, rarity: 'rare', icon: '🔷',
    blurb: 'Resistance to force damage. (Sapphire.)',
    slot: 'ring',
    grants: { resistances: ['force'] },
  },
  'ring-resistance-psychic': {
    id: 'ring-resistance-psychic', name: 'Ring of Psychic Resistance', cost: 800, rarity: 'rare', icon: '🟢',
    blurb: 'Resistance to psychic damage. (Jade.)',
    slot: 'ring',
    grants: { resistances: ['psychic'] },
  },
  'ring-resistance-thunder': {
    id: 'ring-resistance-thunder', name: 'Ring of Thunder Resistance', cost: 800, rarity: 'rare', icon: '🟤',
    blurb: 'Resistance to thunder damage. (Spinel.)',
    slot: 'ring',
    grants: { resistances: ['thunder'] },
  },
};

/**
 * Every wondrous item at the rare tier, derived from the table rather than
 * listed again in the loot pools.
 *
 * The uncommon seven are enumerated by hand in campaign.ts because they predate
 * this; anything new should land here instead, so adding an item to TRINKETS is
 * all it takes to make it droppable and stockable. A trinket that exists but
 * never drops is the same dead data as a spell nobody casts.
 */
export const RARE_WONDROUS: Id[] = Object.values(TRINKETS)
  .filter((t) => t.rarity === 'rare')
  .map((t) => t.id)
  .sort();
