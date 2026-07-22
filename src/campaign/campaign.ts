/**
 * Campaign layer: a persistent party (gold, level, per-character gear) that
 * plays an encounter ladder, shops between battles, and collects loot.
 * Pure logic — the CLI owns all I/O; save/load lives in save.ts.
 *
 * The combat engine knows nothing about gold: the campaign builds Combatants
 * (via the builder's gear overrides) before a battle and reads surviving
 * inventory back afterwards.
 */
import { HERO_NAMES, defaultNameFor } from '../builder/names.js';
import type { Id, Combatant, ItemStack, TeamId, Ability } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import {
  buildCharacter, assignStats,
  availableLeveledSpells, classCantrips, classRituals, cantripsKnownCount, spellbookSize, preparedCount,
} from '../builder/character.js';
import { SPELLS } from '../data/spells.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR, SHIELD_COST, SHIELD_PLUS1_COST, isShield } from '../data/armor.js';
import { VALUABLES } from '../data/valuables.js';
import { TRINKETS } from '../data/trinkets.js';
import { FEATURES } from '../data/features.js';
import { CLASSES, SkillId, SKILL_ABILITY } from '../data/classes.js';
import { backgroundSkills } from '../data/backgrounds.js';
import { SPECIES } from '../data/species.js';
import { encounterXP, encounterCoinXP } from '../data/monsters.js';
import type { Rarity } from '../data/armor.js';
import { rollDice } from '../engine/dice.js';
import { RngState, next, seedRng, rollDie } from '../engine/rng.js';

export interface PartyCharacter {
  classId: Id;
  speciesId: Id;
  name: string;
  portraitId: Id;
  /** Mutable adventuring state. Missing means a fully rested legacy save. */
  resources?: {
    hp: number;
    /** Remaining spell slots, index 0 = 1st-level. Absent = full — a fresh
     *  save, a non-caster, or a caster since their last long rest. */
    slots?: number[];
    /** Hit dice left to spend on a short rest. Absent = a full pool (= level).
     *  A long rest restores half; a short rest spends them to heal. */
    hitDice?: number;
    effects?: {
      familiar?: { kind: 'owl' };
      mageArmor?: true;
    };
  };
  /**
   * The leveled spells this caster has *prepared* (castable), a subset of what
   * it knows. Absent = the auto-default. Capped at `preparedByLevel`.
   */
  prepared?: Id[];
  /** The cantrips this caster knows, chosen from the class cantrip pool.
   *  Absent = the auto-default. Capped at `cantripsKnownByLevel`. Always
   *  prepared. */
  cantrips?: Id[];
  /** Wizard only: the chosen base spellbook (leveled spells known), from the
   *  class list, capped at `spellbookByLevel`. Absent = the auto-default. A
   *  cleric ignores this (it knows its whole list). */
  spellbook?: Id[];
  /** Wizard only: extra spells scribed from scrolls, added to what it knows on
   *  top of the base spellbook (may include off-list spells like Ray of
   *  Sickness). Absent = none scribed. */
  scribedSpells?: Id[];
  inventory: ItemStack[];
  equipped: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id; trinket?: Id };
  /** Selected build options per choice-point id (Fighting Style, …). */
  choices?: Record<Id, Id>;
  /** Background id — grants two skill proficiencies (see data/backgrounds.ts).
   *  Absent = none (legacy saves, skirmish parties). */
  backgroundId?: Id;
}

export interface CampaignState {
  gold: number;
  /** Accumulated party XP (per-character pace: encounter XP / party size). */
  xp: number;
  /** Index into STAGES of the next battle. */
  stage: number;
  characters: PartyCharacter[];
  /** Shared party loot: where treasure drops land and unassigned gear waits.
   *  Optional so legacy saves (no field) load fine and are treated as empty. */
  stash?: ItemStack[];
  /** Battles won, for flavor/records. */
  victories: string[];
  /** The initial party identity setup has been confirmed. */
  partyReady: boolean;
  /** Story mode: gentler enemy AI, and a defeat retries the fight instead of
   * ending the campaign (kid-friendly). Normal mode keeps permadeath. */
  storyMode: boolean;
  /** RNG state for out-of-combat rolls (skill checks); persisted for replays. */
  rng: RngState;
  /**
   * Once-per-visit shop flags, persisted so a page refresh can't retry a
   * steal. Cleared by applyVictory; keyed to a stage for safety.
   */
  shopVisit?: {
    stage: number;
    stealUsed: boolean;
    haggleUsed: boolean;
    banned: boolean;
    priceMult: number;
  };
}

export function shopVisitFor(c: CampaignState): NonNullable<CampaignState['shopVisit']> {
  if (!c.shopVisit || c.shopVisit.stage !== c.stage) {
    c.shopVisit = { stage: c.stage, stealUsed: false, haggleUsed: false, banned: false, priceMult: 1 };
  }
  return c.shopVisit;
}

/** Parse + minimally validate a serialized campaign. */
/** Item ids retired from the game, remapped to their replacement on load. */
const RETIRED_ITEMS: Record<Id, Id> = { 'scroll-cure-wounds': 'potion-healing' };

/** Replace any retired item ids in a stack list, merging quantities. */
function migrateRetiredItems(inv: ItemStack[] | undefined): ItemStack[] {
  const out: ItemStack[] = [];
  for (const s of inv ?? []) addItem(out, RETIRED_ITEMS[s.itemId] ?? s.itemId, s.qty);
  return out;
}

export function parseCampaign(json: string): CampaignState | undefined {
  try {
    const raw = JSON.parse(json) as CampaignState;
    if (typeof raw.gold !== 'number' || !Array.isArray(raw.characters)) return undefined;
    if (typeof raw.rng !== 'number') raw.rng = 1; // pre-skills saves
    for (const character of raw.characters) {
      character.speciesId ??= 'human';
      character.portraitId ??= character.classId;
      // Scroll of Cure Wounds was retired (it duplicated healing potions); a
      // save still holding one would carry a dead, unusable item, so trade each
      // for the potion it doubled.
      character.inventory = migrateRetiredItems(character.inventory);
      // Saves from before characters had names carry the class as the name, so
      // the game announces "Wizard is down" instead of "Morgana Le Fey is down".
      // A name that is exactly the class name was never chosen, it was the old
      // default — upgrade it. (Deliberately naming your wizard "Wizard" is a
      // price worth paying to fix every save that predates the feature.)
      if (!character.name || character.name === CLASSES[character.classId]?.name) {
        character.name = defaultNameFor(character.classId);
      }
    }
    if (raw.stash) raw.stash = migrateRetiredItems(raw.stash);
    // Existing campaigns already passed the original setup screen.
    if (typeof raw.partyReady !== 'boolean') raw.partyReady = true;
    if (typeof raw.storyMode !== 'boolean') raw.storyMode = false; // old saves = normal
    // Pre-XP saves: seed XP so the party doesn't de-level — sum the XP they
    // would have earned reaching their current stage on the new ladder.
    if (typeof raw.xp !== 'number') {
      const size = raw.characters.length || 4;
      let xp = 0;
      for (let i = 0; i < Math.min(raw.stage, STAGES.length); i++) {
        xp += xpAward(STAGES[i]!.encounterId, size);
      }
      raw.xp = xp;
    }
    return raw;
  } catch {
    return undefined;
  }
}

export interface StageData {
  encounterId: Id;
  mapId: string;
}

/**
 * The ladder, ordered easy → hard. Party level and treasure are *derived*
 * from encounter XP (see levelForXp / treasureFor), so a stage is just which
 * fight, on which map. Ordering by ascending XP gives the gradual ramp: the
 * party accumulates XP and levels up (1 → 2 around stage 5, 2 → 3 around
 * stage 9) across the run.
 */
export const STAGES: StageData[] = [
  { encounterId: 'kobolds', mapId: 'ruins' },   // 150
  { encounterId: 'wolves', mapId: 'marsh' },    // 250
  { encounterId: 'undead', mapId: 'corridor' }, // 250
  { encounterId: 'goblins', mapId: 'ruins' },   // 400  → L2 around here
  { encounterId: 'raiders', mapId: 'open' },    // 425
  { encounterId: 'wilds', mapId: 'marsh' },     // 500
  { encounterId: 'bandits', mapId: 'open' },    // 550
  { encounterId: 'crypt', mapId: 'corridor' },  // 550  → L3 around here
  { encounterId: 'spiders', mapId: 'marsh' },   // 800
  { encounterId: 'cult', mapId: 'ruins' },      // 1100
  { encounterId: 'ogre', mapId: 'firepit' },    // 550  → L4 around here
  { encounterId: 'knights', mapId: 'open' },    // 925
  { encounterId: 'labyrinth', mapId: 'corridor' }, // 775  → L5 around here
  { encounterId: 'giants', mapId: 'firepit' },  // 1650, L5 boss finale
];

