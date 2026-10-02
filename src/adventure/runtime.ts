/**
 * The adventure interpreter. Pure over its own vocabulary and deterministic:
 * every roll threads `campaign.rng` (exactly as the shop's steal/haggle do), so
 * a saved `(moduleId, seed, choices[])` replays an entire adventure — battles
 * included, since battle seeds derive from the campaign rng plus the scene id.
 *
 * Battles/shops/rests are NOT run here: the relevant scenes emit an event
 * (`startBattle`, `enterShop`, `rest`) and the driver runs the existing loop,
 * then calls back (`resolveBattle`, `resolveShop`, `resolveRest`). The runtime
 * stays synchronous and engine-agnostic.
 *
 * Functions mutate `AdventureState` in place and return an event stream (the
 * campaign layer is mutation-based; determinism comes from the rng thread, not
 * from immutability). The event stream is the log/replay/render format.
 */
import type { Id } from '../engine/types.js';
import { abilityMod, cellAt, type Combatant, type GridState, type Position } from '../engine/types.js';
import { blocksMovement } from '../engine/grid.js';
import { buildMonster } from '../data/monsters.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { MONSTERS } from '../data/monsters.js';
import { rollDie } from '../engine/rng.js';
import { MAPS, type MapData } from '../data/maps.js';
import { generateArenaMap } from '../arena/map.js';
import {
  type CampaignState, type SkillRoll, type GroupCheckResult,
  characterSkillCheck, partySkillCheck, groupSkillCheck, bestAtSkill, characterSkillBonus,
  levelForXp, LEVEL_XP, partyStash, addItem, healParty, shortRest, longRest, reviveParty,
  attemptHaggle, attemptSteal, itemPrice, SHOP_STOCK, HAGGLE, shopOffering, partyLevelOf, fullRest, growSpellsForLevel,
} from '../campaign/campaign.js';
import {
  HUB_REF, ROOM_MAP_REF,
  type Module, type Dungeon, type DungeonLink, type Scene, type Choice, type Effect, type Requirement, type Outcome,
  type Roller, type ExploreNode, type JournalEntry, type CampRule, type Approach, type Para, type Paragraph,
} from './types.js';
import { linkKey, linksFrom, roomOf } from './dungeon.js';
import { isNpcFlag } from './npcs.js';

export interface AdventureState {
  campaign: CampaignState;
  moduleId: Id;
  sceneId: Id;
  flags: Record<string, boolean | number>;
  visited: Id[];
  /** Explore-node ids the party has entered (drives fog-of-war). */
  exploredNodes: Id[];
  /** Explore-node ids whose wandering-encounter roll has already happened. */
  wanderingRolled: Id[];
  /** The explore node the party most recently entered — their position on a
   *  traversal map ("you are here"), and what reveals the next frontier. */
  lastNode?: Id;
  journal: JournalEntry[];
  /** Scene ids whose once-per-scene Guidance has been spent (checks after the
   *  first in a scene get no cleric +1d4). */
  guidanceSpent: Id[];
  /** The explore scene most recently entered — the location `@hub` returns to
   *  and the implicit "leave" target for its sub-scenes. */
  hub?: Id;
  /** `sceneId:choiceId` keys of taken `once` choices, never offered again. */
  consumedChoices: string[];
  /** `sceneId::approachId` keys of challenge approaches already attempted (a
   *  `perApproach` challenge spends each try; a `single` one ends on the first). */
  spentApproaches: string[];
  /** Per-shop-scene visit state, reset each time that shop is entered. Keyed by
   *  scene id so two shops in a module never share a haggle discount or a
   *  spent gambit. */
  shopVisits: Record<Id, ShopVisit>;
  /** How many times each battle scene has been fought (won or lost), so a
   *  retried fight rolls different dice (`battleSeed`). Optional: absent on
   *  older saves, back-filled to {} on load. */
  battleAttempts?: Record<Id, number>;
  /** A sneak-up rolled at a fight's door: who is caught out when it starts.
   *  Cleared once the fight is resolved or left. */
  battleSurprise?: { sceneId: Id; side: 'party' | 'enemies' };
  /**
   * NPCs travelling with the party (Module.companions), in joining order.
   * `hp` absent = unhurt, so a join needs no stat block to hand; a fight writes
   * back what it cost them, and a long rest clears it again.
   */
  companions?: Array<{ id: Id; hp?: number }>;
  /** The chapter's day (Module.dawns): absent = day 1. Each long rest ends one. */
  day?: number;
  /** The scene the party stands in was visited before (its `again` text shows). */
  returning?: boolean;
  /** Battle scenes this run has won. A won fight pays once (see resolveBattle). */
  wonBattles?: Id[];
  /** Nights slept (or tried) at each camp with a `nights` limit, by scene. */
  campNights?: Record<Id, number>;
  /** Where the party stands in each dungeon it has entered, and what it has
   *  done there, by the dungeon scene's id. */
  dungeons?: Record<Id, DungeonProgress>;
}

/** A party's progress through one dungeon. Links are named by `linkKey`. */
export interface DungeonProgress {
  /** The room the party is standing in. */
  at: Id;
  /** The room it walked in from: where falling back from a fight returns it. */
  from?: Id;
  /** Walked in, but the room has not had its say yet (a fight on the way, the
   *  room's own fight still to win). Settled when the party comes back. */
  pending?: true;
  seen: Id[];
  /** Rooms whose fight has been won. */
  cleared: Id[];
  /** Rooms whose once-only event has played. */
  played: Id[];
  searched: Id[];
  /** Locked doors walked through or forced: they stay open. */
  opened: string[];
  forceTried: string[];
  /** Secret doors found. */
  revealed: string[];
  /** Links whose ambush has been rolled. */
  ambushRolled: string[];
  /** Light left, when the dungeon has a torch. */
  torch?: number;
  /** Gone out (by a way out, or when the light failed): coming back in starts
   *  at the entry again. */
  outside?: true;
}

export interface ShopVisit {
  /** Multiplier on list prices from a successful/failed haggle (1 = untouched). */
  priceMult: number;
  haggleUsed: boolean;
  stealUsed: boolean;
}

export type AdventureEvent =
  | { type: 'scene'; sceneId: Id; kind: Scene['kind']; revisit: boolean }
  | { type: 'text'; paragraphs: string[] }
  | { type: 'check'; roll: SkillRoll; success: boolean }
  | { type: 'groupCheck'; result: GroupCheckResult; success: boolean }
  | { type: 'flag'; flag: string; value: boolean | number }
  | { type: 'gold'; amount: number; total: number }
  | { type: 'item'; itemId: Id; qty: number; gained: boolean }
  | { type: 'xp'; amount: number; leveledFrom?: number; leveledTo?: number }
  | { type: 'heal'; amount: number }
  | { type: 'journal'; entry: JournalEntry }
  | { type: 'companion'; companionId: Id; joined: boolean }
  | { type: 'secretRevealed'; nodeId: Id }
  /** A long rest ended the day: this is the morning of `day`. */
  | { type: 'dawn'; day: number }
  /** The party walked into a dungeon room; `firstVisit` is its prose, the first time. */
  | { type: 'room'; roomId: Id; name: string; firstVisit?: string[] }
  | { type: 'doorFound'; link: string }
  | { type: 'startBattle'; encounterId: Id; mapId: Id; sceneId: Id }
  | { type: 'enterShop'; next: Id }
  | { type: 'rest'; variant: 'short' | 'long'; next: Id }
  | { type: 'ending'; outcome: 'victory' | 'defeat' };

// --- Setup ------------------------------------------------------------------

export function startAdventure(campaign: CampaignState, module: Module): AdventureState {
  const state: AdventureState = {
    campaign, moduleId: module.id, sceneId: module.start,
    flags: {}, visited: [], exploredNodes: [], wanderingRolled: [],
    journal: [], guidanceSpent: [], consumedChoices: [], spentApproaches: [], shopVisits: {},
  };
  return state;
}

/**
 * The company walks out of one chapter and into the next, intact.
 *
 * The same `CampaignState` — party, levels, XP, gold, gear, journal-earned
 * everything — becomes the next module's. Only the run-scoped state is left
 * behind: flags, visited scenes, explored nodes, all of which belong to the
 * chapter that is over.
 *
 * They arrive rested, because chapters are separated by days on the road. That
 * is `fullRest`, which clears spent resources; it is not a heal, so a party
 * that limped over the line still starts the next chapter needing to camp.
 */
export function carryCompanyInto(
  campaign: CampaignState, sequel: Module, from?: { module: Module; state: AdventureState },
): AdventureState {
  fullRest(campaign);
  const next = startAdventure(campaign, sequel);
  if (from) next.flags = carriedFlags(from.module, from.state);
  enterScene(next, sequel, sequel.start);
  return next;
}

/**
 * The choices a finished chapter hands on: what it inherited itself (already
 * named `module:flag`), plus each flag it `carries` that was set, renamed
 * after it. Nothing else crosses — the sequel's own flags start clean.
 */
export function carriedFlags(module: Module, state: AdventureState): Record<string, boolean | number> {
  const out: Record<string, boolean | number> = {};
  for (const [k, v] of Object.entries(state.flags)) if (k.includes(':') || isNpcFlag(k)) out[k] = v;
  for (const f of module.carries ?? []) {
    const v = state.flags[f];
    if (v === true || (typeof v === 'number' && v > 0)) out[`${module.id}:${f}`] = v;
  }
  return out;
}

