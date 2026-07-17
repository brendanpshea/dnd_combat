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
import type { Id, Combatant, ItemStack, TeamId } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { buildCharacter, assignStats } from '../builder/character.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR, SHIELD_COST } from '../data/armor.js';
import { FEATURES } from '../data/features.js';
import { CLASSES, SkillId, SKILL_ABILITY } from '../data/classes.js';
import { SPECIES } from '../data/species.js';
import { encounterXP } from '../data/monsters.js';
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
    effects?: {
      familiar?: { kind: 'owl' };
    };
  };
  inventory: ItemStack[];
  equipped: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id };
}

export interface CampaignState {
  gold: number;
  /** Accumulated party XP (per-character pace: encounter XP / party size). */
  xp: number;
  /** Index into STAGES of the next battle. */
  stage: number;
  characters: PartyCharacter[];
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
export function parseCampaign(json: string): CampaignState | undefined {
  try {
    const raw = JSON.parse(json) as CampaignState;
    if (typeof raw.gold !== 'number' || !Array.isArray(raw.characters)) return undefined;
    if (typeof raw.rng !== 'number') raw.rng = 1; // pre-skills saves
    for (const character of raw.characters) {
      character.speciesId ??= 'human';
      character.portraitId ??= character.classId;
      // Saves from before characters had names carry the class as the name, so
      // the game announces "Wizard is down" instead of "Morgana Le Fey is down".
      // A name that is exactly the class name was never chosen, it was the old
      // default — upgrade it. (Deliberately naming your wizard "Wizard" is a
      // price worth paying to fix every save that predates the feature.)
      if (!character.name || character.name === CLASSES[character.classId]?.name) {
        character.name = defaultNameFor(character.classId);
      }
    }
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
  { encounterId: 'ogre', mapId: 'firepit' },    // 550, boss finale
];

// --- XP & leveling ---------------------------------------------------------

/** 5e XP thresholds by level (index = level − 1); capped at our content's L3. */
export const LEVEL_XP = [0, 300, 900] as const;
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
  common: ['potion-healing', 'alchemists-fire', 'scroll-magic-missile', 'scroll-cure-wounds', 'chain-shirt'],
  uncommon: ['potion-greater-healing', 'greatsword', 'longbow', 'scale-mail'],
  rare: ['half-plate', 'splint', 'longsword-plus1', 'shortsword-plus1'],
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
  return ITEMS[itemId]?.rarity ?? ARMOR[itemId]?.rarity ?? 'common';
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
 * Generate treasure from encounter XP. Gold ≈ XP/2 with variance; the number
 * of item rolls and the rarity ceiling both rise with XP. `bonusTier` forces
 * one guaranteed drop of that tier (used for the finale). Deterministic.
 */
export function treasureFor(xp: number, rng: RngState, bonusTier?: Rarity): Treasure {
  let state = rng;
  const roll = () => { const r = next(state); state = r.state; return r.value; };

  const gold = Math.round(xp * 0.5 * (0.8 + 0.4 * roll()));

  const rolls = xp >= 700 ? 3 : xp >= 300 ? 2 : 1;
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
  'scroll-magic-missile', 'scroll-cure-wounds',
  // weapons
  'dagger', 'greatsword', 'longbow', 'longsword-plus1', 'shortsword-plus1',
  // armor
  'leather', 'chain-shirt', 'half-plate', 'splint',
];

export function itemName(itemId: Id): string {
  return ITEMS[itemId]?.name ?? WEAPONS[itemId]?.name ?? ARMOR[itemId]?.name ??
    (itemId === 'shield' ? 'Shield' : itemId);
}

/** A small emoji icon for an item, so the shop/inventory read visually. */
export function itemIcon(itemId: Id): string {
  if (itemId === 'shield') return '🛡️';
  if (ITEMS[itemId]) {
    if (itemId.includes('potion')) return '🧪';
    if (itemId.includes('scroll')) return '📜';
    if (itemId.includes('fire')) return '🔥';
    return '✨';
  }
  const w = WEAPONS[itemId];
  if (w) {
    if (itemId.endsWith('plus1')) return '🌟';
    if (w.range && !w.melee) return '🏹';
    return '⚔️';
  }
  if (ARMOR[itemId]) return '🥋';
  return '📦';
}

/** Re-exported so callers don't reach past this layer for a party's names. */
export { HERO_NAMES as DEFAULT_NAMES, defaultNameFor };

export function newCampaign(seed = 1, speciesIds: Id[] = []): CampaignState {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  return {
    gold: STARTING_GOLD,
    xp: 0,
    stage: 0,
    victories: [],
    partyReady: false,
    storyMode: true, // approachable default; toggled in the forge
    rng: seedRng(seed),
    characters: order.map((classId, index) => {
      const eq = CLASSES[classId]!.equipment;
      return {
        classId,
        speciesId: speciesIds[index] ?? 'human',
        name: defaultNameFor(classId),
        portraitId: classId,
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
    target.classId = nextClassId;
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

export function currentStage(c: CampaignState): StageData | undefined {
  return STAGES[c.stage];
}

export function isComplete(c: CampaignState): boolean {
  return c.stage >= STAGES.length;
}

export function itemPrice(itemId: Id): number | undefined {
  if (itemId === 'shield') return SHIELD_COST;
  return ITEMS[itemId]?.cost ?? WEAPONS[itemId]?.cost ?? ARMOR[itemId]?.cost;
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
    });
    if (typeof ch.resources?.hp === 'number' && Number.isFinite(ch.resources.hp)) {
      combatant.hp = Math.max(0, Math.min(ch.resources.hp, combatant.maxHp));
    }
    if (ch.resources?.effects?.familiar) combatant.familiar = { kind: 'owl' };
    return combatant;
  });
}

function setCampaignHp(ch: PartyCharacter, hp: number): void {
  ch.resources = { ...ch.resources, hp };
}

export interface RestResult {
  totalHealed: number;
}

/**
 * Testing-friendly short rest: each hero recovers half their maximum HP.
 * It is deliberately unrestricted for now; campaign HP is the only mutable
 * resource persisted between encounters, so spell slots still refresh when a
 * new battle is built.
 */
export function shortRest(c: CampaignState): RestResult {
  let totalHealed = 0;
  const party = buildCampaignParty(c);
  for (const [index, combatant] of party.entries()) {
    const healedHp = Math.min(combatant.maxHp, combatant.hp + Math.ceil(combatant.maxHp / 2));
    totalHealed += healedHp - combatant.hp;
    setCampaignHp(c.characters[index]!, healedHp);
  }
  return { totalHealed };
}

/** Testing-friendly long rest: each hero recovers all missing HP. */
export function longRest(c: CampaignState): RestResult {
  let totalHealed = 0;
  const party = buildCampaignParty(c);
  for (const [index, combatant] of party.entries()) {
    totalHealed += combatant.maxHp - combatant.hp;
    setCampaignHp(c.characters[index]!, combatant.maxHp);
  }
  return { totalHealed };
}

/** Healing sources that can be used between battles from the store. */
export type StoreHealingSource =
  | 'potion-healing'
  | 'potion-greater-healing'
  | 'scroll-cure-wounds'
  | 'cure-wounds';

export function isStoreHealingSource(itemId: Id): itemId is StoreHealingSource {
  return itemId === 'potion-healing' || itemId === 'potion-greater-healing' ||
    itemId === 'scroll-cure-wounds' || itemId === 'cure-wounds';
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
}

const STORE_SPELL_ACTIONS: Record<Id, StoreSpellAction> = {
  'cure-wounds': { spellId: 'cure-wounds', name: 'Cure Wounds', icon: '💚', targeting: 'party' },
  'find-familiar': { spellId: 'find-familiar', name: 'Find Familiar', icon: '🦉', targeting: 'self' },
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
    user.resources = {
      hp: user.resources?.hp ?? caster.hp,
      effects: { ...user.resources?.effects, familiar: { kind: 'owl' } },
    };
    return true;
  }
  return false;
}

/**
 * Use a healing consumable or Cure Wounds during a store visit. Consumables
 * are spent; Cure Wounds is available to prepared casters without consuming a
 * slot because spell slots are encounter-only campaign state for now.
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
  if (source === 'cure-wounds' ? !caster.spellIds.includes(source) : !item) return undefined;

  let dice = '2d4+2';
  let bonus = 0;
  if (source === 'potion-greater-healing') dice = '4d4+4';
  if (source === 'scroll-cure-wounds' || source === 'cure-wounds') {
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
  const rolled = roll.total + bonus;
  const hp = Math.min(recipient.maxHp, recipient.hp + rolled);
  setCampaignHp(target, hp);
  return { rolled, healed: hp - recipient.hp };
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

/** A character's bonus for a skill (ability mod + proficiency if trained). */
export function skillBonus(classId: Id, level: number, skill: SkillId, speciesId: Id = 'human'): number {
  const cls = CLASSES[classId]!;
  const abilities = assignStats(cls.statPriority);
  const speciesProficiency = SPECIES[speciesId]?.skillProficienciesByClass?.[classId] === skill;
  // A species feature can grant a skill outright (a wood elf's Keen Senses),
  // regardless of class — the same fact the engine reads to spot hidden foes.
  const featureProficiency = (SPECIES[speciesId]?.featureIds ?? [])
    .some((f) => FEATURES[f]?.grantsSkill === skill);
  return abilityMod(abilities[SKILL_ABILITY[skill]]) +
    (cls.skillProfs.includes(skill) || speciesProficiency || featureProficiency ? proficiencyBonus(level) : 0);
}

/** The party member with the highest bonus rolls every party skill check. */
export function bestAtSkill(c: CampaignState, skill: SkillId): { idx: number; bonus: number } {
  const level = partyLevelOf(c);
  let best = { idx: 0, bonus: -Infinity };
  c.characters.forEach((ch, idx) => {
    const bonus = skillBonus(ch.classId, level, skill, ch.speciesId);
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
}

export function partySkillCheck(c: CampaignState, skill: SkillId, dc: number): SkillRoll {
  const { idx, bonus } = bestAtSkill(c, skill);
  const d = rollDie(c.rng, 20);
  c.rng = d.state;
  const total = d.value + bonus;
  return {
    skill, by: idx,
    natural: d.value, total, dc, success: total >= dc,
  };
}

export interface StealResult {
  rolls: SkillRoll[];
  success: boolean;
  /** On success: the randomly grabbed item. */
  itemId?: Id;
  /** On failure: gold paid (capped at what the party has). */
  fine: number;
}

/** Steal attempt: Stealth AND Sleight of Hand vs DC 13. Success grabs a
 * random shop item (into the roller's pack); getting caught costs a fine. */
export function attemptSteal(c: CampaignState): StealResult {
  const stealth = partySkillCheck(c, 'stealth', STEAL_DC);
  const sleight = partySkillCheck(c, 'sleight-of-hand', STEAL_DC);
  const rolls = [stealth, sleight];
  if (stealth.success && sleight.success) {
    const r = next(c.rng);
    c.rng = r.state;
    const itemId = SHOP_STOCK[Math.floor(r.value * SHOP_STOCK.length)]!;
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

export type EquipSlot = 'mainHand' | 'offHand' | 'armor';

/** Why an equip is disallowed, or undefined if fine. */
export function equipBlocked(c: CampaignState, charIdx: number, itemId: Id, slot: EquipSlot): string | undefined {
  const ch = c.characters[charIdx];
  if (!ch) return 'no such character';
  if (!ch.inventory.some((s) => s.itemId === itemId && s.qty > 0)) return 'not in inventory';
  const profs = CLASSES[ch.classId]!.armorProfs;
  if (slot === 'armor') {
    const a = ARMOR[itemId];
    if (!a) return 'not armor';
    if (!profs.includes(a.category)) return `${CLASSES[ch.classId]!.name}s can't wear ${a.category} armor`;
    return undefined;
  }
  if (itemId === 'shield') {
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
  for (const ch of c.characters) {
    const fought = finalTeam.find((x) => x.classId === ch.classId);
    if (fought) {
      ch.inventory = fought.inventory.map((s) => ({ ...s }));
      ch.equipped = { ...fought.equipped } as PartyCharacter['equipped'];
      ch.resources = {
        hp: fought.hp,
        ...(fought.familiar || ch.resources?.effects
          ? { effects: { ...ch.resources?.effects, ...(fought.familiar ? { familiar: { kind: 'owl' as const } } : {}) } }
          : {}),
      };
    }
  }

  const xpGained = xpAward(stage.encounterId, c.characters.length);
  const beforeLevel = levelForXp(c.xp);
  c.xp += xpGained;
  const afterLevel = levelForXp(c.xp);

  // The final stage guarantees a rare drop as a trophy for finishing.
  const isFinale = c.stage === STAGES.length - 1;
  const treasure = treasureFor(encounterXP(stage.encounterId), rng, isFinale ? 'rare' : undefined);
  c.gold += treasure.gold;
  for (const item of treasure.items) {
    addItem(c.characters[0]!.inventory, item.itemId, item.qty);
  }

  c.victories.push(stage.encounterId);
  c.stage += 1;
  delete c.shopVisit;

  return {
    stage, gold: treasure.gold, items: treasure.items, xpGained,
    ...(afterLevel > beforeLevel ? { leveledFrom: beforeLevel, leveledTo: afterLevel } : {}),
  };
}
