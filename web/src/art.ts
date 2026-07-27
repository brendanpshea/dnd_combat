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
  // Species x role portraits (art/prompts.md §6b) — these close the forge's
  // species x class matrix, which previously filled its holes with the wrong
  // picture (human rangers in elf ears, dwarf wizards drawn as humans).
  'ranger', 'paladin', 'dwarf-cleric', 'elf-wizard', 'orc-shaman',
  'dragonborn-sorcerer', 'tiefling-knight', 'gnome-warden',
  'halfling-warrior', 'halfling-priest',
  'knight', 'minotaur', 'ettin', 'priest', 'ogre-mage',
  'guard', 'bugbear', 'lizardfolk', 'gnoll', 'spy',
  'giant-badger', 'giant-toad', 'giant-hyena', 'giant-boar', 'giant-constrictor-snake',
  'gargoyle', 'fire-elemental', 'water-elemental', 'earth-elemental', 'air-elemental',
  'sprite', 'satyr', 'dryad', 'green-hag', 'unicorn',
  'cockatrice', 'harpy', 'manticore', 'owlbear', 'gorgon',
  'shadow', 'specter', 'will-o-wisp', 'wight', 'mummy',
  'red-wyrmling', 'white-wyrmling', 'green-wyrmling', 'blue-wyrmling', 'black-wyrmling',
  'berserker', 'veteran', 'gladiator', 'mage', 'assassin',
  'tyrannosaurus', 'giant-scorpion', 'elephant', 'giant-crocodile',
  'mammoth', 'giant-ape', 'worg',
  'ghast', 'banshee',
  'ghost', 'wraith',
  'vampire-spawn', 'shadow-demon', 'succubus',
  'bearded-devil', 'night-hag', 'chain-devil',
]);

/**
 * Adventure NPC-archetype portraits with generated art (`portrait-<id>.webp`),
 * e.g. 'npc-innkeeper'. Empty until generated — see art/adventure-prompts.md
 * and src/data/adventure-art.ts. Kept separate so the vocabulary (all
 * archetypes) and the "actually generated" set stay independent.
 */
export const HAS_NPC_ART = new Set<string>([
  'npc-innkeeper',
  'npc-elder',
  'npc-merchant',
  'npc-guard',
  'npc-scout',
  'npc-commoner',
  'npc-child',
  'npc-noble',
  'npc-priest',
  'npc-sage',
  'npc-stranger',
  'npc-wounded',
  'npc-bandit',
  'npc-captain',
  'npc-cultist',
  'npc-barbarian',
]);

export function hasArt(id: string): boolean {
  return HAS_ART.has(id) || HAS_NPC_ART.has(id);
}

/**
 * Adventure location-scene backdrops with generated art (`scene-<id>.webp`),
 * e.g. 'loc-tavern'. Empty until generated.
 */
export const HAS_SCENE_ART = new Set<string>([
  'loc-village',
  'loc-town',
  'loc-tavern',
  'loc-market',
  'loc-road',
  'loc-crossroads',
  'loc-field',
  'loc-forest',
  'loc-marsh',
  'loc-river',
  'loc-hills',
  'loc-mountain',
  'loc-coast',
  'loc-cave',
  'loc-dungeon',
  'loc-ruins',
  'loc-crypt',
  'loc-camp',
  'loc-keep',
  'loc-temple',
  'loc-throne',
  'loc-throne-elf',
  'loc-throne-dwarf',
  'loc-throne-evil',
]);

export function hasSceneArt(id: string | undefined): boolean {
  return !!id && HAS_SCENE_ART.has(id);
}

export function sceneArtUrl(id: string): string {
  return `${BASE}art/scene-${id}.webp`;
}

/** Map-node tokens (`tok-*`) with generated circular art (`token-tok-*.webp`).
 *  Empty until generated — see art/adventure-prompts.md; nodes fall back to the
 *  token's emoji until then. */
export const HAS_TOKEN_ART = new Set<string>([
  'tok-tavern',
  'tok-market',
  'tok-notice',
  'tok-gate',
  'tok-well',
  'tok-house',
  'tok-temple',
  'tok-camp',
  'tok-cave',
  'tok-ruin',
  'tok-crossing',
  'tok-tracks',
  'tok-tree',
  'tok-person',
  'tok-figure',
  'tok-danger',
  'tok-treasure',
  'tok-fire',
  'tok-boss',
  'tok-mystery',
  'tok-bridge',
  'tok-lookout',
]);
export function hasTokenArt(id: string | undefined): boolean {
  return !!id && HAS_TOKEN_ART.has(id);
}

export function tokenUrl(id: string): string {
  return `${BASE}art/token-${id}.webp`;
}

export function portraitUrl(id: string): string {
  return `${BASE}art/portrait-${id}.webp`;
}

