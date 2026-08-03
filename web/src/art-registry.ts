/**
 * Which ids have generated art, derived from the contents of
 * `web/public/art` by `npm run art-registry`. Do not edit by hand: add or
 * remove the .webp files and regenerate. The test suite fails if this file
 * and the directory disagree.
 */

/** Combatants with both a `portrait-<id>.webp` and a `token-<id>.webp`. */
export const HAS_ART = new Set<string>([
  'aboleth', 'acolyte', 'air-elemental', 'animated-armor', 'apprentice-mage',
  'assassin', 'azer', 'azer-forgecaller', 'bandit', 'bandit-captain',
  'banshee', 'barbed-devil', 'basilisk', 'bearded-devil', 'berserker',
  'black-pudding', 'black-wyrmling', 'blue-wyrmling', 'brown-bear',
  'bugbear', 'bulette', 'chain-devil', 'chimera', 'cleric', 'cockatrice',
  'cult-fanatic', 'dire-wolf', 'dragonborn-paladin', 'dragonborn-sorcerer',
  'dretch', 'druid', 'dryad', 'dust-mephit', 'dwarf-berserker',
  'dwarf-cleric', 'earth-elemental', 'elephant', 'elf-archer', 'elf-wizard',
  'ettercap', 'ettercap-snarecaller', 'ettin', 'fighter', 'fire-elemental',
  'fire-giant', 'flesh-golem', 'flying-sword', 'frost-giant', 'gargoyle',
  'gelatinous-cube', 'ghast', 'ghost', 'ghoul', 'giant-ape', 'giant-badger',
  'giant-boar', 'giant-constrictor-snake', 'giant-crocodile', 'giant-hyena',
  'giant-scorpion', 'giant-spider', 'giant-toad', 'glabrezu', 'gladiator',
  'gnoll', 'gnoll-packcaller', 'gnome-bard', 'gnome-warden', 'goblin-boss',
  'goblin-hexer', 'goblin-warrior', 'gorgon', 'gray-ooze', 'green-hag',
  'green-wyrmling', 'griffon', 'guard', 'halfling-priest', 'halfling-rogue',
  'halfling-warrior', 'harpy', 'hell-hound', 'hezrou', 'hill-giant',
  'horned-devil', 'human-bard', 'hydra', 'ice-mephit', 'imp',
  'invisible-stalker', 'knight', 'kobold', 'kobold-emberling', 'lion',
  'lizardfolk', 'mage', 'magma-mephit', 'magmin', 'mammoth', 'manticore',
  'minotaur', 'mummy', 'night-hag', 'ochre-jelly', 'ogre', 'ogre-mage',
  'orc', 'orc-barbarian', 'orc-shaman', 'otyugh', 'owlbear', 'paladin',
  'priest', 'quasit', 'ranger', 'red-wyrmling', 'remorhaz', 'rogue', 'roper',
  'rug-of-smothering', 'rust-monster', 'salamander', 'satyr', 'scarecrow',
  'scout', 'shadow', 'shield-guardian', 'skeleton', 'skeleton-bonechanter',
  'specter', 'sprite', 'spy', 'steam-mephit', 'stone-giant', 'stone-golem',
  'succubus', 'tiefling-knight', 'tiefling-warlock', 'troll',
  'tyrannosaurus', 'unicorn', 'vampire-spawn', 'veteran', 'vrock',
  'water-elemental', 'werebear', 'wereboar', 'wererat', 'weretiger',
  'werewolf', 'white-wyrmling', 'wight', 'will-o-wisp', 'winter-wolf',
  'wizard', 'wolf', 'worg', 'wraith', 'wyvern', 'young-black', 'young-blue',
  'young-green', 'young-red', 'young-white', 'zombie'
]);

/** Adventure NPC archetypes (`portrait-npc-<id>.webp`) — portrait only. */
export const HAS_NPC_ART = new Set<string>([
  'npc-bandit', 'npc-barbarian', 'npc-captain', 'npc-child', 'npc-commoner',
  'npc-cultist', 'npc-elder', 'npc-guard', 'npc-innkeeper', 'npc-merchant',
  'npc-noble', 'npc-priest', 'npc-sage', 'npc-scout', 'npc-stranger',
  'npc-wounded'
]);

