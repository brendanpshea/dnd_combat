/**
 * Character/monster art lookup. Processed WebP assets live in web/public/art
 * (see art/process.py); anything without art falls back to the emoji glyph.
 *
 * WHICH ids have art is not written here — it is derived from the directory by
 * `npm run art-registry` into `art-registry.ts`, and re-exported below so every
 * caller keeps importing it from this module. A hand-kept list beside a
 * directory of files is one edit away from a broken <img> or from art that ships
 * in the bundle and is never displayed; neither failure is visible.
 */

import {
  HAS_ART, HAS_NPC_ART, HAS_SCENE_ART, HAS_TOKEN_ART, HAS_SPELL_ICON, HAS_BOARD_BG,
} from './art-registry.js';

export { HAS_ART, HAS_NPC_ART, HAS_SCENE_ART, HAS_TOKEN_ART, HAS_SPELL_ICON, HAS_BOARD_BG };

const BASE = import.meta.env.BASE_URL;

/** Anything the board or a portrait frame can draw: a combatant or an NPC. */
export function hasArt(id: string): boolean {
  return HAS_ART.has(id) || HAS_NPC_ART.has(id);
}

/** Location backdrops for adventure scenes; falls back to a themed glyph card. */
export function hasSceneArt(id: string | undefined): boolean {
  return !!id && HAS_SCENE_ART.has(id);
}

export function sceneArtUrl(id: string): string {
  return `${BASE}art/scene-${id}.webp`;
}

/** Map-node tokens; a node without one falls back to the token's emoji. */
export function hasTokenArt(id: string | undefined): boolean {
  return !!id && HAS_TOKEN_ART.has(id);
}

export function tokenUrl(id: string): string {
  return `${BASE}art/token-${id}.webp`;
}

export function portraitUrl(id: string): string {
  return `${BASE}art/portrait-${id}.webp`;
}

/** Action bar / spell tray / prepare lists; falls back to the spell's emoji. */
export function hasSpellIcon(spellId: string | undefined): boolean {
  return !!spellId && HAS_SPELL_ICON.has(spellId);
}
export function spellIconUrl(spellId: string): string {
  return `${BASE}art/icon-${spellId}.webp`;
}

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
  'dust-mephit': 0.8, 'ice-mephit': 0.8,
  'magma-mephit': 0.8, 'steam-mephit': 0.8,
  succubus: 1.0, 'bearded-devil': 1.1, 'night-hag': 1.05,
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