// --- XP & leveling ---------------------------------------------------------

/** XP thresholds by level (index = level − 1); capped at our content's L5.
 *  Tuned to the /party-size award so a full ladder run reaches L4 at the ogre
 *  and L5 just before the giants finale (fighting the boss at full L5 power). */
export const LEVEL_XP = [0, 300, 900, 2700, 6500] as const;
export const MAX_LEVEL = LEVEL_XP.length;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]!) level = i + 1;
  return level;
}

export function partyLevelOf(c: CampaignState): number {
  return levelForXp(c.xp);
}

/** XP awarded for beating an encounter (per-character pace = total / party size). */
export function xpAward(encounterId: Id, partySize: number): number {
  return Math.round(encounterXP(encounterId) / Math.max(1, partySize));
}

// --- treasure generation ---------------------------------------------------

/**
 * Item pools by rarity. Bigger fights unlock higher tiers and roll more times,
 * so treasure scales with encounter XP without any per-stage authoring.
 */
const TREASURE_POOL: Record<Rarity, Id[]> = {
  common: [
    'potion-healing', 'alchemists-fire', 'scroll-magic-missile', 'scroll-burning-hands',
    'scroll-command', 'scroll-guiding-bolt', 'scroll-color-spray', 'scroll-bane', 'scroll-shield-of-faith',
    'chain-shirt',
    'handaxe', 'spear', 'morningstar',
    'gem-quartz', 'gem-moss-agate', 'gem-onyx', 'gem-carnelian',
    'jewelry-wooden-bracer', 'jewelry-brass-ring', 'jewelry-bronze-figurine', 'jewelry-obsidian-necklace',
  ],
  uncommon: [
    'potion-greater-healing', 'greatsword', 'longbow', 'scale-mail',
    'rapier', 'warhammer', 'battleaxe', 'scroll-web', 'scroll-scorching-ray', 'scroll-hold-person',
    'scroll-ray-of-sickness', 'scroll-blindness', 'scroll-invisibility',
    'potion-fire-resistance', 'potion-poison-resistance', 'potion-cold-resistance', 'potion-acid-resistance',
    'potion-giant-strength-hill',
    'adamantine-scale-mail', 'adamantine-half-plate', 'adamantine-chain-mail', 'adamantine-splint',
    'gauntlets-ogre-power', 'headband-intellect', 'cloak-protection', 'brooch-shielding',
    'bracers-archery', 'boots-winterlands', 'gloves-thievery',
    'gem-amber', 'gem-garnet', 'gem-amethyst',
    'jewelry-iron-bracer', 'jewelry-steel-ring', 'jewelry-silver-necklace',
  ],
  rare: [
    'half-plate', 'splint', 'longsword-plus1', 'shortsword-plus1',
    'greatsword-plus1', 'longbow-plus1', 'warhammer-plus1', 'rapier-plus1',
    'scale-mail-plus1', 'half-plate-plus1', 'splint-plus1', 'shield-plus1',
    'scroll-fireball', 'scroll-lightning-bolt', 'scroll-dispel-magic', 'scroll-haste',
    'potion-giant-strength-frost',
    'moontouched-shortsword', 'moontouched-warhammer',
    'gem-topaz', 'gem-sapphire', 'gem-diamond',
    'jewelry-gold-figurine', 'jewelry-gold-necklace', 'jewelry-dwarven-ring',
  ],
};

/**
 * How rare a loot item is. The pools are the authority — a longsword+1 is rare
 * because it drops from the rare table, and WEAPONS has no rarity of its own —
 * so ask them first, checking best-first so anything listed twice reads high.
 */
export function rarityOf(itemId: Id): Rarity {
  for (const r of ['rare', 'uncommon', 'common'] as const) {
    if (TREASURE_POOL[r].includes(itemId)) return r;
  }
  return ITEMS[itemId]?.rarity ?? ARMOR[itemId]?.rarity ?? VALUABLES[itemId]?.rarity ?? TRINKETS[itemId]?.rarity ??
    (itemId === 'shield-plus1' ? 'rare' : 'common');
}

function pick<T>(arr: T[], r: number): T {
  return arr[Math.floor(r * arr.length)]!;
}

export interface Treasure {
  gold: number;
  items: ItemStack[];
  rng: RngState;
}

/**
 * Generate treasure from encounter XP. Coin and item drops come from the
 * loot-bearing share of the fight (`coinXp`, default = full `xp`): gold ≈
 * coinXp × 0.3 with variance, and the number of item rolls scales by how much of
 * the encounter actually carries loot — so a pack of beasts yields XP but no
 * purse or gear, while a bandit camp pays out in full. The rarity ceiling still
 * rises with the total `xp` (how dangerous the fight was). `bonusTier` forces
 * one guaranteed drop of that tier (used for the finale). Deterministic.
 */
export function treasureFor(xp: number, rng: RngState, bonusTier?: Rarity, coinXp: number = xp): Treasure {
  let state = rng;
  const roll = () => { const r = next(state); state = r.state; return r.value; };

  // Coin comes only from loot-bearers; the fraction also gates how many item
  // rolls the fight earns (all-beast → 0 → gear/gems can't drop either).
  const lootFraction = xp > 0 ? Math.max(0, Math.min(1, coinXp / xp)) : 0;
  const gold = Math.round(coinXp * 0.3 * (0.8 + 0.4 * roll()));

  const baseRolls = xp >= 700 ? 3 : xp >= 300 ? 2 : 1;
  const rolls = Math.round(baseRolls * lootFraction);
  const tiers: Rarity[] = xp >= 800 ? ['common', 'uncommon', 'rare']
    : xp >= 400 ? ['common', 'uncommon'] : ['common'];

  const items: ItemStack[] = [];
  const add = (itemId: Id) => {
    const s = items.find((x) => x.itemId === itemId);
    if (s) s.qty += 1; else items.push({ itemId, qty: 1 });
  };

  for (let i = 0; i < rolls; i++) {
    // Weight toward common; occasional step up a tier when unlocked.
    const t = roll();
    const tierIdx = tiers.length === 1 ? 0
      : t < 0.6 ? 0 : t < 0.9 ? Math.min(1, tiers.length - 1) : tiers.length - 1;
    add(pick(TREASURE_POOL[tiers[tierIdx]!], roll()));
  }
  if (bonusTier) add(pick(TREASURE_POOL[bonusTier], roll()));

  return { gold, items, rng: state };
}

export const STARTING_GOLD = 100;

/** What the shop sells between battles. */
export const SHOP_STOCK: Id[] = [
  // consumables
  'potion-healing', 'potion-greater-healing', 'alchemists-fire',
  'scroll-magic-missile', 'scroll-burning-hands', 'scroll-command', 'scroll-guiding-bolt',
  'scroll-web', 'scroll-scorching-ray', 'scroll-hold-person', 'scroll-fireball', 'scroll-lightning-bolt',
  'scroll-ray-of-sickness', 'scroll-color-spray', 'scroll-bane', 'scroll-shield-of-faith',
  'scroll-blindness', 'scroll-invisibility', 'scroll-dispel-magic', 'scroll-haste',
  'potion-fire-resistance', 'potion-poison-resistance', 'potion-cold-resistance', 'potion-acid-resistance',
  'potion-giant-strength-hill',
  // weapons
  'dagger', 'handaxe', 'spear', 'rapier', 'warhammer', 'battleaxe', 'morningstar',
  'greatsword', 'longbow', 'longsword-plus1', 'shortsword-plus1',
  'greatsword-plus1', 'longbow-plus1', 'warhammer-plus1', 'rapier-plus1',
  'moontouched-shortsword', 'moontouched-warhammer',
  // armor
  'leather', 'chain-shirt', 'half-plate', 'splint',
  'adamantine-scale-mail', 'adamantine-half-plate', 'adamantine-splint',
  'scale-mail-plus1', 'half-plate-plus1', 'splint-plus1', 'shield-plus1',
  // trinkets
  'gauntlets-ogre-power', 'headband-intellect', 'cloak-protection', 'brooch-shielding',
  'bracers-archery', 'boots-winterlands', 'gloves-thievery',
];

