/**
 * Pure treasure: gems and jewelry. No combat use (not in ITEMS, so they never
 * appear as a useItem action) — they exist to be found, sold, and looked at.
 * `itemPrice`/`itemName`/`itemIcon` in campaign.ts check this map alongside
 * ITEMS/WEAPONS/ARMOR so the shop, inventory, and loot screen need no
 * special-casing.
 */
import type { Id } from '../engine/types.js';
import type { Rarity } from './armor.js';

export interface ValuableData {
  id: Id;
  name: string;
  cost: number; // gp
  rarity: Rarity;
  icon: string;
}

export const VALUABLES: Record<Id, ValuableData> = {
  // --- gemstones: value rises with size, so does rarity ---------------------
  'gem-quartz': { id: 'gem-quartz', name: 'Tiny Quartz', cost: 10, rarity: 'common', icon: '💎' },
  'gem-moss-agate': { id: 'gem-moss-agate', name: 'Tiny Moss Agate', cost: 10, rarity: 'common', icon: '💎' },
  'gem-onyx': { id: 'gem-onyx', name: 'Small Onyx', cost: 50, rarity: 'common', icon: '💎' },
  'gem-carnelian': { id: 'gem-carnelian', name: 'Small Carnelian', cost: 50, rarity: 'common', icon: '💎' },
  'gem-amber': { id: 'gem-amber', name: 'Medium Amber', cost: 100, rarity: 'uncommon', icon: '💎' },
  'gem-garnet': { id: 'gem-garnet', name: 'Medium Garnet', cost: 100, rarity: 'uncommon', icon: '💎' },
  'gem-amethyst': { id: 'gem-amethyst', name: 'Medium Amethyst', cost: 200, rarity: 'uncommon', icon: '💎' },
  'gem-topaz': { id: 'gem-topaz', name: 'Large Topaz', cost: 500, rarity: 'rare', icon: '💎' },
  'gem-sapphire': { id: 'gem-sapphire', name: 'Large Sapphire', cost: 500, rarity: 'rare', icon: '💎' },
  'gem-diamond': { id: 'gem-diamond', name: 'Huge Diamond', cost: 1000, rarity: 'rare', icon: '💎' },

  // --- jewelry: ring / necklace / bracer / figurine, material climbs the
  // value ladder from wood to gold, "dwarven-forged" tops it out -----------
  'jewelry-wooden-bracer': { id: 'jewelry-wooden-bracer', name: 'Carved Wooden Bracer', cost: 10, rarity: 'common', icon: '📿' },
  'jewelry-brass-ring': { id: 'jewelry-brass-ring', name: 'Brass Ring', cost: 25, rarity: 'common', icon: '💍' },
  'jewelry-bronze-figurine': { id: 'jewelry-bronze-figurine', name: 'Bronze Figurine', cost: 25, rarity: 'common', icon: '🗿' },
  'jewelry-obsidian-necklace': { id: 'jewelry-obsidian-necklace', name: 'Obsidian Necklace', cost: 50, rarity: 'common', icon: '📿' },
  'jewelry-iron-bracer': { id: 'jewelry-iron-bracer', name: 'Finely Made Iron Bracer', cost: 75, rarity: 'uncommon', icon: '📿' },
  'jewelry-steel-ring': { id: 'jewelry-steel-ring', name: 'Finely Made Steel Ring', cost: 150, rarity: 'uncommon', icon: '💍' },
  'jewelry-silver-necklace': { id: 'jewelry-silver-necklace', name: 'Silver Necklace', cost: 250, rarity: 'uncommon', icon: '📿' },
  'jewelry-gold-figurine': { id: 'jewelry-gold-figurine', name: 'Gold Figurine', cost: 400, rarity: 'rare', icon: '🗿' },
  'jewelry-gold-necklace': { id: 'jewelry-gold-necklace', name: 'Finely Made Gold Necklace', cost: 500, rarity: 'rare', icon: '📿' },
  'jewelry-dwarven-ring': { id: 'jewelry-dwarven-ring', name: 'Dwarven-Forged Ring', cost: 750, rarity: 'rare', icon: '💍' },
};