/**
 * Spell ids with a generated icon (`icon-<spellId>.webp`, see
 * art/process_icons.py). Used in the action bar / spell tray / prepare lists,
 * and on the board for summons and the web overlay. Anything not here falls
 * back to the spell's emoji glyph.
 */
export const HAS_SPELL_ICON = new Set<string>([
  'acid-splash', 'fire-bolt', 'guidance', 'minor-illusion', 'poison-spray',
  'ray-of-frost', 'sacred-flame', 'shocking-grasp', 'true-strike',
  'animal-friendship', 'bane', 'bless', 'burning-hands', 'color-spray',
  'command', 'cure-wounds', 'faerie-fire', 'false-life', 'guiding-bolt',
  'healing-word', 'hunters-mark', 'inflict-wounds', 'mage-armor',
  'magic-missile', 'ray-of-sickness', 'shield', 'shield-of-faith', 'sleep',
  'aid', 'blindness', 'hold-person', 'invisibility', 'lesser-restoration',
  'misty-step', 'scorching-ray', 'spiritual-weapon', 'suggestion', 'web',
  'dispel-magic', 'fear', 'fireball', 'haste', 'lightning-bolt',
  'mass-healing-word', 'spiritual-guardians', 'find-familiar', 'thunderwave',
  'breath-weapon',
]);
export function hasSpellIcon(spellId: string | undefined): boolean {
  return !!spellId && HAS_SPELL_ICON.has(spellId);
}
export function spellIconUrl(spellId: string): string {
  return `${BASE}art/icon-${spellId}.webp`;
}

/** Themes with a generated arena backdrop (see art/arena-prompts.md). */
export const HAS_BOARD_BG = new Set<string>(['stone', 'forest', 'graveyard', 'ember', 'village', 'bog']);

export function boardBgUrl(theme: string): string {
  return `${BASE}art/bg-${theme}.webp`;
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
  cockatrice: 0.85, harpy: 1.0, manticore: 1.35, owlbear: 1.35, gorgon: 1.4,
  shadow: 0.95, specter: 1.0, 'will-o-wisp': 0.75, wight: 1.1, mummy: 1.1,
  'red-wyrmling': 1.15, 'white-wyrmling': 1.1, 'green-wyrmling': 1.1, 'blue-wyrmling': 1.15, 'black-wyrmling': 1.15,
  otyugh: 1.35, aboleth: 1.45,
  'dust-mephit': 0.8, 'mud-mephit': 0.8, 'smoke-mephit': 0.8, 'ice-mephit': 0.8,
  'magma-mephit': 0.8, 'steam-mephit': 0.8,
  'shadow-demon': 1.05, succubus: 1.0, 'bearded-devil': 1.1, 'night-hag': 1.05,
  'chain-devil': 1.15, hezrou: 1.3, glabrezu: 1.4, 'horned-devil': 1.35,
  worg: 1.1, 'rust-monster': 1.0, griffon: 1.25, ettercap: 1.05, basilisk: 1.15,
  'winter-wolf': 1.2, roper: 1.3, bulette: 1.4, remorhaz: 1.5, tyrannosaurus: 1.5,
  ghast: 1.0, banshee: 1.0, ghost: 1.0, wraith: 1.1, 'vampire-spawn': 1.05,
  'giant-scorpion': 1.2, elephant: 1.45, 'giant-crocodile': 1.35, mammoth: 1.5, 'giant-ape': 1.45,
  berserker: 1.05, veteran: 1.0, gladiator: 1.1, mage: 1.0, assassin: 1.0,
  scarecrow: 1.05, 'shield-guardian': 1.35, 'stone-golem': 1.45,
  magmin: 0.8, azer: 1.0, salamander: 1.25, 'invisible-stalker': 1.1,
  imp: 0.75, quasit: 0.75, dretch: 0.95, 'hell-hound': 1.1, 'barbed-devil': 1.15, vrock: 1.2,
  'gray-ooze': 0.95, 'ochre-jelly': 1.1, 'gelatinous-cube': 1.35, 'black-pudding': 1.2,
  'flying-sword': 0.9, 'rug-of-smothering': 1.1, 'flesh-golem': 1.2,
  // Huge creatures. They share one cell like everything else, so scale is the
  // only thing telling a player a fire giant isn't an ogre.
  troll: 1.3, 'hill-giant': 1.4, 'stone-giant': 1.45, 'frost-giant': 1.45, 'fire-giant': 1.5,
  chimera: 1.4, wyvern: 1.4, hydra: 1.5,
  'young-white': 1.45, 'young-black': 1.45, 'young-green': 1.45,
  'young-blue': 1.5, 'young-red': 1.5,
};

export function tokenScale(id: string): number {
  return SCALE[id] ?? 1;
}