export function itemName(itemId: Id): string {
  return ITEMS[itemId]?.name ?? WEAPONS[itemId]?.name ?? ARMOR[itemId]?.name ?? VALUABLES[itemId]?.name ??
    TRINKETS[itemId]?.name ??
    (itemId === 'shield' ? 'Shield' : itemId === 'shield-plus1' ? 'Shield +1' : itemId);
}

/** A small emoji icon for an item, so the shop/inventory read visually. */
export function itemIcon(itemId: Id): string {
  if (itemId === 'shield') return '🛡️';
  if (itemId === 'shield-plus1') return '🛡️';
  if (TRINKETS[itemId]) return TRINKETS[itemId]!.icon;
  if (ITEMS[itemId]) {
    if (itemId.includes('potion')) return '🧪';
    if (itemId.includes('scroll')) return '📜';
    if (itemId.includes('fire')) return '🔥';
    return '✨';
  }
  const w = WEAPONS[itemId];
  if (w) {
    if (w.magic) return '🌙';
    if (itemId.endsWith('plus1')) return '🌟';
    if (w.range && !w.melee) return '🏹';
    return '⚔️';
  }
  if (ARMOR[itemId]) return '🥋';
  if (VALUABLES[itemId]) return VALUABLES[itemId]!.icon;
  return '📦';
}

export type ItemCategory = 'weapon' | 'armor' | 'potion' | 'scroll' | 'trinket' | 'other';

/** A coarse shop-shelf bucket for an item, so a long stock list can be filtered
 *  by kind (weapons / armor / potions / scrolls / trinkets). Consumables that
 *  aren't scrolls land in 'potion' (the flasks-and-vials shelf). */
export function itemCategory(itemId: Id): ItemCategory {
  if (itemId === 'shield' || itemId === 'shield-plus1') return 'armor';
  if (TRINKETS[itemId]) return 'trinket';
  if (ITEMS[itemId]) return itemId.includes('scroll') ? 'scroll' : 'potion';
  if (WEAPONS[itemId]) return 'weapon';
  if (ARMOR[itemId]) return 'armor';
  return 'other';
}

/** Re-exported so callers don't reach past this layer for a party's names. */
export { HERO_NAMES as DEFAULT_NAMES, defaultNameFor };

/**
 * The portrait a species wears by default. Each maps to its dedicated art
 * (see web PORTRAITS); a species without one — human — falls back to the class
 * portrait, which is what the four class images depict. Keep in sync with the
 * web portrait registry.
 */
const SPECIES_PORTRAIT: Partial<Record<Id, Id>> = {
  dwarf: 'dwarf-berserker', elf: 'elf-archer', orc: 'orc-barbarian',
  dragonborn: 'dragonborn-paladin', tiefling: 'tiefling-warlock',
  gnome: 'gnome-bard', halfling: 'halfling-rogue',
};

/**
 * Ranger and Paladin have no dedicated class portrait (unlike the original
 * four, whose class id *is* a portrait id) — they borrow the closest existing
 * art instead of going blank.
 */
const CLASS_PORTRAIT: Partial<Record<Id, Id>> = {
  ranger: 'elf-archer', paladin: 'dragonborn-paladin',
};

/** Sensible default portrait for a species/class combo: species art if it has
 *  its own, else the class portrait (or its stand-in). */
export function defaultPortraitFor(speciesId: Id, classId: Id): Id {
  return SPECIES_PORTRAIT[speciesId] ?? CLASS_PORTRAIT[classId] ?? classId;
}

export function newCampaign(seed = 1, speciesIds: Id[] = []): CampaignState {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  // Default backgrounds spread skill coverage across the four roles so an
  // adventure's varied scene checks land on different heroes.
  const defaultBackground: Record<Id, Id> = {
    fighter: 'soldier', wizard: 'sage', cleric: 'acolyte', rogue: 'criminal',
  };
  return {
    gold: STARTING_GOLD,
    xp: 0,
    stage: 0,
    stash: [],
    victories: [],
    partyReady: false,
    storyMode: true, // approachable default; toggled in the forge
    rng: seedRng(seed),
    characters: order.map((classId, index) => {
      const eq = CLASSES[classId]!.equipment;
      const speciesId = speciesIds[index] ?? 'human';
      return {
        classId,
        speciesId,
        name: defaultNameFor(classId),
        portraitId: defaultPortraitFor(speciesId, classId),
        ...(defaultBackground[classId] !== undefined ? { backgroundId: defaultBackground[classId] } : {}),
        inventory: eq.inventory.map((s) => ({ ...s })),
        equipped: {
          mainHand: eq.mainHand,
          ...(eq.offHand !== undefined ? { offHand: eq.offHand } : {}),
          ...(eq.armor !== undefined ? { armor: eq.armor } : {}),
        },
      };
    }),
  };
}

/**
 * Prebuilt parties for the forge's Quick Start shelf: a beginner taps one and
 * plays, never touching the editor. Each keys species/style/name by class, so a
 * template just overlays the fixed four-role party — the role model is untouched.
 * Fighter styles are limited to Dueling/Defense here because the default kit
 * (longsword + shield) is what makes the others (Archery, Great Weapon, Two-
 * Weapon) fire, and it has none of those weapons yet.
 */
export interface PartyTemplate {
  id: string;
  name: string;
  blurb: string;
  members: Partial<Record<Id, { speciesId: Id; style?: Id; name?: string }>>;
}

export const PARTY_TEMPLATES: PartyTemplate[] = [
  {
    id: 'classic', name: 'Classic Four', blurb: 'The balanced starting party — all human.',
    members: {
      fighter: { speciesId: 'human', style: 'dueling' },
      wizard: { speciesId: 'human' }, cleric: { speciesId: 'human' }, rogue: { speciesId: 'human' },
    },
  },
  {
    id: 'frontier', name: 'Frontier Band', blurb: 'Hardy and stealthy — a dwarf shield-wall and a halfling scout.',
    members: {
      fighter: { speciesId: 'dwarf', style: 'defense', name: 'Bruni' },
      wizard: { speciesId: 'elf', name: 'Faelar' },
      cleric: { speciesId: 'human', name: 'Mara' },
      rogue: { speciesId: 'halfling', name: 'Pip' },
    },
  },
  {
    id: 'bloodline', name: 'Strange Bloodlines', blurb: 'Exotic ancestries — draconic, infernal, and fey.',
    members: {
      fighter: { speciesId: 'dragonborn', style: 'dueling', name: 'Rhogar' },
      wizard: { speciesId: 'tiefling', name: 'Nemeia' },
      cleric: { speciesId: 'gnome', name: 'Fibblewick' },
      rogue: { speciesId: 'orc', name: 'Grazt' },
    },
  },
];

/** Overlay a template onto the current (pre-launch) party, keeping the four roles. */
export function applyPartyTemplate(c: CampaignState, templateId: string): boolean {
  const t = PARTY_TEMPLATES.find((x) => x.id === templateId);
  if (c.partyReady || !t) return false;
  for (const ch of c.characters) {
    const m = t.members[ch.classId];
    if (!m) continue;
    ch.speciesId = m.speciesId;
    ch.portraitId = defaultPortraitFor(m.speciesId, ch.classId);
    if (m.name) ch.name = m.name;
    if (m.style) ch.choices = { 'fighting-style': m.style };
    else delete ch.choices;
  }
  return true;
}

/** Randomize every member's species (and reset names/choices to defaults). */
export function randomizeParty(c: CampaignState): boolean {
  if (c.partyReady) return false;
  const speciesIds = Object.keys(SPECIES);
  for (const ch of c.characters) {
    const { value, state } = next(c.rng);
    c.rng = state;
    ch.speciesId = speciesIds[Math.floor(value * speciesIds.length)] ?? 'human';
    ch.portraitId = defaultPortraitFor(ch.speciesId, ch.classId);
    ch.name = defaultNameFor(ch.classId);
    delete ch.choices;
  }
  return true;
}

/**
 * Change a member's class during initial party creation. The four roles stay
 * unique, so choosing an occupied class swaps the two roles and their kits.
 */