/**
 * What should become of the saved run when an ending is reached.
 *
 * The UI used to answer this inline, and answered it wrong: it deleted the save
 * the moment ANY ending scene appeared, on the reasoning that "a finished run
 * shouldn't offer Resume". True of a run that is over — and the end of chapter
 * one is not that. It is the middle of a campaign, and the party only existed
 * in React state from that point on. "Return to menu" threw the company away;
 * picking the next chapter off the landing page silently rolled a fresh level-1
 * party into a module written for level 3.
 *
 * So the decision is a function of the module and the outcome, it lives beside
 * the runtime that produced the ending, and it is tested. `carry` means write
 * the sequel to the save slot; `clear` means the run really is over.
 */
export function endingDisposition(
  module: Module, outcome: 'victory' | 'defeat',
  lookup: (id: Id) => Module | undefined,
): { kind: 'carry'; sequel: Module } | { kind: 'clear' } {
  // A defeat ends the run whatever comes after it, and a victory with nothing
  // after it is the end of the story.
  if (outcome !== 'victory' || !module.sequel) return { kind: 'clear' };
  const sequel = lookup(module.sequel);
  // A sequel that is declared but missing is a content bug, not a reason to
  // discard somebody's party — but there is nowhere to carry them to.
  return sequel ? { kind: 'carry', sequel } : { kind: 'clear' };
}

export function currentScene(state: AdventureState, module: Module): Scene {
  const scene = module.scenes[state.sceneId];
  if (!scene) throw new Error(`Unknown scene: ${state.sceneId}`);
  return scene;
}

// --- Requirements -----------------------------------------------------------

function partyHasItem(c: CampaignState, itemId: Id): boolean {
  return c.characters.some((ch) => ch.inventory.some((s) => s.itemId === itemId && s.qty > 0)) ||
    (c.stash ?? []).some((s) => s.itemId === itemId && s.qty > 0);
}

export function requirementMet(state: AdventureState, req: Requirement): boolean {
  const c = state.campaign;
  switch (req.kind) {
    case 'flag': {
      const v = state.flags[req.flag];
      if (req.value === undefined) return v === true || (typeof v === 'number' && v > 0);
      if (typeof req.value === 'number') return typeof v === 'number' && v >= req.value;
      return v === req.value;
    }
    case 'notFlag': {
      const v = state.flags[req.flag];
      return !(v === true || (typeof v === 'number' && v > 0));
    }
    case 'item': return partyHasItem(c, req.itemId);
    case 'gold': return c.gold >= req.atLeast;
    case 'classInParty': return c.characters.some((ch) => ch.classId === req.classId);
    case 'speciesInParty': return c.characters.some((ch) => ch.speciesId === req.speciesId);
    case 'visited': return state.visited.includes(req.scene);
    case 'companion': return (state.companions ?? []).some((x) => x.id === req.companion);
    case 'noCompanion': return !(state.companions ?? []).some((x) => x.id === req.companion);
    case 'at': return state.hub === req.hub;
    case 'count': {
      const v = state.flags[req.flag];
      const n = typeof v === 'number' ? v : v === true ? 1 : 0;
      return (req.atLeast === undefined || n >= req.atLeast) && (req.below === undefined || n < req.below);
    }
    case 'npc': throw new Error(`NPC requirement on '${req.npc}' in a module not built with withNpcs`);
  }
}

/** What a story or dialogue says to this party: its `again` text on a
 *  return visit (when it has one), else its own; conditional paragraphs
 *  resolved. */
export function sceneParagraphs(state: AdventureState, scene: Extract<Scene, { kind: 'story' | 'dialogue' }>): Paragraph[] {
  const own = scene.kind === 'story' ? scene.text : scene.lines;
  return paragraphsFor(state, state.returning && scene.again ? scene.again : own);
}

/** What a check, challenge or battle says as the party arrives: its `again`
 *  intro on a return visit (when it has one), else its own. */
export function introParagraphs(state: AdventureState, scene: Extract<Scene, { kind: 'check' | 'challenge' | 'battle' }>): Paragraph[] {
  const own = scene.intro ?? [];
  return paragraphsFor(state, state.returning && scene.again ? scene.again : own);
}

/** A one-try group (`attempt`) already spent? */
export const attemptSpent = (state: AdventureState, attempt: Id | undefined): boolean =>
  !!attempt && state.consumedChoices.includes(`attempt:${attempt}`);
const spendAttempt = (state: AdventureState, attempt: Id | undefined) => {
  if (attempt && !attemptSpent(state, attempt)) state.consumedChoices.push(`attempt:${attempt}`);
};

/** The paragraphs this party sees: plain ones, and conditional ones whose
 *  requirements hold (see `Para`). */
export function paragraphsFor(state: AdventureState, paras: readonly Para[]): Paragraph[] {
  return paras.flatMap((p) => (typeof p === 'string' ? [p] : (p.if ?? []).every((r) => requirementMet(state, r)) ? [p.text] : []));
}

/** Why a gated thing is blocked, for the UI's greyed-out reason (or null). */
export function blockedReason(state: AdventureState, requires?: Requirement[]): string | null {
  if (!requires) return null;
  const unmet = requires.find((r) => !requirementMet(state, r));
  if (!unmet) return null;
  switch (unmet.kind) {
    case 'flag': return 'Requires something you haven\'t done yet';
    case 'notFlag': return 'No longer available';
    case 'item': return `Requires ${unmet.itemId.replace(/-/g, ' ')}`;
    case 'gold': return `Requires ${unmet.atLeast} gold`;
    case 'classInParty': return `Requires a ${unmet.classId} in the party`;
    case 'speciesInParty': return `Requires a ${unmet.speciesId} in the party`;
    case 'visited': return 'Requires exploring elsewhere first';
    case 'companion': return 'Requires someone who isn\'t with you';
    case 'noCompanion': return 'Not while they\'re with you';
    case 'at': return 'Not from here';
    case 'count': return 'Not as things stand';
    case 'npc': return 'Requires something you haven\'t done yet';
  }
}

// --- Effects ----------------------------------------------------------------

function applyEffect(state: AdventureState, eff: Effect, events: AdventureEvent[], module?: Module): void {
  const c = state.campaign;
  switch (eff.kind) {
    case 'setFlag': {
      const cur = state.flags[eff.flag];
      const value = eff.value === undefined
        ? (typeof cur === 'number' ? cur + 1 : true)
        : eff.value;
      state.flags[eff.flag] = value;
      events.push({ type: 'flag', flag: eff.flag, value });
      break;
    }
    case 'clearFlag':
      delete state.flags[eff.flag];
      events.push({ type: 'flag', flag: eff.flag, value: false });
      break;
    case 'gold': {
      // A loss takes what there is: the event says what changed hands.
      const before = c.gold;
      c.gold = Math.max(0, c.gold + eff.amount);
      events.push({ type: 'gold', amount: c.gold - before, total: c.gold });
      break;
    }
    case 'addItem':
      addItem(partyStash(c), eff.itemId, eff.qty ?? 1);
      events.push({ type: 'item', itemId: eff.itemId, qty: eff.qty ?? 1, gained: true });
      break;
    case 'removeItem': {
      let left = eff.qty ?? 1;
      const holders = [...c.characters.map((ch) => ch.inventory), partyStash(c)];
      for (const inv of holders) {
        for (const stack of inv) {
          if (stack.itemId !== eff.itemId || left <= 0) continue;
          const take = Math.min(stack.qty, left);
          stack.qty -= take; left -= take;
        }
      }
      events.push({ type: 'item', itemId: eff.itemId, qty: (eff.qty ?? 1) - left, gained: false });
      break;
    }
    case 'xp': {
      const before = levelForXp(c.xp);
      c.xp += eff.amount;
      const after = levelForXp(c.xp);
      // Levels earned by a milestone grow spellbooks and cantrips the same way
      // levels earned in a fight do.
      if (after > before) growSpellsForLevel(c);
      events.push({ type: 'xp', amount: eff.amount, ...(after > before ? { leveledFrom: before, leveledTo: after } : {}) });
      break;
    }
    case 'xpToLevel': {
      // Top up to the *start* of a level — "just enough to ding" — so a milestone
      // never overshoots a party that already earned the XP in combat, and never
      // leaves a wit-heavy party short. No-op if they're already past it.
      const before = levelForXp(c.xp);
      const target = LEVEL_XP[eff.level - 1] ?? 0;
      const gained = Math.max(0, target - c.xp);
      c.xp = Math.max(c.xp, target);
      const after = levelForXp(c.xp);
      if (after > before) growSpellsForLevel(c);
      events.push({ type: 'xp', amount: gained, ...(after > before ? { leveledFrom: before, leveledTo: after } : {}) });
      break;
    }
    case 'heal': {
      const { totalHealed } = healParty(c, eff.amount);
      events.push({ type: 'heal', amount: totalHealed });
      break;
    }
    case 'journal':
      if (!state.journal.some((j) => j.id === eff.entry.id)) state.journal.push(eff.entry);
      events.push({ type: 'journal', entry: eff.entry });
      break;
    case 'joinParty':
      if (!(state.companions ?? []).some((x) => x.id === eff.companion)) {
        (state.companions ??= []).push({ id: eff.companion });
        events.push({ type: 'companion', companionId: eff.companion, joined: true });
      }
      break;
    case 'leaveParty':
      if ((state.companions ?? []).some((x) => x.id === eff.companion)) {
        state.companions = (state.companions ?? []).filter((x) => x.id !== eff.companion);
        events.push({ type: 'companion', companionId: eff.companion, joined: false });
      }
      break;
    case 'copyFlag': {
      const v = state.flags[eff.from];
      if (v === undefined) delete state.flags[eff.to];
      else state.flags[eff.to] = v;
      break;
    }
    case 'addFlag': {
      const cur = state.flags[eff.flag];
      const value = (typeof cur === 'number' ? cur : cur === true ? 1 : 0) + eff.amount;
      state.flags[eff.flag] = value;
      events.push({ type: 'flag', flag: eff.flag, value });
      break;
    }
    case 'npc': throw new Error(`NPC effect on '${eff.npc}' in a module not built with withNpcs`);
    case 'passDay':
      // A day lost, not a night slept: the clock moves, nobody rests.
      if (module) events.push(...endDay(state, module));
      else state.day = dayOf(state) + 1;
      break;
  }
  // A full heal reaches whoever is travelling with the party too.
  if (eff.kind === 'heal' && eff.amount === 'full') restCompanions(state, 'full');
}

