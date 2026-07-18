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
};
