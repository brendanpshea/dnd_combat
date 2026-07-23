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
import { rollDie } from '../engine/rng.js';
import {
  type CampaignState, type SkillRoll, type GroupCheckResult,
  characterSkillCheck, partySkillCheck, groupSkillCheck, bestAtSkill, characterSkillBonus,
  levelForXp, LEVEL_XP, partyStash, addItem, healParty, shortRest, longRest, reviveParty,
  attemptHaggle, attemptSteal, itemPrice, SHOP_STOCK, HAGGLE,
} from '../campaign/campaign.js';
import {
  HUB_REF,
  type Module, type Scene, type Choice, type Effect, type Requirement, type Outcome,
  type Roller, type ExploreNode, type JournalEntry, type CampRule, type Approach,
} from './types.js';

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
  | { type: 'secretRevealed'; nodeId: Id }
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
  }
}

function applyEffects(state: AdventureState, effects: Effect[] | undefined, events: AdventureEvent[]): void {
  for (const eff of effects ?? []) applyEffect(state, eff, events);
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
  const scene = currentScene(state, module);
  if (scene.kind === 'explore') state.hub = resolved; // this is now the location
  const events: AdventureEvent[] = [{ type: 'scene', sceneId: resolved, kind: scene.kind, revisit }];

  switch (scene.kind) {
    case 'story': events.push({ type: 'text', paragraphs: scene.text }); break;
    case 'dialogue': events.push({ type: 'text', paragraphs: scene.lines }); break;
    case 'check': events.push({ type: 'text', paragraphs: scene.intro }); break;
    case 'challenge': events.push({ type: 'text', paragraphs: scene.intro }); break;
    case 'battle':
      if (scene.intro) events.push({ type: 'text', paragraphs: scene.intro });
      events.push({ type: 'startBattle', encounterId: scene.encounterId, mapId: scene.mapId, sceneId });
      break;
    case 'shop':
      // A fresh visit: haggle discount and spent gambits reset each entry.
      state.shopVisits[resolved] = { priceMult: 1, haggleUsed: false, stealUsed: false };
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
      spent: state.spentApproaches.includes(approachKey(scene.id, approach.id)),
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
  if (state.spentApproaches.includes(key)) throw new Error(`Approach ${approachId} already tried`);

  const perApproach = scene.retry === 'perApproach';
  // Spend the approach up front (a failed try can't be re-rolled). In `single`
  // mode the whole challenge ends here regardless, so tracking it is harmless.
  if (perApproach) state.spentApproaches.push(key);

  const events: AdventureEvent[] = [];
  const roller = approach.roller ?? 'best';
  const success = actorIdx !== undefined && roller === 'chosen'
    ? rollChosen(state, approach.skill, approach.dc, actorIdx, events)
    : rollFor(state, approach.skill, approach.dc, roller, events);

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
  if (approach.failure?.text) events.push({ type: 'text', paragraphs: approach.failure.text });
  applyEffects(state, approach.failure?.effects, events);
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
  return state.hub;
}

/** Walk back to the current hub location (the implicit "leave" affordance). */
export function returnToHub(state: AdventureState, module: Module): AdventureEvent[] {
  return enterScene(state, module, HUB_REF);
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
  // Record a `once` choice as spent up front — a failed social check is still
  // spent, so it can't be re-rolled by revisiting.
  if (choice.once) state.consumedChoices.push(choiceKey(scene.id, choice.id));

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
      node, blocked: blockedReason(state, node.requires), secret, explored,
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

// --- Driver callbacks (battle / shop / rest) --------------------------------

/** After the driver runs the battle for the current `battle` scene. */
export function resolveBattle(state: AdventureState, module: Module, won: boolean): AdventureEvent[] {
  const scene = currentScene(state, module);
  if (scene.kind !== 'battle') throw new Error(`resolveBattle on a ${scene.kind} scene`);
  // Count the attempt (win or lose) so any refight of this scene — a loss
  // retry, a re-triggered camp ambush — draws a different battleSeed.
  (state.battleAttempts ??= {})[scene.id] = (state.battleAttempts[scene.id] ?? 0) + 1;
  if (won) return applyOutcome(state, module, scene.onWin);
  // Loss: an authored per-battle branch wins; else the module's defeat scene
  // (the party is dragged back, revived at half HP); else just retry the fight.
  if (scene.onLoss) return applyOutcome(state, module, scene.onLoss);
  if (module.defeatScene) {
    reviveParty(state.campaign);
    return enterScene(state, module, module.defeatScene);
  }
  return enterScene(state, module, state.sceneId);
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

// --- Shop (buy/sell live in the UI; gambits roll here) ----------------------

export type HaggleSkill = keyof typeof HAGGLE;

/** The items a shop scene offers (its own stock, or the default), filtered to
 *  those with a real price. */
export function shopStock(scene: Scene): Id[] {
  if (scene.kind !== 'shop') return [];
  return (scene.stock ?? SHOP_STOCK).filter((id) => itemPrice(id) !== undefined);
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
  const result = attemptSteal(c, shopStock(scene));
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
  const scene = currentScene(state, module);
  if (scene.kind === 'explore') return scene.map.camp ?? null;
  const hub = state.hub ? module.scenes[state.hub] : undefined;
  return hub && hub.kind === 'explore' ? (hub.map.camp ?? null) : null;
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
  const { totalHealed } = variant === 'long' ? longRest(c) : shortRest(c);
  events.push({ type: 'heal', amount: totalHealed });
  return events;
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