export function setPartyClass(c: CampaignState, charIdx: number, classId: Id): boolean {
  if (c.partyReady || !CLASSES[classId] || !c.characters[charIdx]) return false;
  const character = c.characters[charIdx]!;
  const previousClassId = character.classId;
  const ownerIdx = c.characters.findIndex((ch, idx) => idx !== charIdx && ch.classId === classId);
  const applyClass = (target: PartyCharacter, nextClassId: Id) => {
    const equipment = CLASSES[nextClassId]!.equipment;
    // Carry the sample name along with the role, unless the player renamed it.
    if (target.name === defaultNameFor(target.classId)) target.name = defaultNameFor(nextClassId);
    // Let an un-customized portrait follow the class too (matters for humans,
    // whose portrait is the class image; species with their own art don't move).
    if (target.portraitId === defaultPortraitFor(target.speciesId, target.classId)) {
      target.portraitId = defaultPortraitFor(target.speciesId, nextClassId);
    }
    target.classId = nextClassId;
    // Fighting Style and other picks belong to the old class; drop them so the
    // new class resolves to its own defaults.
    delete target.choices;
    target.inventory = equipment.inventory.map((stack) => ({ ...stack }));
    target.equipped = {
      mainHand: equipment.mainHand,
      ...(equipment.offHand !== undefined ? { offHand: equipment.offHand } : {}),
      ...(equipment.armor !== undefined ? { armor: equipment.armor } : {}),
    };
  };
  if (ownerIdx >= 0) applyClass(c.characters[ownerIdx]!, previousClassId);
  applyClass(character, classId);
  return true;
}

/**
 * Change a member's species pre-launch. An un-customized portrait follows the
 * new species' default art; a hand-picked portrait is left alone.
 */
export function setPartySpecies(c: CampaignState, charIdx: number, speciesId: Id): boolean {
  if (c.partyReady || !SPECIES[speciesId] || !c.characters[charIdx]) return false;
  const character = c.characters[charIdx]!;
  if (character.portraitId === defaultPortraitFor(character.speciesId, character.classId)) {
    character.portraitId = defaultPortraitFor(speciesId, character.classId);
  }
  character.speciesId = speciesId;
  return true;
}

/** Record a build-choice pick (Fighting Style, …) for a party member, pre-launch. */
export function setPartyChoice(c: CampaignState, charIdx: number, pointId: Id, optionId: Id): boolean {
  if (c.partyReady || !c.characters[charIdx]) return false;
  const character = c.characters[charIdx]!;
  character.choices = { ...character.choices, [pointId]: optionId };
  return true;
}

export function currentStage(c: CampaignState): StageData | undefined {
  return STAGES[c.stage];
}

export function isComplete(c: CampaignState): boolean {
  return c.stage >= STAGES.length;
}

export function itemPrice(itemId: Id): number | undefined {
  if (itemId === 'shield') return SHIELD_COST;
  if (itemId === 'shield-plus1') return SHIELD_PLUS1_COST;
  return ITEMS[itemId]?.cost ?? WEAPONS[itemId]?.cost ?? ARMOR[itemId]?.cost ?? VALUABLES[itemId]?.cost ?? TRINKETS[itemId]?.cost;
}

export function addItem(inv: ItemStack[], itemId: Id, qty = 1): void {
  const stack = inv.find((s) => s.itemId === itemId);
  if (stack) stack.qty += qty;
  else inv.push({ itemId, qty });
}

/** Buy for a specific character. `priceOverride` supports haggled prices. */
export function buyItem(c: CampaignState, charIdx: number, itemId: Id, priceOverride?: number): boolean {
  const price = priceOverride ?? itemPrice(itemId);
  const ch = c.characters[charIdx];
  if (price === undefined || itemPrice(itemId) === undefined || !ch || c.gold < price) return false;
  c.gold -= price;
  addItem(ch.inventory, itemId);
  return true;
}

/** Sell from a character at half price. Returns false if they don't have it. */
export function sellItem(c: CampaignState, charIdx: number, itemId: Id): boolean {
  const price = itemPrice(itemId);
  const ch = c.characters[charIdx];
  const stack = ch?.inventory.find((s) => s.itemId === itemId && s.qty > 0);
  if (price === undefined || !ch || !stack) return false;
  stack.qty -= 1;
  if (stack.qty === 0) ch.inventory = ch.inventory.filter((s) => s !== stack);
  c.gold += Math.floor(price / 2);
  return true;
}

/** Build the party Combatants for the current stage (rank 0, standard files). */
export function buildCampaignParty(c: CampaignState, team: TeamId = 'team1'): Combatant[] {
  const level = partyLevelOf(c);
  const files = [1, 2, 4, 6];
  return c.characters.map((ch, i) => {
    const combatant = buildCharacter({
      classId: ch.classId, team, level,
      speciesId: ch.speciesId,
      name: ch.name,
      portraitId: ch.portraitId,
      position: { x: files[i]!, y: 0 },
      inventory: ch.inventory.map((s) => ({ ...s })),
      equipped: { ...ch.equipped },
      ...(ch.choices ? { choices: { ...ch.choices } } : {}),
      ...(ch.resources?.slots ? { spellSlotsOverride: ch.resources.slots } : {}),
      // Hand the builder the effective prepared + cantrip sets (hand-picked or
      // auto-default), so a campaign caster casts exactly what the panel shows.
      // Scribed off-list scrolls widen the builder's pool so those prepared
      // spells validate.
      preparedOverride: preparedSpells(c, i),
      cantripsOverride: knownCantrips(c, i),
      ...(ch.scribedSpells ? { spellbookExtra: ch.scribedSpells } : {}),
    });
    if (typeof ch.resources?.hp === 'number' && Number.isFinite(ch.resources.hp)) {
      combatant.hp = Math.max(0, Math.min(ch.resources.hp, combatant.maxHp));
    }
    if (ch.resources?.effects?.familiar) combatant.familiar = { kind: 'owl' };
    if (ch.resources?.effects?.mageArmor) combatant.mageArmor = true;
    return combatant;
  });
}

function setCampaignHp(ch: PartyCharacter, hp: number): void {
  ch.resources = { ...ch.resources, hp };
}

/**
 * Spend one spell slot of the given level (0 = 1st) from a caster's persisted
 * resources. Reads the caster's live-built `spellSlots` — correct whether or
 * not `resources.slots` was already set (a fresh save reads as fully rested) —
 * and writes the whole array back. Returns false, spending nothing, if none
 * remain: store casts (Cure Wounds, Mage Armor) share the same slot pool as
 * combat, since they're the same spell.
 */
function spendSlot(ch: PartyCharacter, caster: Combatant, slotLevelIdx: number): boolean {
  const current = caster.spellSlots[slotLevelIdx]?.current ?? 0;
  if (current <= 0) return false;
  const slots = caster.spellSlots.map((p, i) => (i === slotLevelIdx ? p.current - 1 : p.current));
  ch.resources = { ...ch.resources, hp: ch.resources?.hp ?? caster.hp, slots };
  return true;
}

export interface RestResult {
  totalHealed: number;
  /** How many hit dice the party spent (short rest only). */
  hitDiceSpent?: number;
}

/** A hero's pool of hit dice equals their level (the shared party level). */
export function hitDiceMax(c: CampaignState): number {
  return partyLevelOf(c);
}

/** Hit dice a hero has left to spend. Absent in `resources` = a full pool (a
 *  fresh save or a hero rested since their last short rest). */
export function hitDiceLeft(c: CampaignState, idx: number): number {
  const stored = c.characters[idx]?.resources?.hitDice;
  const max = hitDiceMax(c);
  return stored === undefined ? max : Math.max(0, Math.min(stored, max));
}

/**
 * Testing-friendly short rest: each hero recovers half their maximum HP.
 * Spell slots are untouched (matching 5e — only a long rest restores them);
 * `setCampaignHp` preserves whatever's in `resources.slots` unchanged.
 */
/** Heal every hero by `amount` HP (clamped to max), or 'full' for a long rest.
 *  Used by adventure `heal` effects and rest scenes. */
export function healParty(c: CampaignState, amount: number | 'full'): RestResult {
  if (amount === 'full') return longRest(c);
  let totalHealed = 0;
  const party = buildCampaignParty(c);
  for (const [index, combatant] of party.entries()) {
    const healed = Math.min(combatant.maxHp, combatant.hp + amount);
    totalHealed += healed - combatant.hp;
    setCampaignHp(c.characters[index]!, healed);
  }
  return { totalHealed };
}

/**
 * A short rest spends hit dice to heal — the 5e mechanic, applied
 * automatically and advantageously so the player never micromanages it. Each
 * die a hero spends rolls its class die + Con mod. The auto-spender keeps
 * spending only while the deficit is at least a die's average roll, so a hurt
 * hero heals up most of the way but never burns a whole die to top off a
 * couple of points. Spell slots are untouched (only a long rest restores
 * those). Hit dice themselves are refreshed by a long rest.
 */
