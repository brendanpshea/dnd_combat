/**
 * Campaign layer: a persistent party (gold, level, per-character gear) that
 * plays an encounter ladder, shops between battles, and collects loot.
 * Pure logic — the CLI owns all I/O; save/load lives in save.ts.
 *
 * The combat engine knows nothing about gold: the campaign builds Combatants
 * (via the builder's gear overrides) before a battle and reads surviving
 * inventory back afterwards.
 */
import type { Id, Combatant, ItemStack, TeamId } from '../engine/types.js';
import { abilityMod, proficiencyBonus } from '../engine/types.js';
import { buildCharacter, assignStats } from '../builder/character.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR, SHIELD_COST } from '../data/armor.js';
import { CLASSES, SkillId, SKILL_ABILITY } from '../data/classes.js';
import { RngState, next, seedRng, rollDie } from '../engine/rng.js';

export interface PartyCharacter {
  classId: Id;
  inventory: ItemStack[];
  equipped: { mainHand: Id; offHand?: Id | 'shield'; armor?: Id };
}

export interface CampaignState {
  gold: number;
  /** Index into STAGES of the next battle. */
  stage: number;
  characters: PartyCharacter[];
  /** Battles won, for flavor/records. */
  victories: string[];
  /** RNG state for out-of-combat rolls (skill checks); persisted for replays. */
  rng: RngState;
}

export interface LootTable {
  gold: { min: number; max: number };
  /** How many independent item draws. */
  rolls: number;
  entries: Array<{ itemId: Id; weight: number }>;
}

export interface StageData {
  encounterId: Id;
  partyLevel: number;       // party level for this battle
  mapId: string;
  loot: LootTable;
}

export const STAGES: StageData[] = [
  {
    encounterId: 'goblins', partyLevel: 1, mapId: 'ruins',
    loot: {
      gold: { min: 40, max: 80 }, rolls: 2,
      entries: [
        { itemId: 'potion-healing', weight: 5 },
        { itemId: 'alchemists-fire', weight: 3 },
        { itemId: 'scroll-magic-missile', weight: 2 },
        { itemId: 'chain-shirt', weight: 1 },
      ],
    },
  },
  {
    encounterId: 'wolves', partyLevel: 2, mapId: 'marsh',
    loot: {
      gold: { min: 30, max: 60 }, rolls: 2,
      entries: [
        { itemId: 'potion-healing', weight: 6 },
        { itemId: 'potion-greater-healing', weight: 2 },
        { itemId: 'alchemists-fire', weight: 3 },
      ],
    },
  },
  {
    encounterId: 'undead', partyLevel: 2, mapId: 'corridor',
    loot: {
      gold: { min: 70, max: 120 }, rolls: 2,
      entries: [
        { itemId: 'potion-greater-healing', weight: 4 },
        { itemId: 'scroll-cure-wounds', weight: 3 },
        { itemId: 'potion-healing', weight: 3 },
        { itemId: 'splint', weight: 2 },
      ],
    },
  },
  {
    encounterId: 'ogre', partyLevel: 3, mapId: 'firepit',
    loot: {
      gold: { min: 180, max: 280 }, rolls: 3,
      entries: [
        { itemId: 'potion-greater-healing', weight: 4 },
        { itemId: 'longsword-plus1', weight: 2 },
        { itemId: 'shortsword-plus1', weight: 2 },
        { itemId: 'half-plate', weight: 2 },
        { itemId: 'potion-healing', weight: 1 },
      ],
    },
  },
];

