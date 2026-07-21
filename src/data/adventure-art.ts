/**
 * The reusable adventure-art vocabulary: a fixed set of **location types** and
 * **NPC archetypes** that any module composes, rather than one-off art per
 * scene. A tavern is a tavern in every adventure; a bandit is a bandit. Keying
 * art to categories (the same bet as one backdrop per combat theme) keeps the
 * generated set small and every future module art-complete for free.
 *
 * Each entry carries an emoji fallback, so a scene renders meaningfully even
 * before (or without) the generated image — the same "art absent → graceful
 * fallback" contract as `web/src/art.ts`. Generation briefs live in
 * `art/adventure-prompts.md`, keyed by these same ids.
 */

export interface ArtEntry {
  id: string;
  /** Short human label (shown in tooling; not the render). */
  label: string;
  /** Fallback glyph rendered until the image exists. */
  emoji: string;
}

/**
 * Location scenes — wide painterly backdrops behind story/dialogue/check
 * panels and explore maps. One per setting *type*, reused across modules.
 */
export const LOCATION_ART: Record<string, ArtEntry> = {
  'loc-village': { id: 'loc-village', label: 'Village square', emoji: '🏘️' },
  'loc-town': { id: 'loc-town', label: 'Town street', emoji: '🏙️' },
  'loc-tavern': { id: 'loc-tavern', label: 'Tavern interior', emoji: '🍺' },
  'loc-market': { id: 'loc-market', label: 'Market stalls', emoji: '🛒' },
  'loc-road': { id: 'loc-road', label: 'Country road', emoji: '🛤️' },
  'loc-crossroads': { id: 'loc-crossroads', label: 'Crossroads', emoji: '🪧' },
  'loc-field': { id: 'loc-field', label: 'Open plains', emoji: '🌾' },
  'loc-forest': { id: 'loc-forest', label: 'Woodland', emoji: '🌲' },
  'loc-marsh': { id: 'loc-marsh', label: 'Marsh', emoji: '🌫️' },
  'loc-river': { id: 'loc-river', label: 'River crossing', emoji: '🏞️' },
  'loc-hills': { id: 'loc-hills', label: 'Highland moor', emoji: '⛰️' },
  'loc-mountain': { id: 'loc-mountain', label: 'Mountain pass', emoji: '🏔️' },
  'loc-coast': { id: 'loc-coast', label: 'Coast & docks', emoji: '⛵' },
  'loc-cave': { id: 'loc-cave', label: 'Cavern', emoji: '🕳️' },
  'loc-dungeon': { id: 'loc-dungeon', label: 'Stone dungeon', emoji: '🔦' },
  'loc-ruins': { id: 'loc-ruins', label: 'Ancient ruins', emoji: '🏛️' },
  'loc-crypt': { id: 'loc-crypt', label: 'Crypt', emoji: '⚰️' },
  'loc-camp': { id: 'loc-camp', label: 'Raider camp', emoji: '🏕️' },
  'loc-keep': { id: 'loc-keep', label: 'Fortress hall', emoji: '🏰' },
  'loc-temple': { id: 'loc-temple', label: 'Temple', emoji: '⛩️' },
  'loc-throne': { id: 'loc-throne', label: 'Warlord hall', emoji: '👑' },
  'loc-throne-elf': { id: 'loc-throne-elf', label: 'Elven throne room', emoji: '🌿' },
  'loc-throne-dwarf': { id: 'loc-throne-dwarf', label: 'Dwarven throne hall', emoji: '💎' },
  'loc-throne-evil': { id: 'loc-throne-evil', label: 'Dark emperor hall', emoji: '💀' },
};

/**
 * NPC archetype portraits — chibi busts in the existing character style
 * (`art/prompts.md`). Reused for every module's innkeeper, guard, bandit, etc.
 */
export const NPC_ART: Record<string, ArtEntry> = {
  'npc-innkeeper': { id: 'npc-innkeeper', label: 'Innkeeper', emoji: '🍺' },
  'npc-elder': { id: 'npc-elder', label: 'Village elder / reeve', emoji: '🧓' },
  'npc-merchant': { id: 'npc-merchant', label: 'Merchant / peddler', emoji: '💰' },
  'npc-guard': { id: 'npc-guard', label: 'Town guard', emoji: '💂' },
  'npc-scout': { id: 'npc-scout', label: 'Scout / ranger', emoji: '🏹' },
  'npc-commoner': { id: 'npc-commoner', label: 'Commoner / farmer', emoji: '🧑‍🌾' },
  'npc-child': { id: 'npc-child', label: 'Child', emoji: '🧒' },
  'npc-noble': { id: 'npc-noble', label: 'Noble', emoji: '🤴' },
  'npc-priest': { id: 'npc-priest', label: 'Priest / acolyte', emoji: '🧎' },
  'npc-sage': { id: 'npc-sage', label: 'Sage / scholar', emoji: '📚' },
  'npc-stranger': { id: 'npc-stranger', label: 'Hooded stranger', emoji: '🧙' },
  'npc-wounded': { id: 'npc-wounded', label: 'Wounded person', emoji: '🤕' },
  'npc-bandit': { id: 'npc-bandit', label: 'Bandit / raider', emoji: '🥸' },
  'npc-captain': { id: 'npc-captain', label: 'Bandit captain / warlord', emoji: '🗡️' },
  'npc-cultist': { id: 'npc-cultist', label: 'Cultist', emoji: '🕯️' },
  'npc-barbarian': { id: 'npc-barbarian', label: 'Tribal warrior', emoji: '🪓' },
};