export function shortRest(c: CampaignState): RestResult {
  let totalHealed = 0;
  let hitDiceSpent = 0;
  const party = buildCampaignParty(c);
  for (const [index, combatant] of party.entries()) {
    const ch = c.characters[index]!;
    const die = CLASSES[ch.classId]?.hitDie ?? 8;
    const conMod = abilityMod(combatant.abilities.con);
    // The average value of one die: the threshold below which spending a die
    // would waste most of its healing.
    const avgHeal = die / 2 + 0.5 + Math.max(0, conMod);
    let hp = combatant.hp;
    let left = hitDiceLeft(c, index);
    while (left > 0 && combatant.maxHp - hp >= avgHeal) {
      const roll = rollDie(c.rng, die);
      c.rng = roll.state;
      hp = Math.min(combatant.maxHp, hp + Math.max(1, roll.value + conMod));
      left -= 1;
      hitDiceSpent += 1;
    }
    totalHealed += hp - combatant.hp;
    ch.resources = { ...ch.resources, hp, hitDice: left };
  }
  return { totalHealed, hitDiceSpent };
}

/**
 * Testing-friendly long rest: each hero recovers all missing HP and every
 * spell slot (rebuilding `resources` from scratch drops any `slots` field,
 * and its absence means fully rested). Mage Armor also lapses on a long rest
 * in 5e, so it's dropped the same way; a familiar persists.
 */
export function longRest(c: CampaignState): RestResult {
  let totalHealed = 0;
  const party = buildCampaignParty(c);
  const max = hitDiceMax(c);
  for (const [index, combatant] of party.entries()) {
    totalHealed += combatant.maxHp - combatant.hp;
    const character = c.characters[index]!;
    // 5e: a long rest restores half your total hit dice (minimum 1) on top of
    // whatever's left. Leave the field absent when the pool is full — absent
    // means full, the same fresh-save signal used for HP and slots.
    const restored = Math.min(max, hitDiceLeft(c, index) + Math.max(1, Math.floor(max / 2)));
    character.resources = {
      hp: combatant.maxHp,
      ...(restored < max ? { hitDice: restored } : {}),
      ...(character.resources?.effects?.familiar ? { effects: { familiar: { kind: 'owl' } } } : {}),
    };
  }
  return { totalHealed };
}

/** Healing sources that can be used between battles from the store. */
export type StoreHealingSource =
  | 'potion-healing'
  | 'potion-greater-healing'
  | 'cure-wounds';

export function isStoreHealingSource(itemId: Id): itemId is StoreHealingSource {
  return itemId === 'potion-healing' || itemId === 'potion-greater-healing' ||
    itemId === 'cure-wounds';
}

export interface StoreHealingResult {
  rolled: number;
  healed: number;
}

export interface StoreSpellAction {
  spellId: Id;
  name: string;
  icon: string;
  targeting: 'party' | 'self';
  castLabel?: string;
  castNotice?: string;
  /** Cast as a ritual — no slot spent, so the UI never needs to grey it out
   *  for being out of slots. */
  ritual?: true;
}

const STORE_SPELL_ACTIONS: Record<Id, StoreSpellAction> = {
  'cure-wounds': { spellId: 'cure-wounds', name: 'Cure Wounds', icon: '💚', targeting: 'party' },
  'find-familiar': {
    spellId: 'find-familiar', name: 'Find Familiar', icon: '🦉', targeting: 'self',
    castLabel: 'Summon owl', castNotice: 'summons a tiny owl familiar', ritual: true,
  },
  'mage-armor': {
    spellId: 'mage-armor', name: 'Mage Armor', icon: '🛡️', targeting: 'self',
    castLabel: 'Ward self', castNotice: 'is protected by Mage Armor',
  },
};

/** Store spells are a curated subset of a combatant's known spells. */
export function storeSpellActions(combatant: Pick<Combatant, 'spellIds'>): StoreSpellAction[] {
  return combatant.spellIds.flatMap((spellId) => {
    const action = STORE_SPELL_ACTIONS[spellId];
    return action ? [action] : [];
  });
}

/** Cast a self-targeted spell during a store visit. */
export function useStoreSpell(c: CampaignState, userIdx: number, spellId: Id): boolean {
  const user = c.characters[userIdx];
  const caster = user ? buildCampaignParty(c)[userIdx] : undefined;
  const action = caster ? storeSpellActions(caster).find((candidate) => candidate.spellId === spellId) : undefined;
  if (!user || !caster || !action || action.targeting !== 'self') return false;
  if (spellId === 'find-familiar') {
    // A ritual in 5e: a wizard can cast it without spending a slot.
    user.resources = {
      hp: user.resources?.hp ?? caster.hp,
      effects: { ...user.resources?.effects, familiar: { kind: 'owl' } },
    };
    return true;
  }
  if (spellId === 'mage-armor') {
    const slotLevelIdx = SPELLS[spellId]!.level - 1;
    if (!spendSlot(user, caster, slotLevelIdx)) return false;
    user.resources = { ...user.resources, hp: user.resources?.hp ?? caster.hp, effects: { ...user.resources?.effects, mageArmor: true } };
    return true;
  }
  return false;
}

/**
 * Use a healing consumable or Cure Wounds during a store visit. Consumables
 * are spent; Cure Wounds shares its slot pool with combat, so a shop visit
 * can run a caster dry before the next fight — the same trade-off as casting
 * it mid-battle.
 */
export function useStoreHealing(
  c: CampaignState,
  userIdx: number,
  targetIdx: number,
  source: StoreHealingSource,
): StoreHealingResult | undefined {
  const user = c.characters[userIdx];
  const target = c.characters[targetIdx];
  if (!user || !target) return undefined;

  const party = buildCampaignParty(c);
  const caster = party[userIdx]!;
  const recipient = party[targetIdx]!;
  const item = source === 'cure-wounds' ? undefined : user.inventory.find((s) => s.itemId === source && s.qty > 0);
  const cureWoundsSlotIdx = SPELLS['cure-wounds']!.level - 1;
  if (source === 'cure-wounds') {
    if (!caster.spellIds.includes(source) || (caster.spellSlots[cureWoundsSlotIdx]?.current ?? 0) <= 0) return undefined;
  } else if (!item) {
    return undefined;
  }

  let dice = '2d4+2';
  let bonus = 0;
  if (source === 'potion-greater-healing') dice = '4d4+4';
  if (source === 'cure-wounds') {
    dice = '2d8';
    bonus = abilityMod(caster.abilities[caster.spellcastingAbility ?? 'int']) +
      (caster.featureIds.includes('disciple-of-life') ? 3 : 0);
  }

  const roll = rollDice(c.rng, dice);
  c.rng = roll.state;
  if (item) {
    item.qty -= 1;
    if (item.qty === 0) user.inventory = user.inventory.filter((s) => s !== item);
  }
  if (source === 'cure-wounds') spendSlot(user, caster, cureWoundsSlotIdx);
  const rolled = roll.total + bonus;
  const hp = Math.min(recipient.maxHp, recipient.hp + rolled);
  setCampaignHp(target, hp);
  return { rolled, healed: hp - recipient.hp };
}

// ---------------------------------------------------------------------------
// The 2024 three-tier spell model (classes.ts holds the per-level counts):
//   1. Cantrips known — chosen from the class cantrip list, always all prepared.
//   2. Known leveled — a wizard's *spellbook* (a chosen subset of its class
//      list that grows via scribed scrolls); a cleric knows its whole list.
//   3. Prepared — the castable subset of what's known.
// Each chosen set is stored on the PartyCharacter; absent means an auto-default
// (strongest first). Rituals (Find Familiar) are always known, counted nowhere.
// ---------------------------------------------------------------------------

/** Sort a spell pool strongest-first (highest spell level, then pool order),
 *  the order the auto-default fills from. */
function byStrength(pool: Id[]): Id[] {
  return [...pool].sort((a, b) => (SPELLS[b]?.level ?? 0) - (SPELLS[a]?.level ?? 0));
}

/** The auto-default set for a caster who hasn't hand-picked one: strongest
 *  spells first, trimmed to the limit. */
function defaultKnown(pool: Id[], limit: number): Id[] {
  return byStrength(pool).slice(0, limit);
}

