import type { CreatureSize } from '../../src/engine/types.js';
import { bandedScale } from '../../src/data/token-size.js';
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
  HAS_TERRAIN_ART,
} from './art-registry.js';
import { LQIP } from './art-lqip.js';
// Why every URL below is absolute, and what broke when they were not: assetUrl.ts.
import { assetUrl as asset } from './assetUrl.js';

export {
  HAS_ART, HAS_NPC_ART, HAS_SCENE_ART, HAS_TOKEN_ART, HAS_SPELL_ICON, HAS_BOARD_BG,
  HAS_TERRAIN_ART,
};

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
  return asset(`${BASE}art/scene-${id}.webp`);
}

/** Map-node tokens; a node without one falls back to the token's emoji. */
export function hasTokenArt(id: string | undefined): boolean {
  return !!id && HAS_TOKEN_ART.has(id);
}

export function tokenUrl(id: string): string {
  return asset(`${BASE}art/token-${id}.webp`);
}

export function portraitUrl(id: string): string {
  return asset(`${BASE}art/portrait-${id}.webp`);
}

/**
 * A drawn blocking prop: `terrain-wall-stone-a`, `terrain-cover-bog-b`, …
 *
 * SVG rather than webp, because these are vector-drawn rather than generated
 * and so need no raster pipeline — which also means they stay crisp at every
 * cell size the board can be, from a 34px phone tile upward.
 */
export function terrainUrl(kind: 'wall' | 'cover', theme: string, variant: 'a' | 'b'): string {
  return asset(`${BASE}art/terrain/terrain-${kind}-${theme}-${variant}.svg`);
}

/** Action bar / spell tray / prepare lists; falls back to the spell's emoji. */
export function hasSpellIcon(spellId: string | undefined): boolean {
  return !!spellId && HAS_SPELL_ICON.has(spellId);
}
export function spellIconUrl(spellId: string): string {
  return asset(`${BASE}art/icon-${spellId}.webp`);
}

export function boardBgUrl(theme: string): string {
  return asset(`${BASE}art/bg-${theme}.webp`);
}

/**
 * The small derivative of a cover image, for the launch screen's mode cards.
 *
 * The cards paint a backdrop in a band 150px tall. Serving the full-size art
 * there cost 364 KB on the very first screen of the app — more than the tokens
 * and portraits of an entire fight — and on a slow connection it was ahead of
 * them in the queue. `art/make_thumbs.py` writes a 480x270 crop of every scene
 * and board backdrop; this addresses it.
 *
 * Takes a full art URL rather than an id because the two cover families are
 * named differently (`scene-<id>`, `bg-<theme>`) and the caller already has the
 * URL it would otherwise have used. Every thumb is generated from the file it
 * shadows, and `make_thumbs.py --check` is what keeps that true.
 */
export function thumbUrl(fullUrl: string): string {
  return asset(`${BASE}art/thumb/thumb-${fileOf(fullUrl)}`);
}

function fileOf(fullUrl: string): string {
  return fullUrl.slice(fullUrl.lastIndexOf('/') + 1);
}

/**
 * A `background-image` that shows something the instant the element exists.
 *
 * The backdrops are the heaviest single images in the game — `bg-graveyard` is
 * 212 KB — and where they belong, behind the board and behind an adventure
 * scene, they have to stay that size. On a slow connection that used to be a
 * flat dark panel for twenty seconds where a painting should be.
 *
 * Two stacked layers, full-size on top of the inlined 32px placeholder. The
 * browser paints each layer as it becomes available and the placeholder is a
 * data URI, so it is available immediately: the frame fills with an
 * out-of-focus version of the right picture and sharpens when the real one
 * lands. No load handler, no second element, no state — the whole thing is one
 * CSS declaration, which is why it works identically for the board (a style
 * object) and for the scene backdrops (a div).
 *
 * Falls back to the plain URL for anything without a placeholder, so a new
 * backdrop that has not been through `make_thumbs.py` still renders.
 */
export function backdropLayers(fullUrl: string): string {
  const small = LQIP[fileOf(fullUrl)];
  return small ? `url(${fullUrl}), url(${small})` : `url(${fullUrl})`;
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

export function tokenScale(id: string, size?: CreatureSize): number {
  // The hand table above is an artist's tweak; `bandedScale` is the rule that
  // stops it drifting until size stops meaning anything. See data/token-size.ts.
  return bandedScale(SCALE[id] ?? 1, size);
}
