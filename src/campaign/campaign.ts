/**
 * Campaign layer: a persistent party (gold, level, per-character gear) that
 * plays an encounter ladder, shops between battles, and collects loot.
 * Pure logic — the CLI owns all I/O; save/load lives in save.ts.
 *
 * The combat engine knows nothing about gold: the campaign builds Combatants
 * (via the builder's gear overrides) before a battle and reads surviving
 * inventory back afterwards.
 */
import type { Id, Combatant, ItemStack, Equipped, TeamId } from '../engine/types.js';
import { buildCharacter } from '../builder/character.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { CLASSES } from '../data/classes.js';

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
}

export interface StageData {
  encounterId: Id;
  partyLevel: number;       // party level for this battle
  mapId: string;
  loot: { gold: number; items: ItemStack[] };
}

export const STAGES: StageData[] = [
  {
    encounterId: 'goblins', partyLevel: 1, mapId: 'ruins',
    loot: { gold: 60, items: [{ itemId: 'potion-healing', qty: 2 }] },
  },
  {
    encounterId: 'wolves', partyLevel: 2, mapId: 'marsh',
    loot: { gold: 50, items: [{ itemId: 'potion-healing', qty: 1 }, { itemId: 'alchemists-fire', qty: 1 }] },
  },
  {
    encounterId: 'undead', partyLevel: 2, mapId: 'corridor',
    loot: { gold: 90, items: [{ itemId: 'potion-greater-healing', qty: 1 }, { itemId: 'scroll-cure-wounds', qty: 1 }] },
  },
  {
    encounterId: 'ogre', partyLevel: 3, mapId: 'firepit',
    loot: { gold: 250, items: [{ itemId: 'potion-greater-healing', qty: 2 }] },
  },
];

export const STARTING_GOLD = 100;

/** What the shop sells between battles. */
export const SHOP_STOCK: Id[] = [
  'potion-healing', 'potion-greater-healing', 'alchemists-fire',
  'scroll-magic-missile', 'scroll-cure-wounds',
];

export function newCampaign(): CampaignState {
  const order: Id[] = ['fighter', 'wizard', 'cleric', 'rogue'];
  return {
    gold: STARTING_GOLD,
    stage: 0,
    victories: [],
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
  return ITEMS[itemId]?.cost ?? WEAPONS[itemId]?.cost;
}

export function addItem(inv: ItemStack[], itemId: Id, qty = 1): void {
  const stack = inv.find((s) => s.itemId === itemId);
  if (stack) stack.qty += qty;
  else inv.push({ itemId, qty });
}

/** Buy for a specific character. Returns false if unaffordable/unknown. */
export function buyItem(c: CampaignState, charIdx: number, itemId: Id): boolean {
  const price = itemPrice(itemId);
  const ch = c.characters[charIdx];
  if (price === undefined || !ch || c.gold < price) return false;
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

/**
 * After a victory: read surviving gear back (consumables spent in battle stay
 * spent, weapon swaps persist), collect loot into the first character's pack
 * (party pool by convention), and advance the ladder. The fallen recover —
 * defeat only happens when the whole party dies.
 */
export function applyVictory(c: CampaignState, finalTeam: Combatant[]): StageData {
  const stage = currentStage(c);
  if (!stage) throw new Error('Campaign already complete');
  for (const ch of c.characters) {
    const fought = finalTeam.find((x) => x.classId === ch.classId);
    if (fought) {
      ch.inventory = fought.inventory.map((s) => ({ ...s }));
      ch.equipped = { ...fought.equipped } as PartyCharacter['equipped'];
    }
  }
  c.gold += stage.loot.gold;
  for (const item of stage.loot.items) {
    addItem(c.characters[0]!.inventory, item.itemId, item.qty);
  }
  c.victories.push(stage.encounterId);
  c.stage += 1;
  return stage;
}