function applyEffects(state: AdventureState, effects: Effect[] | undefined, events: AdventureEvent[], module?: Module): void {
  for (const eff of effects ?? []) applyEffect(state, eff, events, module);
}

// --- Navigation -------------------------------------------------------------

/** Enter a scene: mark visited, emit its entry event and any intro text. Does
 *  NOT auto-resolve checks/battles/shops — the driver drives those. The special
 *  ref `@hub` routes back to the location the party last explored. */
export function enterScene(state: AdventureState, module: Module, sceneId: Id): AdventureEvent[] {
  const resolved = sceneId === HUB_REF ? (state.hub ?? module.start) : sceneId;
  const revisit = state.visited.includes(resolved); // already been here before
  state.sceneId = resolved;
  if (!revisit) state.visited.push(resolved);
  state.returning = revisit;
  const scene = currentScene(state, module);
  const cameFrom = state.hub;
  if (isHub(scene)) state.hub = resolved; // this is now the location
  const events: AdventureEvent[] = [{ type: 'scene', sceneId: resolved, kind: scene.kind, revisit }];

  switch (scene.kind) {
    case 'story': case 'dialogue': events.push({ type: 'text', paragraphs: sceneParagraphs(state, scene) }); break;
    case 'check': case 'challenge': events.push({ type: 'text', paragraphs: introParagraphs(state, scene) }); break;
    case 'battle':
      if (scene.intro || scene.again) events.push({ type: 'text', paragraphs: introParagraphs(state, scene) });
      events.push({ type: 'startBattle', encounterId: scene.encounterId, mapId: scene.mapId, sceneId });
      break;
    case 'shop':
      // A fresh visit: haggle discount and spent gambits reset each entry.
      state.shopVisits[resolved] = { priceMult: 1, haggleUsed: false, stealUsed: false };
      if (scene.intro) events.push({ type: 'text', paragraphs: paragraphsFor(state, scene.intro) });
      events.push({ type: 'enterShop', next: scene.next });
      break;
    case 'rest':
      if (scene.intro) events.push({ type: 'text', paragraphs: paragraphsFor(state, scene.intro) });
      events.push({ type: 'rest', variant: scene.variant, next: scene.next });
      break;
    case 'ending':
      events.push({ type: 'text', paragraphs: endingText(state, scene) });
      events.push({ type: 'ending', outcome: scene.outcome });
      break;
    case 'explore': break; // the UI renders the node map; no auto text
    case 'dungeon': events.push(...enterDungeon(state, module, scene, cameFrom !== resolved)); break;
  }
  return events;
}

/** An ending's paragraphs: its text, then each slide whose requirements hold. */
export function endingText(state: AdventureState, scene: Extract<Scene, { kind: 'ending' }>): string[] {
  // Slides are conditional paragraphs by another name.
  return paragraphsFor(state, [...scene.text, ...(scene.slides ?? [])]);
}

/** The scenes that are places: a map the party stands on, and returns to. */
export function isHub(scene: Scene | undefined): scene is Extract<Scene, { kind: 'explore' | 'dungeon' }> {
  return scene?.kind === 'explore' || scene?.kind === 'dungeon';
}

/** A place's name. */
export function hubTitleOf(scene: Scene | undefined): string | null {
  if (scene?.kind === 'explore') return scene.map.title;
  if (scene?.kind === 'dungeon') return scene.dungeon.title;
  return null;
}

function applyOutcome(state: AdventureState, module: Module, outcome: Outcome): AdventureEvent[] {
  const events: AdventureEvent[] = [];
  if (outcome.text) events.push({ type: 'text', paragraphs: paragraphsFor(state, outcome.text) });
  applyEffects(state, outcome.effects, events, module);
  events.push(...enterScene(state, module, outcome.to));
  return events;
}

// --- Skill checks -----------------------------------------------------------

/**
 * Who may roll for an option: an option locked to a class or species
 * (`classInParty`, `speciesInParty` among its requirements) is that
 * character's to try, not whoever happens to be best at the skill. Every
 * character, for an option with no such lock.
 */
export function eligibleRollers(state: AdventureState, requires: Requirement[] | undefined): number[] {
  const chars = state.campaign.characters;
  const all = chars.map((_, i) => i);
  const locks = (requires ?? []).filter((r) => r.kind === 'classInParty' || r.kind === 'speciesInParty');
  if (!locks.length) return all;
  const ok = all.filter((i) => locks.every((r) =>
    r.kind === 'classInParty' ? chars[i]!.classId === r.classId : r.kind === 'speciesInParty' ? chars[i]!.speciesId === r.speciesId : true));
  return ok.length ? ok : all;
}

/** The best at a skill among those who may roll it. */
function bestEligible(state: AdventureState, skill: Parameters<typeof characterSkillBonus>[2], who: number[]): number {
  let best = who[0] ?? 0, bonus = -Infinity;
  for (const i of who) {
    const b = characterSkillBonus(state.campaign, i, skill);
    if (b > bonus) { bonus = b; best = i; }
  }
  return best;
}

function rollFor(
  state: AdventureState, skill: Parameters<typeof partySkillCheck>[1], dc: number, roller: Roller,
  events: AdventureEvent[], requires?: Requirement[],
): boolean {
  const c = state.campaign;
  const noGuidance = state.guidanceSpent.includes(state.sceneId);
  if (roller === 'group') {
    const result = groupSkillCheck(c, skill, dc, { noGuidance });
    state.guidanceSpent.push(state.sceneId);
    events.push({ type: 'groupCheck', result, success: result.success });
    return result.success;
  }
  const who = eligibleRollers(state, requires);
  const idx = who.length === c.characters.length ? (roller === 'best' ? bestAtSkill(c, skill).idx : chosenRoller(state, skill)) : bestEligible(state, skill, who);
  const roll = characterSkillCheck(c, idx, skill, dc, { noGuidance });
  state.guidanceSpent.push(state.sceneId);
  events.push({ type: 'check', roll, success: roll.success });
  return roll.success;
}

/** For `roller: 'chosen'`, the driver normally supplies the actor; absent one
 *  (auto-player, headless replay), fall back to the party's best. */
function chosenRoller(state: AdventureState, skill: Parameters<typeof characterSkillBonus>[2]): number {
  return bestAtSkill(state.campaign, skill).idx;
}

/** Resolve a `check` scene: roll and route to success/failure. `actorIdx`
 *  overrides the roller for `roller: 'chosen'` scenes (the tapped hero). */
export function rollSceneCheck(state: AdventureState, module: Module, actorIdx?: number): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'check') throw new Error(`rollSceneCheck on a ${scene.kind} scene`);
  const events: AdventureEvent[] = [];
  const roller = scene.roller ?? 'best';
  const success = actorIdx !== undefined && roller === 'chosen'
    ? rollChosen(state, scene.skill, scene.dc, actorIdx, events)
    : rollFor(state, scene.skill, scene.dc, roller, events);
  events.push(...applyOutcome(state, module, success ? scene.success : scene.failure));
  return events;
}

function rollChosen(
  state: AdventureState, skill: Parameters<typeof characterSkillCheck>[2], dc: number,
  actorIdx: number, events: AdventureEvent[], requires?: Requirement[],
): boolean {
  // A hero who can't take a locked option doesn't roll it: the one who can does.
  const who = eligibleRollers(state, requires);
  if (!who.includes(actorIdx)) actorIdx = bestEligible(state, skill, who);
  const noGuidance = state.guidanceSpent.includes(state.sceneId);
  const roll = characterSkillCheck(state.campaign, actorIdx, skill, dc, { noGuidance });
  state.guidanceSpent.push(state.sceneId);
  events.push({ type: 'check', roll, success: roll.success });
  return roll.success;
}

// --- Challenges (multi-approach obstacles) ----------------------------------

const approachKey = (sceneId: Id, approachId: Id) => `${sceneId}::${approachId}`;

/** The approaches offered at the current challenge scene, each with its block
 *  reason and whether it's already been spent (a `perApproach` challenge). */
export function legalApproaches(
  state: AdventureState, module: Module,
): Array<{ approach: Approach; blocked: string | null; spent: boolean }> {
  const scene = currentScene(state, module);
  if (scene.kind !== 'challenge') return [];
  return scene.approaches
    .map((approach) => ({
      approach,
      blocked: blockedReason(state, approach.requires),
      spent: state.spentApproaches.includes(approachKey(scene.id, approach.id)) || attemptSpent(state, approach.attempt),
    }))
    .filter(({ approach, blocked }) => !(blocked && approach.hideWhenBlocked));
}

