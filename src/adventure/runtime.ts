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
import {
  type CampaignState, type SkillRoll, type GroupCheckResult,
  characterSkillCheck, partySkillCheck, groupSkillCheck, bestAtSkill, characterSkillBonus,
  levelForXp, partyStash, addItem, healParty, shortRest,
} from '../campaign/campaign.js';
import type {
  Module, Scene, Choice, Effect, Requirement, Outcome, Roller, ExploreNode, JournalEntry,
} from './types.js';

export interface AdventureState {
  campaign: CampaignState;
  moduleId: Id;
  sceneId: Id;
  flags: Record<string, boolean | number>;
  visited: Id[];
  journal: JournalEntry[];
  /** Scene ids whose once-per-scene Guidance has been spent (checks after the
   *  first in a scene get no cleric +1d4). */
  guidanceSpent: Id[];
}

export type AdventureEvent =
  | { type: 'scene'; sceneId: Id; kind: Scene['kind'] }
  | { type: 'text'; paragraphs: string[] }
  | { type: 'check'; roll: SkillRoll; success: boolean }
  | { type: 'groupCheck'; result: GroupCheckResult; success: boolean }
  | { type: 'flag'; flag: string; value: boolean | number }
  | { type: 'gold'; amount: number; total: number }
  | { type: 'item'; itemId: Id; qty: number; gained: boolean }
  | { type: 'xp'; amount: number; leveledTo?: number }
  | { type: 'heal'; amount: number }
  | { type: 'journal'; entry: JournalEntry }
  | { type: 'secretRevealed'; nodeId: Id }
  | { type: 'startBattle'; encounterId: Id; mapId: Id; sceneId: Id }
  | { type: 'enterShop'; next: Id }
  | { type: 'rest'; variant: 'short' | 'long'; next: Id }
  | { type: 'ending'; outcome: 'victory' | 'defeat' };

// --- Setup ------------------------------------------------------------------

export function startAdventure(campaign: CampaignState, module: Module): AdventureState {
  const state: AdventureState = {
    campaign, moduleId: module.id, sceneId: module.start,
    flags: {}, visited: [], journal: [], guidanceSpent: [],
  };
  return state;
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
  }
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
  }
}

// --- Effects ----------------------------------------------------------------

function applyEffect(state: AdventureState, eff: Effect, events: AdventureEvent[]): void {
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
    case 'gold':
      c.gold = Math.max(0, c.gold + eff.amount);
      events.push({ type: 'gold', amount: eff.amount, total: c.gold });
      break;
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
      events.push({ type: 'xp', amount: eff.amount, ...(after > before ? { leveledTo: after } : {}) });
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
  }
}

function applyEffects(state: AdventureState, effects: Effect[] | undefined, events: AdventureEvent[]): void {
  for (const eff of effects ?? []) applyEffect(state, eff, events);
}

// --- Navigation -------------------------------------------------------------

/** Enter a scene: mark visited, emit its entry event and any intro text. Does
 *  NOT auto-resolve checks/battles/shops — the driver drives those. */
export function enterScene(state: AdventureState, module: Module, sceneId: Id): AdventureEvent[] {
  state.sceneId = sceneId;
  if (!state.visited.includes(sceneId)) state.visited.push(sceneId);
  const scene = currentScene(state, module);
  const events: AdventureEvent[] = [{ type: 'scene', sceneId, kind: scene.kind }];

  switch (scene.kind) {
    case 'story': events.push({ type: 'text', paragraphs: scene.text }); break;
    case 'dialogue': events.push({ type: 'text', paragraphs: scene.lines }); break;
    case 'check': events.push({ type: 'text', paragraphs: scene.intro }); break;
    case 'battle':
      if (scene.intro) events.push({ type: 'text', paragraphs: scene.intro });
      events.push({ type: 'startBattle', encounterId: scene.encounterId, mapId: scene.mapId, sceneId });
      break;
    case 'shop':
      if (scene.intro) events.push({ type: 'text', paragraphs: scene.intro });
      events.push({ type: 'enterShop', next: scene.next });
      break;
    case 'rest':
      if (scene.intro) events.push({ type: 'text', paragraphs: scene.intro });
      events.push({ type: 'rest', variant: scene.variant, next: scene.next });
      break;
    case 'ending':
      events.push({ type: 'text', paragraphs: scene.text });
      events.push({ type: 'ending', outcome: scene.outcome });
      break;
    case 'explore': break; // the UI renders the node map; no auto text
  }
  return events;
}

function applyOutcome(state: AdventureState, module: Module, outcome: Outcome): AdventureEvent[] {
  const events: AdventureEvent[] = [];
  if (outcome.text) events.push({ type: 'text', paragraphs: outcome.text });
  applyEffects(state, outcome.effects, events);
  events.push(...enterScene(state, module, outcome.to));
  return events;
}