// --- tier 1: cantrips ------------------------------------------------------

/** The cantrips this character can choose from. */
export function cantripPool(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch) return [];
  return classCantrips(ch.classId, partyLevelOf(c));
}

/** How many cantrips this character knows. 0 = non-caster / no cantrips. */
export function cantripLimit(c: CampaignState, charIdx: number): number {
  const ch = c.characters[charIdx];
  if (!ch || !CLASSES[ch.classId]?.spellcasting) return 0;
  return cantripsKnownCount(ch.classId, partyLevelOf(c));
}

/** This character's known cantrips (all always prepared): saved choice or default. */
export function knownCantrips(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch) return [];
  return ch.cantrips ?? defaultKnown(cantripPool(c, charIdx), cantripLimit(c, charIdx));
}

/** Save an explicit cantrip selection, filtered to the pool and capped. */
export function setCantrips(c: CampaignState, charIdx: number, spellIds: Id[]): boolean {
  const ch = c.characters[charIdx];
  if (!ch) return false;
  const pool = cantripPool(c, charIdx);
  ch.cantrips = [...new Set(spellIds)].filter((id) => pool.includes(id)).slice(0, cantripLimit(c, charIdx));
  return true;
}

// --- tier 2: known leveled (spellbook) -------------------------------------

/** True for a spellbook caster (wizard): knows a chosen subset that grows via
 *  scrolls, rather than its whole list (cleric). */
function usesSpellbook(classId: Id, level: number): boolean {
  return spellbookSize(classId, level) !== undefined;
}

/** The leveled spells a wizard chooses its spellbook FROM (its class list).
 *  Empty for a caster that knows its whole list — it has no spellbook to pick. */
export function spellbookPool(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch || !usesSpellbook(ch.classId, partyLevelOf(c))) return [];
  return availableLeveledSpells(ch.classId, partyLevelOf(c));
}

/** How many base spellbook spells a wizard picks (undefined = knows-all caster). */
export function spellbookLimit(c: CampaignState, charIdx: number): number | undefined {
  const ch = c.characters[charIdx];
  if (!ch) return undefined;
  return spellbookSize(ch.classId, partyLevelOf(c));
}

/** The chosen base spellbook (saved or default) — wizard only. */
export function chosenSpellbook(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  const size = spellbookLimit(c, charIdx);
  if (!ch || size === undefined) return [];
  return ch.spellbook ?? defaultKnown(spellbookPool(c, charIdx), size);
}

/** Save an explicit spellbook selection (wizard), filtered to the class pool
 *  and capped at the spellbook size. Scribed scrolls are kept separately. */
export function setSpellbook(c: CampaignState, charIdx: number, spellIds: Id[]): boolean {
  const size = spellbookLimit(c, charIdx);
  const ch = c.characters[charIdx];
  if (!ch || size === undefined) return false;
  const pool = spellbookPool(c, charIdx);
  ch.spellbook = [...new Set(spellIds)].filter((id) => pool.includes(id)).slice(0, size);
  return true;
}

/** The leveled spells this character KNOWS — the pool it prepares from. A
 *  wizard's spellbook (base + scribed scrolls); a cleric's whole class list. */
export function knownLeveledSpells(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch) return [];
  if (!usesSpellbook(ch.classId, partyLevelOf(c))) {
    return availableLeveledSpells(ch.classId, partyLevelOf(c)); // cleric knows all
  }
  return [...new Set([...chosenSpellbook(c, charIdx), ...(ch.scribedSpells ?? [])])];
}

/** Always-known ritual spells (Find Familiar) — castable regardless, counted
 *  against nothing; shown in the panel as a note. */
export function knownRitualSpells(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch) return [];
  return classRituals(ch.classId, partyLevelOf(c));
}

// --- tier 3: prepared ------------------------------------------------------

/** The leveled spells this character can prepare from — everything it knows. */
export function preparableSpells(c: CampaignState, charIdx: number): Id[] {
  return knownLeveledSpells(c, charIdx);
}

/** How many leveled spells this character can prepare at once. 0 = non-caster. */
export function preparedLimit(c: CampaignState, charIdx: number): number {
  const ch = c.characters[charIdx];
  if (!ch || !CLASSES[ch.classId]?.spellcasting) return 0;
  return preparedCount(ch.classId, partyLevelOf(c));
}

/** This character's prepared leveled spells: saved choice or auto-default. */
export function preparedSpells(c: CampaignState, charIdx: number): Id[] {
  const ch = c.characters[charIdx];
  if (!ch) return [];
  return ch.prepared ?? defaultKnown(preparableSpells(c, charIdx), preparedLimit(c, charIdx));
}

/** Save an explicit prepared selection, filtered to what's known and capped. */
export function setPrepared(c: CampaignState, charIdx: number, spellIds: Id[]): boolean {
  const ch = c.characters[charIdx];
  if (!ch) return false;
  const pool = preparableSpells(c, charIdx);
  ch.prepared = [...new Set(spellIds)].filter((id) => pool.includes(id)).slice(0, preparedLimit(c, charIdx));
  return true;
}

/** Drop cantrip, spellbook, and prepared choices back to the auto-defaults. */
export function resetPrepared(c: CampaignState, charIdx: number): boolean {
  const ch = c.characters[charIdx];
  if (!ch) return false;
  delete ch.prepared;
  delete ch.cantrips;
  delete ch.spellbook;
  return true;
}

// ---------------------------------------------------------------------------
// Wizard spellbook — learning new spells from scrolls found in play.
// ---------------------------------------------------------------------------

/** The spell a scroll item teaches, if it's a spell scroll at all. */
function scrollSpellId(itemId: Id): Id | undefined {
  const item = ITEMS[itemId];
  return item?.targeting.kind === 'spell' ? item.targeting.spellId : undefined;
}

/** Scribing fee to copy a spell into a spellbook — 50 gp per spell level (the
 *  5e rate), floored so a stray level-0 entry never costs nothing. */
function scribingFee(spellId: Id): number {
  return Math.max(25, (SPELLS[spellId]?.level ?? 1) * 50);
}

/**
 * Whether a scroll in this wizard's pack can be copied into their spellbook:
 * a wizard-list spell (classes.ts's `learnableExtra`) they haven't already
 * learned. Returns the spell and its fee for the shop UI to show, regardless
 * of whether the party can currently afford it — the caller checks gold.
 */
export function scrollLearnable(c: CampaignState, charIdx: number, itemId: Id): { spellId: Id; fee: number } | undefined {
  const ch = c.characters[charIdx];
  if (!ch || ch.classId !== 'wizard') return undefined;
  const spellId = scrollSpellId(itemId);
  if (!spellId) return undefined;
  if (!CLASSES.wizard?.spellcasting?.learnableExtra?.includes(spellId)) return undefined;
  if (knownLeveledSpells(c, charIdx).includes(spellId)) return undefined; // already in the spellbook
  return { spellId, fee: scribingFee(spellId) };
}

/**
 * Copy a scroll's spell into a wizard's spellbook: consumes the scroll,
 * charges the scribing fee, and adds it to the spells they can prepare from.
 * It isn't immediately prepared by itself (see setPrepared) unless the
 * character is still on the default loadout, in which case it just joins it.
 */
export function learnSpellFromScroll(c: CampaignState, charIdx: number, itemId: Id): boolean {
  const ch = c.characters[charIdx];
  const learnable = ch ? scrollLearnable(c, charIdx, itemId) : undefined;
  const stack = ch?.inventory.find((s) => s.itemId === itemId && s.qty > 0);
  if (!ch || !learnable || !stack || c.gold < learnable.fee) return false;
  c.gold -= learnable.fee;
  stack.qty -= 1;
  if (stack.qty === 0) ch.inventory = ch.inventory.filter((s) => s !== stack);
  ch.scribedSpells = [...(ch.scribedSpells ?? []), learnable.spellId]; // grows the spellbook beyond the base
  return true;
}

// ---------------------------------------------------------------------------
// Shop skill checks (steal, haggle) — always rolled by the party's best.
// ---------------------------------------------------------------------------

export const STEAL_DC = 13;
export const HAGGLE: Record<'intimidation' | 'persuasion' | 'deception',
  { dc: number; discount: number; penalty: number }> = {
  persuasion:   { dc: 15, discount: 0.20, penalty: 0 },     // safe
  intimidation: { dc: 15, discount: 0.25, penalty: 0.25 },  // risky
  deception:    { dc: 13, discount: 0.15, penalty: 0.15 },  // easier, middling
};
export const STEAL_FINE = 50;