/** Attempt one approach at a challenge scene: roll its skill, then route.
 *  `single` (default): success or failure resolves the whole challenge.
 *  `perApproach`: a failure spends this approach and returns to the choice
 *  (its `failure` beat plays), unless it was the last option — then the
 *  challenge's shared `failure` fires. `actorIdx` picks the hero for a
 *  `roller: 'chosen'` approach. */
export function tryApproach(
  state: AdventureState, module: Module, approachId: Id, actorIdx?: number,
): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'challenge') throw new Error(`tryApproach on a ${scene.kind} scene`);
  const approach = scene.approaches.find((a) => a.id === approachId);
  if (!approach) throw new Error(`No approach ${approachId} at ${state.sceneId}`);
  if (blockedReason(state, approach.requires)) throw new Error(`Approach ${approachId} is blocked`);
  const key = approachKey(scene.id, approach.id);
  if (state.spentApproaches.includes(key) || attemptSpent(state, approach.attempt)) throw new Error(`Approach ${approachId} already tried`);

  const perApproach = scene.retry === 'perApproach';
  // Spend the approach up front (a failed try can't be re-rolled). In `single`
  // mode the whole challenge ends here regardless, so tracking it is harmless.
  if (perApproach) state.spentApproaches.push(key);
  spendAttempt(state, approach.attempt);

  const events: AdventureEvent[] = [];
  const roller = approach.roller ?? 'best';
  const success = actorIdx !== undefined && roller === 'chosen'
    ? rollChosen(state, approach.skill, approach.dc, actorIdx, events, approach.requires)
    : rollFor(state, approach.skill, approach.dc, roller, events, approach.requires);

  if (success) {
    events.push(...applyOutcome(state, module, approach.success ?? scene.success));
    return events;
  }
  if (!perApproach) {
    events.push(...applyOutcome(state, module, approach.failure ?? scene.failure));
    return events;
  }
  // A `perApproach` failure: show this line's beat and stay — unless nothing
  // else is left to try, in which case the challenge fails for good.
  if (approach.failure?.text) events.push({ type: 'text', paragraphs: paragraphsFor(state, approach.failure.text) });
  applyEffects(state, approach.failure?.effects, events, module);
  const anyLeft = legalApproaches(state, module).some((a) => !a.spent && !a.blocked);
  if (!anyLeft) events.push(...applyOutcome(state, module, scene.failure));
  return events;
}

// --- Choices ----------------------------------------------------------------

const choiceKey = (sceneId: Id, choiceId: Id) => `${sceneId}:${choiceId}`;

/** The choices offered at the current story/dialogue scene, with block status.
 *  A taken `once` choice is gone for good (never re-offered on a revisit). */
export function legalChoices(
  state: AdventureState, module: Module,
): Array<{ choice: Choice; blocked: string | null }> {
  const scene = currentScene(state, module);
  const next = scene.kind === 'story' || scene.kind === 'dialogue' ? scene.next : [];
  return next
    .filter((choice) => !(choice.once && state.consumedChoices.includes(choiceKey(scene.id, choice.id))))
    .filter((choice) => !attemptSpent(state, choice.attempt))
    .map((choice) => ({ choice, blocked: blockedReason(state, choice.requires) }))
    .filter(({ choice, blocked }) => !(blocked && choice.hideWhenBlocked));
}

/** The location the party can leave the current scene to, or null. Offered on
 *  story/dialogue scenes reached from a hub (unless the scene sets `noBack`),
 *  so the player is never trapped and can walk back out of a conversation. */
export function hubReturn(state: AdventureState, module: Module): Id | null {
  const scene = currentScene(state, module);
  if (scene.kind !== 'story' && scene.kind !== 'dialogue' && scene.kind !== 'challenge') return null;
  if (scene.noBack || !state.hub || state.hub === scene.id) return null;
  // Out of a dungeon: its map is behind the party, not somewhere to step back to.
  const hub = module.scenes[state.hub];
  if (hub?.kind === 'dungeon' && state.dungeons?.[hub.id]?.outside) return null;
  // A confrontation in the room the party stands in can't be stepped back out
  // of: it would only begin again (see enterDungeon). Leave by another door.
  if (hub?.kind === 'dungeon') {
    const p = state.dungeons?.[hub.id];
    if (p && standingEvent(state, hub.dungeon, p) === scene.id) return null;
  }
  return state.hub;
}

/** Walk back to the current hub location (the implicit "leave" affordance). */
export function returnToHub(state: AdventureState, module: Module): AdventureEvent[] {
  return enterScene(state, module, HUB_REF);
}

/** The name of the location a "leave" would drop the party back at, so the UI
 *  can label the button "← Back to the Marsh Road" instead of a bare "Leave". */
export function hubReturnTitle(state: AdventureState, module: Module): string | null {
  const hub = hubReturn(state, module);
  if (!hub) return null;
  return hubTitleOf(module.scenes[hub]);
}

/** A place the party can fast-travel to from the location they're standing in.
 *  `town` marks the home base so the UI can flag it. */
export interface TravelDest { sceneId: Id; title: string; isTown: boolean }

/**
 * Fast-travel destinations from the current scene: every *explore* location the
 * party has already discovered, minus the one they're in. Only offered while
 * standing on a location map (a hub) — you fast-travel *between* places you know,
 * not out of the middle of a conversation or a fight. Restricting to already
 * visited hubs is what keeps it safe: it can never skip a one-way gate the party
 * hasn't cleared (an unvisited location isn't a destination). The home town, if
 * discovered, sorts first.
 */
export function travelDestinations(state: AdventureState, module: Module): TravelDest[] {
  const here = currentScene(state, module);
  if (!isHub(here)) return [];
  // In a dungeon, only from a room with a way out.
  if (here.kind === 'dungeon' && !roomOf(here.dungeon, dungeonProgress(state, here.id, here.dungeon).at)?.exit) return [];
  const dests: TravelDest[] = [];
  for (const sceneId of state.visited) {
    if (sceneId === state.sceneId) continue;
    const scene = module.scenes[sceneId];
    if (!isHub(scene)) continue;
    dests.push({ sceneId, title: hubTitleOf(scene)!, isTown: sceneId === module.town });
  }
  return dests.sort((a, b) => Number(b.isTown) - Number(a.isTown) || a.title.localeCompare(b.title));
}

/** Fast-travel to a discovered location. Validates the destination is really on
 *  offer (a known explore hub, reachable from where you stand), then walks in. */
export function fastTravel(state: AdventureState, module: Module, toSceneId: Id): AdventureEvent[] {
  if (!travelDestinations(state, module).some((d) => d.sceneId === toSceneId)) {
    throw new Error(`Cannot fast-travel to ${toSceneId} from ${state.sceneId}`);
  }
  return enterScene(state, module, toSceneId);
}

/** Take a choice at a story/dialogue scene. Rolls an inline check if present. */
export function choose(
  state: AdventureState, module: Module, choiceId: Id, actorIdx?: number,
): AdventureEvent[] {
  const scene = currentScene(state, module);
  const list = scene.kind === 'story' || scene.kind === 'dialogue' ? scene.next : [];
  const choice = list.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`No choice ${choiceId} at ${state.sceneId}`);
  if (blockedReason(state, choice.requires)) throw new Error(`Choice ${choiceId} is blocked`);
  if (attemptSpent(state, choice.attempt)) throw new Error(`Choice ${choiceId} already tried`);
  // Record a `once` choice as spent up front — a failed social check is still
  // spent, so it can't be re-rolled by revisiting.
  if (choice.once) state.consumedChoices.push(choiceKey(scene.id, choice.id));
  spendAttempt(state, choice.attempt);

  const events: AdventureEvent[] = [];
  applyEffects(state, choice.effects, events, module);

  if (choice.check) {
    const roller = choice.check.roller ?? 'best';
    const success = actorIdx !== undefined && roller === 'chosen'
      ? rollChosen(state, choice.check.skill, choice.check.dc, actorIdx, events, choice.requires)
      : rollFor(state, choice.check.skill, choice.check.dc, roller, events, choice.requires);
    if (success) {
      events.push(...enterScene(state, module, choice.to));
    } else {
      applyEffects(state, choice.check.failEffects, events, module);
      events.push(...enterScene(state, module, choice.check.failTo));
    }
    return events;
  }

  events.push(...enterScene(state, module, choice.to));
  return events;
}

// --- Explore ----------------------------------------------------------------

/** Passive Perception used to spot secret nodes: 10 + the party's best. */
function partyPassivePerception(c: CampaignState): number {
  return 10 + bestAtSkill(c, 'perception').bonus;
}

export interface VisibleNode {
  node: ExploreNode;
  blocked: string | null;
  /** A secret whose DC the party met on arrival — now revealed. */
  secret: boolean;
  /** The party has already entered this node (drives fog-of-war dimming). */
  explored: boolean;
  /** Traversal map: reachable now but not yet reached — shown as an unknown
   *  token with its title hidden. Always false on a free-roam map. */
  frontier: boolean;
  /** The party's current position on the map ("you are here"). */
  here: boolean;
}

/** Adjacency for a traversal map's `paths` (undirected). */
function neighbours(paths: Array<[Id, Id]> | undefined, nodeId: Id): Id[] {
  const out: Id[] = [];
  for (const [a, b] of paths ?? []) {
    if (a === nodeId) out.push(b);
    else if (b === nodeId) out.push(a);
  }
  return out;
}

/** The party's current node on this map: the last one they entered if it lives
 *  here, else the first entry (traversal) or none (free-roam). */
