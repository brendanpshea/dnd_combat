/**
 * Which ids have generated art, derived from the contents of
 * `web/public/art` by `npm run art-registry`. Do not edit by hand: add or
 * remove the .webp files and regenerate. The test suite fails if this file
 * and the directory disagree.
 */

/** Combatants with both a `portrait-<id>.webp` and a `token-<id>.webp`. */
export const HAS_ART = new Set<string>([
  'acolyte', 'air-elemental', 'animated-armor', 'assassin', 'bandit',
  'bandit-captain', 'banshee', 'barbed-devil', 'bearded-devil', 'berserker',
  'black-wyrmling', 'blue-wyrmling', 'brown-bear', 'bugbear', 'chain-devil',
  'cleric', 'cockatrice', 'cult-fanatic', 'dire-wolf', 'dragonborn-paladin',
  'dragonborn-sorcerer', 'dretch', 'dryad', 'dwarf-berserker',
  'dwarf-cleric', 'earth-elemental', 'elephant', 'elf-archer', 'elf-wizard',
  'ettin', 'fighter', 'fire-elemental', 'gargoyle', 'ghast', 'ghost',
  'ghoul', 'giant-ape', 'giant-badger', 'giant-boar',
  'giant-constrictor-snake', 'giant-crocodile', 'giant-hyena',
  'giant-scorpion', 'giant-spider', 'giant-toad', 'glabrezu', 'gladiator',
  'gnoll', 'gnome-bard', 'gnome-warden', 'goblin-boss', 'goblin-warrior',
  'gorgon', 'green-hag', 'green-wyrmling', 'guard', 'halfling-priest',
  'halfling-rogue', 'halfling-warrior', 'harpy', 'hell-hound', 'hezrou',
  'horned-devil', 'human-bard', 'imp', 'knight', 'kobold', 'lizardfolk',
  'mage', 'mammoth', 'manticore', 'minotaur', 'mummy', 'night-hag', 'ogre',
  'ogre-mage', 'orc', 'orc-barbarian', 'orc-shaman', 'owlbear', 'paladin',
  'priest', 'quasit', 'ranger', 'red-wyrmling', 'rogue', 'satyr', 'scout',
  'shadow', 'skeleton', 'specter', 'sprite', 'spy', 'succubus',
  'tiefling-knight', 'tiefling-warlock', 'tyrannosaurus', 'unicorn',
  'vampire-spawn', 'veteran', 'vrock', 'water-elemental', 'white-wyrmling',
  'wight', 'will-o-wisp', 'wizard', 'wolf', 'worg', 'wraith', 'zombie'
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