/** Location backdrops (`scene-<id>.webp`). */
export const HAS_SCENE_ART = new Set<string>([
  'loc-camp', 'loc-cave', 'loc-coast', 'loc-crossroads', 'loc-crypt',
  'loc-dungeon', 'loc-field', 'loc-forest', 'loc-hills', 'loc-keep',
  'loc-market', 'loc-marsh', 'loc-mountain', 'loc-river', 'loc-road',
  'loc-ruins', 'loc-tavern', 'loc-temple', 'loc-throne', 'loc-throne-dwarf',
  'loc-throne-elf', 'loc-throne-evil', 'loc-town', 'loc-village'
]);

/** Map nodes (`token-tok-<id>.webp`) — token only. */
export const HAS_TOKEN_ART = new Set<string>([
  'tok-boss', 'tok-bridge', 'tok-camp', 'tok-cave', 'tok-crossing',
  'tok-danger', 'tok-figure', 'tok-fire', 'tok-gate', 'tok-house',
  'tok-lookout', 'tok-market', 'tok-mystery', 'tok-notice', 'tok-person',
  'tok-ruin', 'tok-tavern', 'tok-temple', 'tok-tracks', 'tok-treasure',
  'tok-tree', 'tok-well'
]);

/** Spells and features with a generated icon (`icon-<id>.webp`). */
export const HAS_SPELL_ICON = new Set<string>([
  'acid-splash', 'aid', 'animal-friendship', 'bane', 'bless', 'blindness',
  'breath-weapon', 'burning-hands', 'color-spray', 'command', 'cure-wounds',
  'dispel-magic', 'faerie-fire', 'false-life', 'fear', 'find-familiar',
  'fire-bolt', 'fireball', 'guidance', 'guiding-bolt', 'haste',
  'healing-word', 'hold-person', 'hunters-mark', 'inflict-wounds',
  'invisibility', 'lesser-restoration', 'lightning-bolt', 'mage-armor',
  'magic-missile', 'mass-healing-word', 'minor-illusion', 'misty-step',
  'poison-spray', 'ray-of-frost', 'ray-of-sickness', 'sacred-flame',
  'scorching-ray', 'shield', 'shield-of-faith', 'shocking-grasp', 'sleep',
  'spiritual-guardians', 'spiritual-weapon', 'suggestion', 'thunderwave',
  'true-strike', 'web'
]);

/** Map themes with a generated arena backdrop (`bg-<theme>.webp`). */
export const HAS_BOARD_BG = new Set<string>([
  'bog', 'ember', 'forest', 'graveyard', 'stone', 'village'
]);

/**
 * Map themes with a full set of drawn blocking props
 * (`terrain/terrain-{wall,cover}-<theme>-{a,b}.svg`).
 *
 * All four or none: a theme with drawn walls and CSS barricades would
 * read worse than either treatment on its own.
 */
export const HAS_TERRAIN_ART = new Set<string>([
  'bog', 'ember', 'forest', 'graveyard', 'stone', 'village'
]);

/**
 * Gear with a drawn icon (`items/<id>.svg`).
 *
 * Keyed by the BASE shape, not by inventory id — see `itemArtId` in
 * `web/src/itemArt.ts`. A +1 longsword, a silvered longsword and a
 * longsword are one picture.
 */
export const HAS_ITEM_ART = new Set<string>([
  'alchemists-fire', 'amulet-health', 'battleaxe',
  'belt-giant-strength-hill', 'berserker-axe', 'boots-winterlands',
  'bracers-archery', 'bracers-defense', 'breastplate', 'brooch-shielding',
  'chain-mail', 'chain-shirt', 'cloak-displacement', 'cloak-protection',
  'dagger', 'dragon-slayer', 'elemental-focus', 'figurine',
  'gauntlets-ogre-power', 'giant-slayer', 'gloves-thievery', 'greataxe',
  'greatsword', 'half-plate', 'hand-crossbow', 'handaxe',
  'headband-intellect', 'hide', 'javelin', 'leather', 'light-crossbow',
  'longbow', 'longsword', 'mace', 'mace-of-disruption', 'mace-of-smiting',
  'mace-of-terror', 'mantle-spell-resistance', 'morningstar',
  'necklace-prayer-beads', 'padded', 'plate', 'potion-greater-healing',
  'potion-healing', 'quarterstaff', 'rapier', 'ring', 'ring-mail',
  'scale-mail', 'scimitar', 'scroll', 'shield', 'shortbow', 'shortsword',
  'spear', 'splint', 'staff', 'studded-leather', 'sun-blade',
  'sword-of-life-stealing', 'sword-of-wounding', 'unarmed-strike', 'wand',
  'warhammer'
]);