/**
 * Map-node tokens — the circular markers on an explore map. One per *kind of
 * place or beat* (a tavern, a cave mouth, a set of tracks, a danger), reused
 * across modules and drawn as painterly circular miniatures that sit *on* the
 * backdrop rather than floating over it. A node's `icon` names one of these;
 * an unknown `icon` is treated as a raw emoji (back-compat), and the emoji here
 * is the fallback until the token art is generated.
 */
export const NODE_TOKENS: Record<string, ArtEntry> = {
  // settlement
  'tok-tavern': { id: 'tok-tavern', label: 'Inn / tavern', emoji: '🍺' },
  'tok-market': { id: 'tok-market', label: 'Market / shop', emoji: '🛒' },
  'tok-notice': { id: 'tok-notice', label: 'Notice board', emoji: '📜' },
  'tok-gate': { id: 'tok-gate', label: 'Gate / way out', emoji: '🚪' },
  'tok-well': { id: 'tok-well', label: 'Well / fountain', emoji: '⛲' },
  'tok-house': { id: 'tok-house', label: 'Dwelling', emoji: '🏠' },
  'tok-temple': { id: 'tok-temple', label: 'Shrine / temple', emoji: '⛩️' },
  // wilderness
  'tok-camp': { id: 'tok-camp', label: 'Campsite', emoji: '🏕️' },
  'tok-cave': { id: 'tok-cave', label: 'Cave mouth', emoji: '🕳️' },
  'tok-ruin': { id: 'tok-ruin', label: 'Ruin', emoji: '🏛️' },
  'tok-bridge': { id: 'tok-bridge', label: 'Bridge / crossing', emoji: '🌉' },
  'tok-crossing': { id: 'tok-crossing', label: 'Ford / rough ground', emoji: '🪨' },
  'tok-lookout': { id: 'tok-lookout', label: 'Vantage / lookout', emoji: '🔭' },
  'tok-tracks': { id: 'tok-tracks', label: 'Tracks / trail sign', emoji: '👣' },
  'tok-tree': { id: 'tok-tree', label: 'Landmark tree', emoji: '🌳' },
  // people & beats
  'tok-person': { id: 'tok-person', label: 'Someone in need / met', emoji: '🆘' },
  'tok-figure': { id: 'tok-figure', label: 'Watched figure', emoji: '🕵️' },
  'tok-danger': { id: 'tok-danger', label: 'Danger / foes', emoji: '⚔️' },
  'tok-treasure': { id: 'tok-treasure', label: 'Cache / loot', emoji: '📦' },
  'tok-fire': { id: 'tok-fire', label: 'Fire / forge', emoji: '🔥' },
  'tok-boss': { id: 'tok-boss', label: 'Boss / throne', emoji: '👑' },
  'tok-mystery': { id: 'tok-mystery', label: 'Unknown', emoji: '❓' },
};

export function isNodeToken(id: string | undefined): boolean {
  return !!id && id in NODE_TOKENS;
}
/** Fallback glyph for a node's `icon`: a token's emoji, or the raw icon string
 *  (back-compat for modules that put an emoji directly). */
export function nodeEmoji(icon: string): string {
  return NODE_TOKENS[icon]?.emoji ?? icon;
}
export const NODE_TOKEN_IDS = Object.keys(NODE_TOKENS);

export function isLocationArt(id: string | undefined): boolean {
  return !!id && id in LOCATION_ART;
}
export function isNpcArt(id: string | undefined): boolean {
  return !!id && id in NPC_ART;
}

/** Fallback glyph for any known art id (location or NPC), or undefined. */
export function artEmoji(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return (LOCATION_ART[id] ?? NPC_ART[id])?.emoji;
}

export const LOCATION_ART_IDS = Object.keys(LOCATION_ART);
export const NPC_ART_IDS = Object.keys(NPC_ART);