// --- Skill checks -----------------------------------------------------------

function rollFor(
  state: AdventureState, skill: Parameters<typeof partySkillCheck>[1], dc: number, roller: Roller,
  events: AdventureEvent[],
): boolean {
  const c = state.campaign;
  const noGuidance = state.guidanceSpent.includes(state.sceneId);
  if (roller === 'group') {
    const result = groupSkillCheck(c, skill, dc, { noGuidance });
    state.guidanceSpent.push(state.sceneId);
    events.push({ type: 'groupCheck', result, success: result.success });
    return result.success;
  }
  const idx = roller === 'best' ? bestAtSkill(c, skill).idx : chosenRoller(state, skill);
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
  actorIdx: number, events: AdventureEvent[],
): boolean {
  const noGuidance = state.guidanceSpent.includes(state.sceneId);
  const roll = characterSkillCheck(state.campaign, actorIdx, skill, dc, { noGuidance });
  state.guidanceSpent.push(state.sceneId);
  events.push({ type: 'check', roll, success: roll.success });
  return roll.success;
}

// --- Choices ----------------------------------------------------------------

/** The choices offered at the current story/dialogue scene, with block status. */
export function legalChoices(
  state: AdventureState, module: Module,
): Array<{ choice: Choice; blocked: string | null }> {
  const scene = currentScene(state, module);
  const next = scene.kind === 'story' || scene.kind === 'dialogue' ? scene.next : [];
  return next
    .map((choice) => ({ choice, blocked: blockedReason(state, choice.requires) }))
    .filter(({ choice, blocked }) => !(blocked && choice.hideWhenBlocked));
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

  const events: AdventureEvent[] = [];
  applyEffects(state, choice.effects, events);

  if (choice.check) {
    const roller = choice.check.roller ?? 'best';
    const success = actorIdx !== undefined && roller === 'chosen'
      ? rollChosen(state, choice.check.skill, choice.check.dc, actorIdx, events)
      : rollFor(state, choice.check.skill, choice.check.dc, roller, events);
    if (success) {
      events.push(...enterScene(state, module, choice.to));
    } else {
      applyEffects(state, choice.check.failEffects, events);
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
}

/** The nodes to render for the current explore scene: gated nodes carry a
 *  reason; secret nodes appear only once passive Perception meets their DC. */
export function exploreNodes(state: AdventureState, module: Module): VisibleNode[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'explore') return [];
  const passive = partyPassivePerception(state.campaign);
  const out: VisibleNode[] = [];
  for (const node of scene.map.nodes) {
    const secret = !!node.hidden;
    if (secret && passive < node.hidden!.dc) continue; // undiscovered
    out.push({ node, blocked: blockedReason(state, node.requires), secret });
  }
  return out;
}

/** Enter an explore node's scene (after its requirements). */
export function enterNode(state: AdventureState, module: Module, nodeId: Id): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'explore') throw new Error('enterNode outside an explore scene');
  const node = scene.map.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`No node ${nodeId}`);
  if (blockedReason(state, node.requires)) throw new Error(`Node ${nodeId} is blocked`);
  return enterScene(state, module, node.scene);
}

// --- Driver callbacks (battle / shop / rest) --------------------------------

/** After the driver runs the battle for the current `battle` scene. */
export function resolveBattle(state: AdventureState, module: Module, won: boolean): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') throw new Error(`resolveBattle on a ${scene.kind} scene`);
  if (won) return applyOutcome(state, module, scene.onWin);
  // Story mode with no explicit loss branch: retry the same battle.
  if (!scene.onLoss) return enterScene(state, module, state.sceneId);
  return applyOutcome(state, module, scene.onLoss);
}

/** After the driver's shop / rest interaction, advance to the scene's `next`. */
export function resolveShopOrRest(state: AdventureState, module: Module): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'shop' && scene.kind !== 'rest') {
    throw new Error(`resolveShopOrRest on a ${scene.kind} scene`);
  }
  if (scene.kind === 'rest') {
    if (scene.variant === 'long') healParty(state.campaign, 'full');
    else shortRest(state.campaign);
  }
  return enterScene(state, module, scene.next);
}

/** A seed for a battle scene: campaign rng + scene id + retry count, so a
 *  retried fight differs (fixing the identical-dice-on-retry wart). */
export function battleSeed(state: AdventureState, sceneId: Id): number {
  const attempts = state.visited.filter((v) => v === sceneId).length;
  let h = state.campaign.rng ^ (attempts * 2654435761);
  for (let i = 0; i < sceneId.length; i++) h = (h * 31 + sceneId.charCodeAt(i)) | 0;
  return h >>> 0;
}