/** A character's bonus for a skill (ability mod + proficiency if trained).
 *  `backgroundId` grants two skills on top of class/species/feature sources. */
export function skillBonus(
  classId: Id, level: number, skill: SkillId, speciesId: Id = 'human', backgroundId?: Id,
): number {
  const cls = CLASSES[classId]!;
  const abilities = assignStats(cls.statPriority);
  const speciesProficiency = SPECIES[speciesId]?.skillProficienciesByClass?.[classId] === skill;
  // A species feature can grant a skill outright (a wood elf's Keen Senses),
  // regardless of class — the same fact the engine reads to spot hidden foes.
  const featureProficiency = (SPECIES[speciesId]?.featureIds ?? [])
    .some((f) => FEATURES[f]?.grantsSkill === skill);
  const backgroundProficiency = backgroundSkills(backgroundId).includes(skill);
  const proficient = cls.skillProfs.includes(skill) || speciesProficiency ||
    featureProficiency || backgroundProficiency;
  return abilityMod(abilities[SKILL_ABILITY[skill]]) + (proficient ? proficiencyBonus(level) : 0);
}

/** One party member's total bonus for a skill, including trinket riders. */
export function characterSkillBonus(c: CampaignState, idx: number, skill: SkillId): number {
  const ch = c.characters[idx];
  if (!ch) return -Infinity;
  let bonus = skillBonus(ch.classId, partyLevelOf(c), skill, ch.speciesId, ch.backgroundId);
  // Gloves of Thievery: +5 to Sleight of Hand (helps shop theft).
  if (skill === 'sleight-of-hand' && ch.equipped.trinket === 'gloves-thievery') bonus += 5;
  return bonus;
}

/** The party member with the highest bonus rolls every party skill check. */
export function bestAtSkill(c: CampaignState, skill: SkillId): { idx: number; bonus: number } {
  let best = { idx: 0, bonus: -Infinity };
  c.characters.forEach((_, idx) => {
    const bonus = characterSkillBonus(c, idx, skill);
    if (bonus > best.bonus) best = { idx, bonus };
  });
  return best;
}

export interface SkillRoll {
  skill: SkillId;
  /**
   * Index of the character who rolled — their identity, rather than their class
   * as a stand-in for it. Callers want the *name* ("Cedric the Sneaky rolls
   * stealth"), and looking a character up by classId only works because
   * setPartyClass swaps to keep the four classes unique. That invariant holds
   * today, but nothing here depends on it now.
   */
  by: number;
  natural: number;
  total: number;
  dc: number;
  success: boolean;
  /** +1d4 the party cleric adds by casting Guidance before the roll, if any. */
  guidance?: number;
}

export interface CheckOptions {
  /** Suppress the party cleric's Guidance +1d4 (already spent this scene). */
  noGuidance?: boolean;
}

/** Roll a skill check for a specific party member (adventure "who steps up"). */
export function characterSkillCheck(
  c: CampaignState, idx: number, skill: SkillId, dc: number, opts: CheckOptions = {},
): SkillRoll {
  const bonus = characterSkillBonus(c, idx, skill);
  const d = rollDie(c.rng, 20);
  c.rng = d.state;
  let total = d.value + bonus;
  // A party cleric casts Guidance before the check — +1d4, no combat resource.
  let guidance = 0;
  if (!opts.noGuidance && c.characters.some((ch) => ch.classId === 'cleric')) {
    const g = rollDie(c.rng, 4);
    c.rng = g.state;
    guidance = g.value;
    total += guidance;
  }
  return {
    skill, by: idx,
    natural: d.value, total, dc, success: total >= dc,
    ...(guidance ? { guidance } : {}),
  };
}

/** The party's best character rolls this check (shop skills, group-facing scenes). */
export function partySkillCheck(
  c: CampaignState, skill: SkillId, dc: number, opts: CheckOptions = {},
): SkillRoll {
  const { idx } = bestAtSkill(c, skill);
  return characterSkillCheck(c, idx, skill, dc, opts);
}

export interface GroupCheckResult {
  rolls: SkillRoll[];
  /** 5e group check: succeeds when at least half the party passes. */
  success: boolean;
}

/** Everyone rolls; the party succeeds if at least half do (5e group check). */
export function groupSkillCheck(
  c: CampaignState, skill: SkillId, dc: number, opts: CheckOptions = {},
): GroupCheckResult {
  const rolls = c.characters.map((_, idx) => characterSkillCheck(c, idx, skill, dc, opts));
  const passed = rolls.filter((r) => r.success).length;
  return { rolls, success: passed * 2 >= rolls.length };
}

export interface StealResult {
  rolls: SkillRoll[];
  success: boolean;
  /** On success: the randomly grabbed item. */
  itemId?: Id;
  /** On failure: gold paid (capped at what the party has). */
  fine: number;
}

/** Steal attempt: Stealth AND Sleight of Hand vs DC 13. Success grabs a random
 * item from `stock` (into the roller's pack); getting caught costs a fine.
 * `stock` defaults to the whole shop list, but a location can pass its own so a
 * thief never walks off with something the shop doesn't even sell. */
export function attemptSteal(c: CampaignState, stock: Id[] = SHOP_STOCK): StealResult {
  const stealth = partySkillCheck(c, 'stealth', STEAL_DC);
  const sleight = partySkillCheck(c, 'sleight-of-hand', STEAL_DC);
  const rolls = [stealth, sleight];
  if (stealth.success && sleight.success && stock.length > 0) {
    const r = next(c.rng);
    c.rng = r.state;
    const itemId = stock[Math.floor(r.value * stock.length)]!;
    const thief = c.characters[sleight.by] ?? c.characters[0]!;
    addItem(thief.inventory, itemId);
    return { rolls, success: true, itemId, fine: 0 };
  }
  const fine = Math.min(c.gold, STEAL_FINE);
  c.gold -= fine;
  return { rolls, success: false, fine };
}

export interface HaggleResult {
  roll: SkillRoll;
  /** Multiplier to apply to shop prices this visit (1 = unchanged). */
  priceMultiplier: number;
}

export function attemptHaggle(c: CampaignState, skill: keyof typeof HAGGLE): HaggleResult {
  const cfg = HAGGLE[skill];
  const roll = partySkillCheck(c, skill, cfg.dc);
  const priceMultiplier = roll.success ? 1 - cfg.discount : 1 + cfg.penalty;
  return { roll, priceMultiplier };
}

/** Move one of an item from one character to another. */
export function giveItem(c: CampaignState, fromIdx: number, toIdx: number, itemId: Id): boolean {
  const from = c.characters[fromIdx];
  const to = c.characters[toIdx];
  const stack = from?.inventory.find((s) => s.itemId === itemId && s.qty > 0);
  if (!from || !to || !stack || fromIdx === toIdx) return false;
  stack.qty -= 1;
  if (stack.qty === 0) from.inventory = from.inventory.filter((s) => s !== stack);
  addItem(to.inventory, itemId);
  return true;
}

/** The shared party loot pile (empty for legacy saves without the field). */
export function partyStash(c: CampaignState): ItemStack[] {
  if (!c.stash) c.stash = [];
  return c.stash;
}

/** Move one of an item from the shared stash to a party member's pack. */
export function claimFromStash(c: CampaignState, toIdx: number, itemId: Id): boolean {
  const to = c.characters[toIdx];
  const stash = partyStash(c);
  const stack = stash.find((s) => s.itemId === itemId && s.qty > 0);
  if (!to || !stack) return false;
  stack.qty -= 1;
  c.stash = stash.filter((s) => s.qty > 0);
  addItem(to.inventory, itemId);
  return true;
}

/** Move one of an item from a party member's pack into the shared stash. */
export function stashItem(c: CampaignState, fromIdx: number, itemId: Id): boolean {
  const from = c.characters[fromIdx];
  const stack = from?.inventory.find((s) => s.itemId === itemId && s.qty > 0);
  if (!from || !stack) return false;
  stack.qty -= 1;
  from.inventory = from.inventory.filter((s) => s.qty > 0);
  addItem(partyStash(c), itemId);
  return true;
}

/** Sell one of an item straight from the stash (half price into the purse). */
export function sellFromStash(c: CampaignState, itemId: Id): boolean {
  const stash = partyStash(c);
  const stack = stash.find((s) => s.itemId === itemId && s.qty > 0);
  if (!stack) return false;
  stack.qty -= 1;
  c.stash = stash.filter((s) => s.qty > 0);
  c.gold += Math.floor((itemPrice(itemId) ?? 0) / 2);
  return true;
}