function positionNode(state: AdventureState, map: { nodes: ExploreNode[]; entry?: Id[] }): Id | undefined {
  const ids = new Set(map.nodes.map((n) => n.id));
  if (state.lastNode && ids.has(state.lastNode)) return state.lastNode;
  return map.entry?.[0];
}

/** The nodes to render for the current explore scene: gated nodes carry a
 *  reason; secret nodes appear only once passive Perception meets their DC. */
export function exploreNodes(state: AdventureState, module: Module): VisibleNode[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'explore') return [];
  const map = scene.map;
  const passive = partyPassivePerception(state.campaign);
  const here = positionNode(state, map);
  const traversal = !!map.paths; // presence of edges = a path map

  // On a traversal map, the "known" set is the entries plus the neighbours of
  // every visited node; anything else is still beyond the fog and not shown.
  let known: Set<Id> | null = null;
  if (traversal) {
    known = new Set(map.entry ?? []);
    for (const n of map.nodes) {
      if (state.exploredNodes.includes(n.id)) {
        known.add(n.id);
        for (const nb of neighbours(map.paths, n.id)) known.add(nb);
      }
    }
    if (here) known.add(here);
  }

  const out: VisibleNode[] = [];
  for (const node of map.nodes) {
    if (known && !known.has(node.id)) continue;      // beyond the frontier
    const secret = !!node.hidden;
    if (secret && passive < node.hidden!.dc) continue; // undiscovered secret
    const explored = state.exploredNodes.includes(node.id);
    const isEntry = map.entry?.includes(node.id) ?? false;
    // Frontier: known but not yet reached (and not the entry you started at).
    const frontier = traversal && !explored && !isEntry;
    out.push({
      node, blocked: blockedReason(state, node.requires) && (node.note ?? blockedReason(state, node.requires)), secret, explored,
      frontier, here: node.id === here,
    });
  }
  return out;
}

/** Enter an explore node's scene (after its requirements). A wandering roll may
 *  divert to a battle first (rolled once per node, on the campaign rng). */
export function enterNode(state: AdventureState, module: Module, nodeId: Id): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'explore') throw new Error('enterNode outside an explore scene');
  const node = scene.map.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`No node ${nodeId}`);
  if (blockedReason(state, node.requires)) throw new Error(`Node ${nodeId} is blocked`);
  // On a traversal map you can only step to a node the frontier reveals.
  if (scene.map.paths && !exploreNodes(state, module).some((v) => v.node.id === nodeId)) {
    throw new Error(`Node ${nodeId} is beyond the frontier`);
  }
  if (!state.exploredNodes.includes(nodeId)) state.exploredNodes.push(nodeId);
  state.lastNode = nodeId; // you are here now

  if (node.wandering && !state.wanderingRolled.includes(nodeId)) {
    state.wanderingRolled.push(nodeId);
    const c = state.campaign;
    const r = rollDie(c.rng, 1000); c.rng = r.state;
    if ((r.value - 1) / 1000 < node.wandering.chance) {
      return enterScene(state, module, node.wandering.battleScene);
    }
  }
  // A finished location redirects to its "already done" beat: first matching
  // conditional destination wins, else the node's default scene.
  const redirect = node.sceneWhen?.find((w) => w.if.every((r) => requirementMet(state, r)));
  return enterScene(state, module, redirect ? redirect.to : node.scene);
}

// --- Dungeons ---------------------------------------------------------------
//
// A dungeon scene is a map of rooms the party walks, one link at a time. The
// map itself stays on screen; everything that happens in it — a room's fight,
// its conversation, what a search turns up — is an ordinary scene entered from
// here, and routing back to `@hub` returns to the room the party stands in.

/** The dungeon the party is in (standing on its map or in one of its scenes). */
function hubDungeon(state: AdventureState, module: Module): { id: Id; dungeon: Dungeon } | undefined {
  const scene = state.hub ? module.scenes[state.hub] : undefined;
  return scene?.kind === 'dungeon' ? { id: scene.id, dungeon: scene.dungeon } : undefined;
}

/** The party's progress through a dungeon, made on first use. A save from
 *  before a room was renamed puts the party back at the entry. */
export function dungeonProgress(state: AdventureState, sceneId: Id, d: Dungeon): DungeonProgress {
  const all = (state.dungeons ??= {});
  let p = all[sceneId];
  if (!p) {
    p = {
      at: d.entry, seen: [], cleared: [], played: [], searched: [], opened: [], forceTried: [],
      revealed: [], ambushRolled: [], pending: true,
      ...(d.torch ? { torch: d.torch.length } : {}),
    };
    all[sceneId] = p;
  }
  if (!roomOf(d, p.at)) { p.at = d.entry; p.pending = true; delete p.from; }
  return p;
}

function enterDungeon(
  state: AdventureState, module: Module, scene: Extract<Scene, { kind: 'dungeon' }>, fromOutside: boolean,
): AdventureEvent[] {
  const d = scene.dungeon;
  const p = dungeonProgress(state, scene.id, d);
  if (fromOutside || p.outside) {
    delete p.outside;
    // Walking back in: at the door again, with a fresh torch.
    p.at = d.entry;
    delete p.from;
    p.pending = true;
    if (d.torch) p.torch = d.torch.length;
  }
  return p.pending ? arrive(state, module, scene.id, d, p) : [];
}

/** The event of the room the party stands in, if it plays until something
 *  holds and that something doesn't yet: a confrontation still under way. */
function standingEvent(state: AdventureState, d: Dungeon, p: DungeonProgress): Id | undefined {
  const ev = roomOf(d, p.at)?.event;
  return ev?.until && !ev.until.every((r) => requirementMet(state, r)) ? ev.scene : undefined;
}

/**
 * The party has walked into `p.at`: the room has its say. Its prose the first
 * time; any secret door sharp eyes catch; its fight, until won; then its event.
 * A fight leaves the arrival pending, so once it is won the event still plays.
 */
function arrive(state: AdventureState, module: Module, sceneId: Id, d: Dungeon, p: DungeonProgress): AdventureEvent[] {
  const room = roomOf(d, p.at)!;
  const events: AdventureEvent[] = [];
  const first = !p.seen.includes(room.id);
  if (first) p.seen.push(room.id);
  events.push({ type: 'room', roomId: room.id, name: room.name, ...(first && room.firstVisit ? { firstVisit: paragraphsFor(state, room.firstVisit) } : {}) });

  const passive = partyPassivePerception(state.campaign);
  for (const { link } of allLinksAt(d, room.id)) {
    const key = linkKey(link);
    if (link.door?.secret && !p.revealed.includes(key) && passive >= link.door.secret.dc) {
      p.revealed.push(key);
      events.push({ type: 'doorFound', link: key });
    }
  }

  if (room.fight && !p.cleared.includes(room.id)) {
    p.pending = true;
    events.push(...enterScene(state, module, room.fight));
    return events;
  }
  delete p.pending;
  if (room.event) {
    const done = room.event.until
      ? room.event.until.every((r) => requirementMet(state, r))
      : p.played.includes(room.id);
    if (!done) {
      if (!room.event.until) p.played.push(room.id);
      events.push(...enterScene(state, module, room.event.scene));
    }
  }
  return events;
}

/** Every link touching a room, either way, one-way or not (for secrets). */
function allLinksAt(d: Dungeon, roomId: Id): Array<{ link: DungeonLink; to: Id }> {
  return d.links
    .filter((l) => l.a === roomId || l.b === roomId)
    .map((link) => ({ link, to: link.a === roomId ? link.b : link.a }));
}

/** Why a link cannot be walked from where the party stands now, or null. */
function doorBlocked(state: AdventureState, p: DungeonProgress, link: DungeonLink): string | null {
  const door = link.door;
  if (!door?.locked || p.opened.includes(linkKey(link))) return null;
  if (door.locked.every((r) => requirementMet(state, r))) return null;
  return door.note ?? blockedReason(state, door.locked);
}

/** A door the party can see from the room it is in. */
export interface DungeonExit {
  to: Id;
  link: string;
  /** Why it will not open, or null. */
  blocked: string | null;
  /** It can be forced (once): the skill and DC. */
  force?: { skill: string; dc: number };
}

/** The doors out of the room the party stands in: not the unfound secrets,
 *  nor the far side of a one-way drop. */
export function dungeonExits(state: AdventureState, module: Module): DungeonExit[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon') return [];
  const d = scene.dungeon;
  const p = dungeonProgress(state, scene.id, d);
  const out: DungeonExit[] = [];
  for (const { link, to } of linksFrom(d, p.at)) {
    const key = linkKey(link);
    if (link.door?.secret && !p.revealed.includes(key)) continue;
    const blocked = doorBlocked(state, p, link);
    const force = blocked && link.door?.force && !p.forceTried.includes(key) ? link.door.force : undefined;
    out.push({ to, link: key, blocked, ...(force ? { force } : {}) });
  }
  return out;
}

/**
 * The way to `target` through rooms already seen, one link at a time, or null.
 * Tapping a room across the map walks the party there; anything still waiting
 * in a room on the way stops it, since passing through a room is entering it.
 */
