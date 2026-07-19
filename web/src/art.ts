/**
 * Character/monster art lookup. Processed WebP assets live in web/public/art
 * (see art/process.py); anything without art falls back to the emoji glyph.
 */

const BASE = import.meta.env.BASE_URL;

/** Engine ids that have generated token + portrait art. */
export const HAS_ART = new Set<string>([
  'fighter', 'wizard', 'cleric', 'rogue',
  'goblin-warrior', 'goblin-boss', 'skeleton', 'wolf', 'zombie', 'ogre',
  'bandit', 'dire-wolf', 'ghoul', 'giant-spider', 'acolyte',
  'kobold', 'scout', 'orc', 'brown-bear', 'cult-fanatic', 'animated-armor',
  'orc-barbarian', 'dragonborn-paladin', 'gnome-bard', 'halfling-rogue', 'tiefling-warlock',
  'dwarf-berserker', 'elf-archer', 'human-bard', 'bandit-captain',
  'knight', 'minotaur', 'ettin', 'priest', 'ogre-mage',
  'guard', 'bugbear', 'lizardfolk', 'gnoll', 'spy',
  'giant-badger', 'giant-toad', 'giant-hyena', 'giant-boar', 'giant-constrictor-snake',
  'gargoyle', 'fire-elemental', 'water-elemental', 'earth-elemental', 'air-elemental',
  'sprite', 'satyr', 'dryad', 'green-hag', 'unicorn',
]);

export function hasArt(id: string): boolean {
  return HAS_ART.has(id);
}

export function tokenUrl(id: string): string {
  return `${BASE}art/token-${id}.webp`;
}

export function portraitUrl(id: string): string {
  return `${BASE}art/portrait-${id}.webp`;
}

/**
 * Board render scale, amplifying the size tiers the source framing only hints
 * at (so an ogre visibly towers over a kobold). 1 = default cell fit.
 */
const SCALE: Record<string, number> = {
  ogre: 1.3, 'brown-bear': 1.18, 'dire-wolf': 1.15, 'goblin-boss': 1.12,
  kobold: 0.82, 'giant-spider': 0.85, skeleton: 0.95,
  minotaur: 1.15, ettin: 1.3, 'ogre-mage': 1.3,
  bugbear: 1.15, gnoll: 1.1,
  'giant-badger': 0.95, 'giant-toad': 1.25, 'giant-hyena': 1.2, 'giant-boar': 1.25, 'giant-constrictor-snake': 1.3,
  gargoyle: 1.0, 'fire-elemental': 1.35, 'water-elemental': 1.35, 'earth-elemental': 1.4, 'air-elemental': 1.35,
  sprite: 0.8, satyr: 1.0, dryad: 1.0, 'green-hag': 1.15, unicorn: 1.35,
};

export function tokenScale(id: string): number {
  return SCALE[id] ?? 1;
}