export type EquipSlot = 'mainHand' | 'offHand' | 'armor' | 'trinket';

/** Why an equip is disallowed, or undefined if fine. */
export function equipBlocked(c: CampaignState, charIdx: number, itemId: Id, slot: EquipSlot): string | undefined {
  const ch = c.characters[charIdx];
  if (!ch) return 'no such character';
  if (!ch.inventory.some((s) => s.itemId === itemId && s.qty > 0)) return 'not in inventory';
  const profs = CLASSES[ch.classId]!.armorProfs;
  if (slot === 'trinket') {
    // Anyone can wear a trinket; it just has to be one.
    return TRINKETS[itemId] ? undefined : 'not a trinket';
  }
  if (slot === 'armor') {
    const a = ARMOR[itemId];
    if (!a) return 'not armor';
    if (!profs.includes(a.category)) return `${CLASSES[ch.classId]!.name}s can't wear ${a.category} armor`;
    return undefined;
  }
  if (isShield(itemId)) {
    if (slot !== 'offHand') return 'shields go in the off-hand';
    if (!profs.includes('shield')) return `${CLASSES[ch.classId]!.name}s can't use shields`;
    const main = ch.equipped.mainHand ? WEAPONS[ch.equipped.mainHand] : undefined;
    if (main?.properties.includes('two-handed')) return 'main hand holds a two-handed weapon';
    return undefined;
  }
  const w = WEAPONS[itemId];
  if (!w) return 'not a weapon';
  if (slot === 'offHand') {
    if (w.properties.includes('two-handed')) return 'two-handed weapons need the main hand';
    const main = ch.equipped.mainHand ? WEAPONS[ch.equipped.mainHand] : undefined;
    if (main?.properties.includes('two-handed')) return 'main hand holds a two-handed weapon';
  }
  return undefined;
}

/** Equip from inventory into a slot; whatever was there goes to inventory. */
export function equipItem(c: CampaignState, charIdx: number, itemId: Id, slot: EquipSlot): boolean {
  if (equipBlocked(c, charIdx, itemId, slot) !== undefined) return false;
  const ch = c.characters[charIdx]!;
  const stack = ch.inventory.find((s) => s.itemId === itemId && s.qty > 0)!;
  stack.qty -= 1;
  if (stack.qty === 0) ch.inventory = ch.inventory.filter((s) => s !== stack);
  const old = ch.equipped[slot];
  if (old !== undefined) addItem(ch.inventory, old);
  ch.equipped[slot] = itemId;
  // Equipping a two-handed weapon in the main hand empties the off-hand.
  if (slot === 'mainHand' && WEAPONS[itemId]?.properties.includes('two-handed') && ch.equipped.offHand) {
    addItem(ch.inventory, ch.equipped.offHand);
    delete ch.equipped.offHand;
  }
  return true;
}

/** Unequip a slot back into inventory (main hand must keep a weapon). */
/**
 * Return a piece of worn gear to its owner's pack.
 *
 * The main hand used to be exempt, to keep a hero from ending up weaponless.
 * It guarded nothing: `attackableWeapons` counts stowed weapons too, since the
 * free interaction draws them — a sword in the pack still swings. What the
 * exemption *did* do was strand the sword there, because giving and selling
 * work from packs, so a hero's main weapon could never be handed on or sold.
 * (Selling your only weapon is still possible, and still your business.)
 */
export function unequipSlot(c: CampaignState, charIdx: number, slot: EquipSlot): boolean {
  const ch = c.characters[charIdx];
  if (!ch || ch.equipped[slot] === undefined) return false;
  addItem(ch.inventory, ch.equipped[slot]!);
  delete ch.equipped[slot];
  return true;
}

export interface VictoryResult {
  stage: StageData;
  gold: number;
  items: ItemStack[];
  xpGained: number;
  leveledFrom?: number;
  leveledTo?: number;
}

/** Read surviving gear/resources back onto the party after a won fight. Shared
 *  by the campaign ladder and adventure mode: consumables spent in battle stay
 *  spent, weapon swaps and slots persist, and a hero downed to 0 in a won fight
 *  revives at 1 HP rather than starting the next fight unconscious. */
export function readBackSurvivors(c: CampaignState, finalTeam: Combatant[]): void {
  for (const ch of c.characters) {
    const fought = finalTeam.find((x) => x.classId === ch.classId);
    if (!fought) continue;
    ch.inventory = fought.inventory.map((s) => ({ ...s }));
    ch.equipped = { ...fought.equipped } as PartyCharacter['equipped'];
    ch.resources = {
      hp: Math.max(1, fought.hp),
      ...(fought.spellSlots.length > 0 ? { slots: fought.spellSlots.map((p) => p.current) } : {}),
      ...(fought.familiar || fought.mageArmor || ch.resources?.effects
        ? {
            effects: {
              ...ch.resources?.effects,
              ...(fought.familiar ? { familiar: { kind: 'owl' as const } } : {}),
              ...(fought.mageArmor ? { mageArmor: true as const } : {}),
            },
          }
        : {}),
    };
  }
}

export interface AdventureVictory {
  gold: number;
  items: ItemStack[];
  xpGained: number;
  leveledFrom?: number;
  leveledTo?: number;
}

/** A won *adventure* battle (not the campaign ladder): read survivors back,
 *  award XP + treasure from the *actual* encounter fought (not a ladder stage),
 *  and drop the loot into the shared stash. Unlike applyVictory it never
 *  touches `c.stage`, so an adventure can run any number of fights. */
export function applyAdventureVictory(
  c: CampaignState, finalTeam: Combatant[], encounterId: Id, rng: RngState = 1,
  bonusTier?: Rarity,
): AdventureVictory {
  readBackSurvivors(c, finalTeam);
  const xpGained = xpAward(encounterId, c.characters.length);
  const beforeLevel = levelForXp(c.xp);
  c.xp += xpGained;
  const afterLevel = levelForXp(c.xp);
  const treasure = treasureFor(encounterXP(encounterId), rng, bonusTier, encounterCoinXP(encounterId));
  c.gold += treasure.gold;
  if (!c.stash) c.stash = [];
  for (const item of treasure.items) addItem(c.stash, item.itemId, item.qty);
  return {
    gold: treasure.gold, items: treasure.items, xpGained,
    ...(afterLevel > beforeLevel ? { leveledFrom: beforeLevel, leveledTo: afterLevel } : {}),
  };
}

/** Bring a wiped party back on its feet (defeat → regroup): everyone to half
 *  their max HP, alive, conditions cleared. Slots are left as they were. */
export function reviveParty(c: CampaignState): void {
  const party = buildCampaignParty(c);
  for (const [i, combatant] of party.entries()) {
    setCampaignHp(c.characters[i]!, Math.max(1, Math.floor(combatant.maxHp / 2)));
  }
}

/**
 * After a victory: read surviving gear back (consumables spent in battle stay
 * spent, weapon swaps persist), award XP (possibly leveling the party),
 * generate treasure from encounter XP, and advance the ladder. The fallen
 * recover — defeat only happens when the whole party dies.
 */
export function applyVictory(
  c: CampaignState,
  finalTeam: Combatant[],
  rng: RngState = 1,
): VictoryResult {
  const stage = currentStage(c);
  if (!stage) throw new Error('Campaign already complete');
  readBackSurvivors(c, finalTeam);

  const xpGained = xpAward(stage.encounterId, c.characters.length);
  const beforeLevel = levelForXp(c.xp);
  c.xp += xpGained;
  const afterLevel = levelForXp(c.xp);

  // The final stage guarantees a rare drop as a trophy for finishing.
  const isFinale = c.stage === STAGES.length - 1;
  const treasure = treasureFor(encounterXP(stage.encounterId), rng, isFinale ? 'rare' : undefined, encounterCoinXP(stage.encounterId));
  c.gold += treasure.gold;
  if (!c.stash) c.stash = [];
  for (const item of treasure.items) {
    addItem(c.stash, item.itemId, item.qty);
  }

  c.victories.push(stage.encounterId);
  c.stage += 1;
  delete c.shopVisit;

  return {
    stage, gold: treasure.gold, items: treasure.items, xpGained,
    ...(afterLevel > beforeLevel ? { leveledFrom: beforeLevel, leveledTo: afterLevel } : {}),
  };
}