export function dungeonRoute(state: AdventureState, module: Module, target: Id): Id[] | null {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon') return null;
  const d = scene.dungeon;
  const p = dungeonProgress(state, scene.id, d);
  if (target === p.at) return [];
  const prev = new Map<Id, Id>([[p.at, p.at]]);
  const q = [p.at];
  while (q.length) {
    const cur = q.shift()!;
    for (const { link, to } of linksFrom(d, cur)) {
      if (prev.has(to)) continue;
      if (link.door?.secret && !p.revealed.includes(linkKey(link))) continue;
      if (doorBlocked(state, p, link)) continue;
      if (to !== target && !p.seen.includes(to)) continue;
      prev.set(to, cur);
      if (to === target) {
        const path = [to];
        let x = cur;
        while (x !== p.at) { path.unshift(x); x = prev.get(x)!; }
        return path;
      }
      q.push(to);
    }
  }
  return null;
}

/** Walk to a room: next door, or across rooms already seen. Stops the moment
 *  anything happens (a fight, a conversation, the torch). */
export function walkTo(state: AdventureState, module: Module, target: Id): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon') throw new Error('walkTo outside a dungeon');
  const path = dungeonRoute(state, module, target);
  if (!path) throw new Error(`No way to '${target}' from here`);
  const events: AdventureEvent[] = [];
  for (const to of path) {
    events.push(...step(state, module, scene.id, scene.dungeon, to));
    if (state.sceneId !== scene.id) break;
  }
  return events;
}

function spendTorch(state: AdventureState, module: Module, d: Dungeon, p: DungeonProgress, amount: number): AdventureEvent[] | null {
  if (!d.torch || p.torch === undefined) return null;
  p.torch = Math.max(0, p.torch - amount);
  if (p.torch > 0) return null;
  p.outside = true;
  return enterScene(state, module, d.torch.out);
}

function step(state: AdventureState, module: Module, sceneId: Id, d: Dungeon, to: Id): AdventureEvent[] {
  const p = dungeonProgress(state, sceneId, d);
  const link = linksFrom(d, p.at).find((x) => x.to === to)?.link;
  if (!link) throw new Error(`No door from '${p.at}' to '${to}'`);
  const key = linkKey(link);
  if (link.door?.secret && !p.revealed.includes(key)) throw new Error(`No door from '${p.at}' to '${to}'`);
  if (doorBlocked(state, p, link)) throw new Error(`The door to '${to}' is shut`);
  if (link.door?.locked && !p.opened.includes(key)) p.opened.push(key); // walked through: it stays open
  p.from = p.at;
  p.at = to;
  p.pending = true;

  const dark = spendTorch(state, module, d, p, link.length ?? 1);
  if (dark) return dark;
  const ambush = link.door?.ambush;
  if (ambush && !p.ambushRolled.includes(key)) {
    p.ambushRolled.push(key);
    const c = state.campaign;
    const r = rollDie(c.rng, 1000); c.rng = r.state;
    if ((r.value - 1) / 1000 < ambush.chance) return enterScene(state, module, ambush.battle);
  }
  return arrive(state, module, sceneId, d, p);
}

/** What an empty search turns up: one of a few lines, fixed per room, so a
 *  dungeon of empty corners doesn't say the same sentence in every one. Every
 *  room can be searched (a hidden door must not give itself away by the
 *  option alone), so most searches find nothing. */
const EMPTY_SEARCHES = [
  'Nothing turns up.',
  'You sound the walls and lift what can be lifted. Nothing.',
  'Dust, old bones and nothing else.',
  'Whatever was worth taking here went long ago.',
  'You find only scratches in the stone, and none of them mean anything.',
];
function emptySearch(roomId: string, own?: readonly string[]): string {
  const lines = own?.length ? own : EMPTY_SEARCHES;
  let h = 0;
  for (const ch of roomId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[h % lines.length]!;
}

/** Whether the room the party stands in can still be searched. */
export function canSearch(state: AdventureState, module: Module): boolean {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon') return false;
  const p = dungeonProgress(state, scene.id, scene.dungeon);
  return !p.searched.includes(p.at);
}

/**
 * Search the room, once: the party's best eye against any secret door in its
 * walls, then whatever the room keeps for a search. Costs a little light.
 */
export function searchRoom(state: AdventureState, module: Module): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon' || !canSearch(state, module)) throw new Error('Nothing to search here');
  const d = scene.dungeon;
  const p = dungeonProgress(state, scene.id, d);
  const room = roomOf(d, p.at)!;
  p.searched.push(room.id);
  const events: AdventureEvent[] = [];
  const secrets = allLinksAt(d, room.id).filter(({ link }) => link.door?.secret && !p.revealed.includes(linkKey(link)));
  let found = 0;
  if (secrets.length > 0) {
    const c = state.campaign;
    const dc = Math.min(...secrets.map(({ link }) => link.door!.secret!.dc));
    const guidanceKey = `${scene.id}#${room.id}`;
    const roll = characterSkillCheck(c, bestAtSkill(c, 'investigation').idx, 'investigation', dc,
      { noGuidance: state.guidanceSpent.includes(guidanceKey) });
    state.guidanceSpent.push(guidanceKey);
    events.push({ type: 'check', roll, success: roll.success });
    for (const { link } of secrets) {
      if (roll.total >= link.door!.secret!.dc) {
        p.revealed.push(linkKey(link));
        events.push({ type: 'doorFound', link: linkKey(link) });
        found++;
      }
    }
  }
  const dark = spendTorch(state, module, d, p, 1);
  if (dark) return [...events, ...dark];
  if (room.search) events.push(...enterScene(state, module, room.search));
  else if (found === 0) events.push({ type: 'text', paragraphs: [emptySearch(room.id, d.emptySearches)] });
  return events;
}

/** Try to force a locked door next to the party, once. The key still works. */
export function forceDoor(state: AdventureState, module: Module, link: string): AdventureEvent[] {
  const exit = dungeonExits(state, module).find((x) => x.link === link);
  const scene = currentScene(state, module);
  if (!exit?.force || scene.kind !== 'dungeon') throw new Error('That door cannot be forced');
  const p = dungeonProgress(state, scene.id, scene.dungeon);
  p.forceTried.push(link);
  const events: AdventureEvent[] = [];
  const ok = rollFor(state, exit.force.skill as Parameters<typeof partySkillCheck>[1], exit.force.dc, 'best', events);
  if (ok) p.opened.push(link);
  events.push({ type: 'text', paragraphs: [ok ? 'It gives.' : 'It holds.'] });
  return events;
}

/** The way out from the room the party stands in, if it has one. */
export function dungeonExitHere(state: AdventureState, module: Module): { to: Id; label: string } | null {
  const scene = currentScene(state, module);
  if (scene.kind !== 'dungeon') return null;
  const room = roomOf(scene.dungeon, dungeonProgress(state, scene.id, scene.dungeon).at);
  if (!room?.exit) return null;
  return { to: room.exit.to, label: room.exit.label ?? 'Leave' };
}

export function leaveDungeon(state: AdventureState, module: Module): AdventureEvent[] {
  const exit = dungeonExitHere(state, module);
  const scene = currentScene(state, module);
  if (!exit || scene.kind !== 'dungeon') throw new Error('No way out from this room');
  dungeonProgress(state, scene.id, scene.dungeon).outside = true;
  return enterScene(state, module, exit.to);
}

/**
 * The board a battle scene is fought on. A named map, or — for `@room` — one
 * drawn for where the party stands: the dungeon's theme, deeper for a big
 * room, a narrow run for a fight in a corridor. Seeded like the fight, so a
 * retried fight redraws.
 */
export function battleMap(state: AdventureState, module: Module): MapData {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') throw new Error(`battleMap on a ${scene.kind} scene`);
  if (scene.mapId !== ROOM_MAP_REF) {
    const map = MAPS[scene.mapId];
    if (!map) throw new Error(`Unknown map: ${scene.mapId}`);
    return map;
  }
  const d = hubDungeon(state, module);
  const p = d ? dungeonProgress(state, d.id, d.dungeon) : undefined;
  const room = d && p ? roomOf(d.dungeon, p.at) : undefined;
  const inCorridor = !!p?.pending && room?.fight !== scene.id;
  const { value } = generateArenaMap({
    theme: d?.dungeon.theme ?? 'stone',
    height: room?.size === 'large' && !inCorridor ? 12 : 10,
    ...(inCorridor ? { layout: 'chokepoint' as const } : {}),
  }, battleSeed(state, scene.id));
  const where = d?.dungeon.title ?? 'A dungeon';
  return { ...value.map, id: `room-${scene.id}`, name: inCorridor ? `${where}, in a corridor` : where };
}

// --- Driver callbacks (battle / shop / rest) --------------------------------

/** After the driver runs the battle for the current `battle` scene. */
/** Has this run already won this battle? A won fight pays once: its
 *  encounter XP and loot (the caller's), and the reward effects of its win. */
export const battleWonBefore = (state: AdventureState, sceneId: Id): boolean =>
  (state.wonBattles ?? []).includes(sceneId);

/** The effects that are a fight's reward rather than its story. */
const REWARD_EFFECTS = new Set<Effect['kind']>(['gold', 'xp', 'xpToLevel', 'addItem']);