/** Weighted loot roll driven by engine RNG state (battle-end rng → loot). */
export function rollLoot(table: LootTable, rng: RngState): { gold: number; items: ItemStack[]; rng: RngState } {
  let r = next(rng);
  const gold = table.gold.min + Math.floor(r.value * (table.gold.max - table.gold.min + 1));
  const totalWeight = table.entries.reduce((s, e) => s + e.weight, 0);
  const items: ItemStack[] = [];
  let state = r.state;
  for (let i = 0; i < table.rolls; i++) {
    r = next(state);
    state = r.state;
    let pick = r.value * totalWeight;
    for (const e of table.entries) {
      pick -= e.weight;
      if (pick < 0) {
        const existing = items.find((s) => s.itemId === e.itemId);
        if (existing) existing.qty += 1;
        else items.push({ itemId: e.itemId, qty: 1 });
        break;
      }
    }
  }
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

export function newCampaign(seed = 1): CampaignState {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  return {
    gold: STARTING_GOLD,
    stage: 0,
    victories: [],
    rng: seedRng(seed),
    characters: order.map((classId) => {
      const eq = CLASSES[classId]!.equipment;
      return {
        classId,
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
  const stage = currentStage(c);
  const level = stage?.partyLevel ?? STAGES[STAGES.length - 1]!.partyLevel;
  const files = [1, 2, 4, 6];
  return c.characters.map((ch, i) =>
    buildCharacter({
      classId: ch.classId, team, level,
      position: { x: files[i]!, y: 0 },
      inventory: ch.inventory.map((s) => ({ ...s })),
      equipped: { ...ch.equipped },
    }),
  );
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

function partyLevel(c: CampaignState): number {
  return currentStage(c)?.partyLevel ?? STAGES[STAGES.length - 1]!.partyLevel;
}

/** A character's bonus for a skill (ability mod + proficiency if trained). */
export function skillBonus(classId: Id, level: number, skill: SkillId): number {
  const cls = CLASSES[classId]!;
  const abilities = assignStats(cls.statPriority);
  return abilityMod(abilities[SKILL_ABILITY[skill]]) +
    (cls.skillProfs.includes(skill) ? proficiencyBonus(level) : 0);
}

/** The party member with the highest bonus rolls every party skill check. */
export function bestAtSkill(c: CampaignState, skill: SkillId): { idx: number; bonus: number } {
  const level = partyLevel(c);
  let best = { idx: 0, bonus: -Infinity };
  c.characters.forEach((ch, idx) => {
    const bonus = skillBonus(ch.classId, level, skill);
    if (bonus > best.bonus) best = { idx, bonus };
  });
  return best;
}

export interface SkillRoll {
  skill: SkillId;
  by: Id;            // classId of the roller
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
    skill, by: c.characters[idx]!.classId,
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
    const thief = c.characters.find((ch) => ch.classId === sleight.by) ?? c.characters[0]!;
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
export function unequipSlot(c: CampaignState, charIdx: number, slot: EquipSlot): boolean {
  const ch = c.characters[charIdx];
  if (!ch || ch.equipped[slot] === undefined) return false;
  if (slot === 'mainHand') return false;
  addItem(ch.inventory, ch.equipped[slot]!);
  delete ch.equipped[slot];
  return true;
}

/**
 * After a victory: read surviving gear back (consumables spent in battle stay
 * spent, weapon swaps persist), roll the stage's loot table with the battle's
 * final RNG state, and advance the ladder. The fallen recover — defeat only
 * happens when the whole party dies.
 */
export function applyVictory(
  c: CampaignState,
  finalTeam: Combatant[],
  rng: RngState = 1,
): { stage: StageData; gold: number; items: ItemStack[] } {
  const stage = currentStage(c);
  if (!stage) throw new Error('Campaign already complete');
  for (const ch of c.characters) {
    const fought = finalTeam.find((x) => x.classId === ch.classId);
    if (fought) {
      ch.inventory = fought.inventory.map((s) => ({ ...s }));
      ch.equipped = { ...fought.equipped } as PartyCharacter['equipped'];
    }
  }
  const loot = rollLoot(stage.loot, rng);
  c.gold += loot.gold;
  for (const item of loot.items) {
    addItem(c.characters[0]!.inventory, item.itemId, item.qty);
  }
  c.victories.push(stage.encounterId);
  c.stage += 1;
  return { stage, gold: loot.gold, items: loot.items };
}
