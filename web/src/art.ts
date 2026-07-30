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

export { tokenScale } from './token-scale.js';