export function resolveBattle(state: AdventureState, module: Module, won: boolean): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') throw new Error(`resolveBattle on a ${scene.kind} scene`);
  // Count the attempt (win or lose) so any refight of this scene — a loss
  // retry, a re-triggered camp ambush — draws a different battleSeed.
  (state.battleAttempts ??= {})[scene.id] = (state.battleAttempts[scene.id] ?? 0) + 1;
  delete state.battleSurprise;
  if (won) {
    // A room's own fight, won: the room is cleared for good.
    const d = hubDungeon(state, module);
    if (d) {
      const p = dungeonProgress(state, d.id, d.dungeon);
      if (roomOf(d.dungeon, p.at)?.fight === scene.id && !p.cleared.includes(p.at)) p.cleared.push(p.at);
    }
    // A fight won again (however the party got back to it) tells its story
    // again but pays nothing: no farming a won fight through a way back.
    if (battleWonBefore(state, scene.id)) {
      const effects = scene.onWin.effects?.filter((e) => !REWARD_EFFECTS.has(e.kind));
      return applyOutcome(state, module, { ...scene.onWin, ...(effects ? { effects } : {}) });
    }
    (state.wonBattles ??= []).push(scene.id);
    return applyOutcome(state, module, scene.onWin);
  }
  // Loss: an authored per-battle branch wins; else the module's defeat scene
  // (the party is dragged back, revived at half HP); else just retry the fight.
  // Either way the party is picked up first (half HP): an authored loss beat
  // is still somebody dragging them off the field, and leaving them at 0 HP
  // put a party on the map that could not survive its next step.
  // Beaten inside a dungeon: whatever the room held is still there when the
  // party comes back to it (a wipe, then "go straight back in"). The arrival
  // plays again: the room's fight, or a confrontation not yet settled. Without
  // this the room stood empty, and the chief could be camped in front of.
  const hub = hubDungeon(state, module);
  if (hub) dungeonProgress(state, hub.id, hub.dungeon).pending = true;
  if (scene.onLoss) {
    reviveParty(state.campaign);
    restCompanions(state, 'revive', module);
    return applyOutcome(state, module, scene.onLoss);
  }
  if (module.defeatScene) {
    reviveParty(state.campaign);
    restCompanions(state, 'revive', module);
    return enterScene(state, module, module.defeatScene);
  }
  // No authored loss beat and no defeat scene: the fight is simply offered
  // again. The party MUST be picked up first. Without that the retry starts
  // with everyone still at 0 HP, so it is lost before the first turn, and the
  // only thing on offer is the same fight again — a loop with no exit, which
  // reads from the outside as "I pressed Continue and nothing happened".
  reviveParty(state.campaign);
  restCompanions(state, 'revive', module);
  return enterScene(state, module, state.sceneId);
}

// --- At a fight's door: parley, sneak up, fall back -------------------------
//
// The Gold Box choice before every encounter. Fight is the default and needs
// nothing here; the other three are what this adds.

const doorKey = (sceneId: Id, what: 'parley' | 'sneak') => `${sceneId}:@${what}`;

/** How hard the roster is to creep up on: its keenest passive Perception. */
export function sneakDc(encounterId: Id): number {
  const members = ENCOUNTERS[encounterId]?.members ?? [];
  let best = 10;
  for (const id of members) {
    const m = MONSTERS[id];
    if (m) best = Math.max(best, 10 + abilityMod(m.abilities.wis));
  }
  return best;
}

export interface BattleOptions {
  /** Talking them down, if the fight offers it and it has not been tried. */
  parley?: { label: string; skill: string; dc: number };
  /** Creeping up on them, unless the fight is already an ambush either way. */
  sneak?: { dc: number };
  /** Falling back to the location the party came from, and its name. */
  fallBack?: { title: string };
}

export function battleOptions(state: AdventureState, module: Module): BattleOptions {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') return {};
  const out: BattleOptions = {};
  if (scene.parley && !state.consumedChoices.includes(doorKey(scene.id, 'parley')) && !attemptSpent(state, scene.parley.attempt)) {
    out.parley = {
      label: scene.parley.label ?? 'Parley',
      skill: scene.parley.skill ?? 'persuasion',
      dc: scene.parley.dc,
    };
  }
  if (!scene.surprise && !state.consumedChoices.includes(doorKey(scene.id, 'sneak'))) {
    out.sneak = { dc: sneakDc(scene.encounterId) };
  }
  const hub = state.hub;
  // Caught out (the scene's own ambush, or a sneak-up rolled at its door)
  // means no falling back: they are on you. It also keeps a failed check's
  // worse fight from being fled and walked back into clean.
  const caughtOut = scene.surprise === 'party'
    || (state.battleSurprise?.sceneId === scene.id && state.battleSurprise.side === 'party');
  if (!scene.noFlee && !caughtOut && hub && hub !== scene.id && isHub(module.scenes[hub])) {
    out.fallBack = { title: hubTitleOf(module.scenes[hub]) ?? hub };
  }
  return out;
}

/** Try to talk them down. Success takes the authored way round the fight. */
export function parleyBattle(state: AdventureState, module: Module, actorIdx?: number): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle' || !scene.parley) throw new Error('No parley here');
  if (!battleOptions(state, module).parley) throw new Error('Parley already tried');
  state.consumedChoices.push(doorKey(scene.id, 'parley'));
  spendAttempt(state, scene.parley!.attempt);
  const p = scene.parley;
  const skill = (p.skill ?? 'persuasion') as Parameters<typeof characterSkillCheck>[2];
  const roller = p.roller ?? 'chosen';
  const events: AdventureEvent[] = [];
  const success = actorIdx !== undefined && roller === 'chosen'
    ? rollChosen(state, skill, p.dc, actorIdx, events)
    : rollFor(state, skill, p.dc, roller, events);
  if (success) {
    delete state.battleSurprise;
    events.push(...applyOutcome(state, module, p.success));
  } else if (p.failure) {
    events.push(...applyOutcome(state, module, p.failure));
  } else {
    events.push({ type: 'text', paragraphs: p.refused ? paragraphsFor(state, p.refused) : ["They aren't interested in talking."] });
  }
  return events;
}

/**
 * Creep up on them: a group Stealth check against their keenest ears. Get it
 * right and they lose their first round; get it wrong and you do. Once per
 * fight — falling back and trying again is not a second chance.
 */
export function sneakBattle(state: AdventureState, module: Module): AdventureEvent[] {
  const scene = currentScene(state, module);
  const opt = battleOptions(state, module).sneak;
  if (scene.kind !== 'battle' || !opt) throw new Error('No sneaking here');
  state.consumedChoices.push(doorKey(scene.id, 'sneak'));
  const events: AdventureEvent[] = [];
  const success = rollFor(state, 'stealth', opt.dc, 'group', events);
  state.battleSurprise = { sceneId: scene.id, side: success ? 'enemies' : 'party' };
  events.push({
    type: 'text',
    paragraphs: [success
      ? 'Nobody looks up. You are on them before they know it.'
      : 'A boot scrapes stone. Every head turns your way.'],
  });
  return events;
}

/** Who is surprised when the current fight starts, from the scene or a sneak. */
export function battleSurpriseOf(state: AdventureState, module: Module): 'party' | 'enemies' | undefined {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') return undefined;
  if (scene.surprise) return scene.surprise;
  return state.battleSurprise?.sceneId === scene.id ? state.battleSurprise.side : undefined;
}

/**
 * Fall back — before the fight, or out of it (a retreat). The party returns to
 * the location it came from and the fight stays where it was: going back that
 * way meets it again. Counted as an attempt, so a second go rolls fresh dice.
 */
export function fleeBattle(state: AdventureState, module: Module, retreated: boolean): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle' || !battleOptions(state, module).fallBack) throw new Error('No way back from here');
  if (retreated) (state.battleAttempts ??= {})[scene.id] = (state.battleAttempts[scene.id] ?? 0) + 1;
  delete state.battleSurprise;
  // In a dungeon, falling back puts the party back in the room it came from,
  // whatever started the fight: the room's own fight, a corridor ambush, or a
  // scene the room's event led to (which plays again when the party returns,
  // until its condition holds). The fight stays where it was. A night's
  // ambush is the exception: it came to the party's camp, so the party runs
  // off into the dark of the room it slept in, not back a room.
  const d = hubDungeon(state, module);
  if (d && d.dungeon.camp?.risky?.battleScene !== scene.id) {
    const p = dungeonProgress(state, d.id, d.dungeon);
    if (p.pending || p.from || roomOf(d.dungeon, p.at)?.fight === scene.id) {
      p.at = p.from ?? d.dungeon.entry;
      delete p.from;
      delete p.pending;
    }
  }
  return [
    { type: 'text', paragraphs: [retreated
      ? 'You break off and get clear. They let you go — this time.'
      : 'You think better of it and fall back the way you came.'] },
    ...enterScene(state, module, HUB_REF),
  ];
}

/** After the driver's shop / rest interaction, advance to the scene's `next`. */
export function resolveShopOrRest(state: AdventureState, module: Module): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'shop' && scene.kind !== 'rest') {
    throw new Error(`resolveShopOrRest on a ${scene.kind} scene`);
  }
  const events: AdventureEvent[] = [];
  if (scene.kind === 'rest') {
    if (scene.variant === 'long') healParty(state.campaign, 'full');
    else shortRest(state.campaign);
    restCompanions(state, scene.variant === 'long' ? 'full' : 'short', module);
    if (scene.variant === 'long') events.push(...endDay(state, module));
  }
  return [...events, ...enterScene(state, module, scene.next)];
}

// --- Shop (buy/sell live in the UI; gambits roll here) ----------------------

export type HaggleSkill = keyof typeof HAGGLE;

/** The items a shop scene offers (its own stock, or the default), filtered to
 *  those with a real price. */
export function shopStock(scene: Scene, level?: number): Id[] {
  if (scene.kind !== 'shop') return [];
  const priced = (scene.stock ?? SHOP_STOCK).filter((id) => itemPrice(id) !== undefined);
  // With a party level, thin the magical wares to a limited, level-scaled
  // rotation (seeded by the shop's id so each merchant differs). Without one
  // (a headless/legacy caller), the full shelf is returned unchanged.
  return level === undefined ? priced : shopOffering(priced, level, scene.id);
}

/** The visit record for a shop scene (created on enter; a safe default if not). */
export function shopVisitOf(state: AdventureState, sceneId: Id): ShopVisit {
  return state.shopVisits[sceneId] ?? { priceMult: 1, haggleUsed: false, stealUsed: false };
}

/** An item's price this visit, list price scaled by any haggle result. */
export function shopPrice(state: AdventureState, sceneId: Id, itemId: Id): number {
  return Math.ceil((itemPrice(itemId) ?? 0) * shopVisitOf(state, sceneId).priceMult);
}

/** Haggle once per visit: a party skill check that shifts every price up or
 *  down for the rest of the visit. Returns the roll as a `check` event so the
 *  dice ritual reveals it, exactly like a scene check. */
export function shopHaggle(state: AdventureState, module: Module, skill: HaggleSkill): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'shop') throw new Error(`shopHaggle on a ${scene.kind} scene`);
  const visit = state.shopVisits[scene.id];
  if (!visit || visit.haggleUsed) throw new Error('Haggle already used this visit');
  visit.haggleUsed = true;
  const { roll, priceMultiplier } = attemptHaggle(state.campaign, skill);
  visit.priceMult = priceMultiplier;
  return [{ type: 'check', roll, success: roll.success }];
}

/** Steal once per visit: Stealth AND Sleight of Hand vs the shop. On success a
 *  random item from *this shop's* stock lands in a pack; caught, a fine. The
 *  decisive roll is surfaced as a `check` event (its success matching the
 *  overall outcome), plus the item/gold consequence. */
export function shopSteal(state: AdventureState, module: Module): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'shop') throw new Error(`shopSteal on a ${scene.kind} scene`);
  const visit = state.shopVisits[scene.id];
  if (!visit || visit.stealUsed) throw new Error('Already tried to steal this visit');
  visit.stealUsed = true;
  const c = state.campaign;
  const result = attemptSteal(c, shopStock(scene, partyLevelOf(c)));
  const decisive = result.success
    ? result.rolls[1]!                                   // the successful grab
    : (result.rolls.find((r) => !r.success) ?? result.rolls[0]!); // whichever tripped
  const events: AdventureEvent[] = [{ type: 'check', roll: decisive, success: result.success }];
  if (result.success && result.itemId) {
    events.push({ type: 'item', itemId: result.itemId, qty: 1, gained: true });
  } else if (result.fine > 0) {
    events.push({ type: 'gold', amount: -result.fine, total: c.gold });
  }
  return events;
}

// --- Camp (rest + party management) -----------------------------------------

/** The camp rule where the party is standing: the current explore scene's, or
 *  its hub's when they're in one of that location's sub-scenes. Null = the
 *  party can't rest here (gear management is always allowed; sleeping isn't). */
export function campRule(state: AdventureState, module: Module): CampRule | null {
  // Only on a map or in a dungeon. A camp opened from inside a scene would let
  // a night's ambush (whose win goes back to the map) skip a one-way scene.
  const scene = currentScene(state, module);
  const place = isHub(scene) ? scene : undefined;
  if (place?.kind === 'explore') return place.map.camp ?? null;
  if (place?.kind === 'dungeon') return place.dungeon.camp ?? null;
  return null;
}

/** Nights left to sleep at this camp: null when it sets no limit. */
export function nightsLeft(state: AdventureState, module: Module): number | null {
  const rule = campRule(state, module);
  if (rule?.nights === undefined) return null;
  return Math.max(0, rule.nights - (state.campNights?.[state.sceneId] ?? 0));
}

/** Rest at a campable location. A long rest at a `risky` camp may be
 *  interrupted: a chance roll on the campaign rng diverts to its battle scene
 *  (whose onWin routes home). Returns the event stream (heal, maybe a battle).
 *  Throws if there is no camp here — the UI only offers rest when campRule set. */
export function campRest(
  state: AdventureState, module: Module, variant: 'short' | 'long',
): AdventureEvent[] {
  const rule = campRule(state, module);
  if (!rule) throw new Error('No camp at this location');
  if (variant === 'long' && nightsLeft(state, module) === 0) throw new Error('No nights left to sleep here');
  const events: AdventureEvent[] = [];
  const c = state.campaign;
  // A risky long rest can be interrupted *before* you get any benefit — roll
  // first. Interrupted: you fight with the resources you already have and
  // recover nothing this night (bank the fire and try again after, at another
  // roll's risk). Short rests are never interrupted.
  if (variant === 'long' && rule.risky) {
    const r = rollDie(c.rng, 1000); c.rng = r.state;
    if ((r.value - 1) / 1000 < rule.risky.chance) {
      return enterScene(state, module, rule.risky.battleScene);
    }
  }
  // A night slept counts against the camp's limit; one broken up by a fight
  // (above) was never slept.
  if (variant === 'long' && rule.nights !== undefined) {
    (state.campNights ??= {})[state.sceneId] = (state.campNights[state.sceneId] ?? 0) + 1;
  }
  const { totalHealed } = variant === 'long' ? longRest(c) : shortRest(c);
  restCompanions(state, variant === 'long' ? 'full' : 'short', module);
  events.push({ type: 'heal', amount: totalHealed });
  if (variant === 'long') events.push(...endDay(state, module));
  return events;
}

/** The chapter's day: 1 until the first long rest. */
export const dayOf = (state: AdventureState): number => state.day ?? 1;

/**
 * A night slept: the next morning begins, and any dawn the module set for it
 * plays (its text, then its effects). See `Module.dawns`.
 */
export function endDay(state: AdventureState, module: Module): AdventureEvent[] {
  const day = dayOf(state) + 1;
  state.day = day;
  const events: AdventureEvent[] = [{ type: 'dawn', day }];
  for (const d of module.dawns ?? []) {
    if (d.day !== day) continue;
    events.push({ type: 'text', paragraphs: paragraphsFor(state, d.text) });
    applyEffects(state, d.effects, events, module);
  }
  return events;
}

// --- Companions -------------------------------------------------------------

/** A companion's full hit points, from their stat block. */
function companionMaxHp(module: Module | undefined, id: Id): number | undefined {
  const def = module?.companions?.[id];
  return def ? MONSTERS[def.monsterId]?.hp : undefined;
}

/**
 * Rest the party's companions alongside it: a long rest (or a full heal) makes
 * them whole, a short one gives back half of their maximum, and being dragged
 * off a lost field leaves them on half, as it leaves the party.
 */
export function restCompanions(
  state: AdventureState, kind: 'full' | 'short' | 'revive', module?: Module,
): void {
  for (const x of state.companions ?? []) {
    if (kind === 'full' || x.hp === undefined) { delete x.hp; continue; }
    const max = companionMaxHp(module, x.id);
    if (max === undefined) { delete x.hp; continue; }
    x.hp = kind === 'short'
      ? Math.min(max, x.hp + Math.ceil(max / 2))
      : Math.max(x.hp, Math.ceil(max / 2));
    if (x.hp >= max) delete x.hp;
  }
}

/**
 * The companions as combatants for a fight on `grid`, standing in the first
 * open squares behind the party's front rank. Knocked out at 0 rather than
 * killed, as the heroes are.
 */
export function companionCombatants(
  state: AdventureState, module: Module, grid: GridState, taken: Position[],
): Combatant[] {
  const out: Combatant[] = [];
  const used = new Set(taken.map((p) => `${p.x},${p.y}`));
  const open: Position[] = [];
  for (let y = 0; y < Math.min(grid.height, 3); y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = cellAt(grid, { x, y });
      if (cell && !blocksMovement(cell.terrain) && !used.has(`${x},${y}`)) open.push({ x, y });
    }
  }
  for (const x of state.companions ?? []) {
    const def = module.companions?.[x.id];
    const at = open.shift();
    if (!def || !MONSTERS[def.monsterId] || !at) continue;
    const c = buildMonster(def.monsterId, 'team1', at);
    out.push({
      ...c,
      id: `companion-${def.id}`,
      name: def.name,
      ...(def.portraitId ? { portraitId: def.portraitId } : {}),
      companion: true,
      unconsciousAtZero: true,
      hp: Math.max(1, Math.min(c.maxHp, x.hp ?? c.maxHp)),
    });
  }
  return out;
}

/** After a fight (won, lost or fled): what it cost the companions, never below 1. */
export function readBackCompanions(state: AdventureState, fought: Combatant[]): void {
  for (const x of state.companions ?? []) {
    const c = fought.find((f) => f.id === `companion-${x.id}`);
    if (!c) continue;
    const hp = Math.max(1, c.hp);
    if (hp >= c.maxHp) delete x.hp; else x.hp = hp;
  }
}

/** A seed for a battle scene: campaign rng + scene id + attempt count, so a
 *  retried fight differs (fixing the identical-dice-on-retry wart). The count
 *  comes from `battleAttempts` (bumped by resolveBattle) — `visited` can't
 *  carry it, since enterScene dedupes revisits. */
export function battleSeed(state: AdventureState, sceneId: Id): number {
  const attempts = state.battleAttempts?.[sceneId] ?? 0;
  let h = state.campaign.rng ^ (attempts * 2654435761);
  for (let i = 0; i < sceneId.length; i++) h = (h * 31 + sceneId.charCodeAt(i)) | 0;
  return h >>> 0;
}
