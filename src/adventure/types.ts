/**
 * Adventure mode: a module is plain data, interpreted by a pure runtime.
 *
 * The relationship to the combat engine is deliberate: a Module is to
 * `runtime.ts` what a battle's `(seed, actions[])` is to `step()`. Authoring a
 * scene is a data edit, never a runtime edit. Two discipline rules keep the
 * interpreter small:
 *   1. Anything fancy is a new *scene kind*, reviewed like an engine change —
 *      never a script hook. Effects stay at flag/gold/item/xp/hp/journal.
 *   2. Modules contain NO functions — plain, JSON-serializable data end to end,
 *      so replays, the validator, and a future external format stay trivial.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from '../data/classes.js';

/** A run of prose. One entry = one paragraph/beat the UI reveals in turn. */
export type Paragraph = string;

/** A reference to another scene by id (kept nominal for the validator's sake). */
export type SceneRef = Id;

// --- Requirements & effects -------------------------------------------------

/** A gate on a choice or explore node. All listed requirements must hold. */
export type Requirement =
  | { kind: 'flag'; flag: string; value?: boolean | number }   // flag set (or ≥ number)
  | { kind: 'notFlag'; flag: string }
  | { kind: 'item'; itemId: Id }                               // any party member holds it
  | { kind: 'gold'; atLeast: number }
  | { kind: 'classInParty'; classId: Id }
  | { kind: 'speciesInParty'; speciesId: Id }
  | { kind: 'visited'; scene: SceneRef };

/** A state mutation a choice/outcome applies. Deliberately tiny vocabulary. */
export type Effect =
  | { kind: 'setFlag'; flag: string; value?: boolean | number } // default true / +1 if number omitted
  | { kind: 'clearFlag'; flag: string }
  | { kind: 'gold'; amount: number }                            // signed
  | { kind: 'addItem'; itemId: Id; qty?: number }               // to the shared stash
  | { kind: 'removeItem'; itemId: Id; qty?: number }            // from the party (first holder)
  | { kind: 'xp'; amount: number }                              // party XP (levelForXp math)
  | { kind: 'heal'; amount: number | 'full' }                  // spread across the party
  | { kind: 'journal'; entry: JournalEntry };

export interface JournalEntry {
  id: Id;
  title: string;
  body: Paragraph;
  /** quest = the mission; lead = an open thread to follow (a named place/person
   *  to investigate); clue = a fact learned; npc = someone met. */
  kind: 'quest' | 'lead' | 'clue' | 'npc';
  /** For a `lead`: the flag whose firing closes it. When that flag is set the
   *  journal shows the lead as followed up, so open threads read as progress. */
  resolvedBy?: string;
}

/** Where a check/branch lands, plus what it does on the way. */
export interface Outcome {
  to: SceneRef;
  text?: Paragraph[];        // shown before the transition (the result narration)
  effects?: Effect[];
}

// --- Choices ----------------------------------------------------------------

export interface Choice {
  id: Id;
  label: string;
  to: SceneRef;
  effects?: Effect[];
  requires?: Requirement[];
  /** Inline skill-gated choice: "[Persuasion DC 12] Talk him down". On a tap,
   *  the runtime rolls; success routes to `to`, failure to `failTo`. */
  check?: { skill: SkillId; dc: number; roller?: Roller; failTo: SceneRef; failEffects?: Effect[] };
  /** Hide entirely when its requirements fail (default: show greyed with reason). */
  hideWhenBlocked?: boolean;
  /** Once taken (attempt, not just success), never offered again. The anti-grind
   *  / anti-farm guard that makes a revisitable scene safe: a social check can't
   *  be re-rolled, a one-time reward can't be re-claimed. */
  once?: boolean;
}

/** The special SceneRef `@hub` resolves at runtime to the explore scene the
 *  party most recently entered — a generic "return to where I was" that any
 *  location's sub-scenes can route to without hard-coding the hub's id. */
export const HUB_REF = '@hub';

export type Roller = 'chosen' | 'best' | 'group';

// --- Scenes -----------------------------------------------------------------

export interface SceneArt {
  /** Art id resolved by the frontend (generated backdrop or portrait). */
  imageId?: Id;
  /** Emoji/icon fallback when no art is available. */
  emoji?: string;
}

export interface NpcRef {
  id: Id;
  name: string;
  portraitId?: Id;
  emoji?: string;
}

export interface ExploreNode {
  id: Id;
  /** Percent coordinates (0–100) on the location art. */
  x: number;
  y: number;
  label: string;
  /** Shown in place of `label` until the party has entered this node — a marker
   *  you can see but don't yet *know* (e.g. "?" / "Something in the reeds").
   *  Distinct from `hidden`, which withholds the node entirely until perceived. */
  mystery?: string;
  icon: string;                 // SvgIconId / emoji, resolved by the UI
  scene: SceneRef;              // tapping enters this scene
  /** Conditional destinations checked before `scene`: the first entry whose
   *  requirements all hold wins. Lets a finished location route to a short
   *  "already done" beat instead of replaying its full scene. */
  sceneWhen?: Array<{ if: Requirement[]; to: SceneRef }>;
  requires?: Requirement[];     // locked door / gated route
  /** A secret: revealed only if the party's passive Perception ≥ dc on arrival. */
  hidden?: { dc: number };
  /** Danger on the way: on entering, a `chance` (0–1) rng roll may divert to a
   *  battle scene first (its onWin should route back here). Rolled once per
   *  node — a fight already braved doesn't re-trigger. */
  wandering?: { chance: number; battleScene: SceneRef };
}

/** Whether a location lets the party make camp — and at what risk.
 *  Its *presence* enables the Rest options on the party screen; absence leaves
 *  only gear management (you can always rummage your packs, but not everywhere
 *  is safe to sleep). `risky` means a long rest may be interrupted: a `chance`
 *  (0–1) rng roll can divert to `battleScene` (whose onWin should route home). */
export interface CampRule {
  risky?: { chance: number; battleScene: SceneRef };
}

export interface ExploreMap {
  art: SceneArt;
  title: string;
  /** MapTheme for the backdrop tint (stone/forest/graveyard/ember). */
  theme?: string;
  nodes: ExploreNode[];
  /** Present = the party may rest here (see CampRule). Absent = no rest. */
  camp?: CampRule;
  /**
   * Trail edges between nodes. Presence turns a free-roam map (a town: every
   * marker tappable) into a *traversal* map (a wilderness: you move along the
   * path). On a traversal map only the entry nodes and the neighbours of nodes
   * you've visited are shown — the frontier — and a frontier node hides its
   * title until you reach it. Undirected: [a, b] connects both ways.
   */
  paths?: Array<[Id, Id]>;
  /** Where the party starts a traversal map (visible with title from the off).
   *  Required when `paths` is set; ignored on a free-roam map. */
  entry?: Id[];
}

export type Scene =
  // `noBack` suppresses the implicit "leave to the hub" affordance for a forced
  // beat the player shouldn't be able to walk away from.
  | { id: Id; kind: 'story'; text: Paragraph[]; art?: SceneArt; next: Choice[]; noBack?: boolean }
  | { id: Id; kind: 'dialogue'; npc: NpcRef; lines: Paragraph[]; art?: SceneArt; next: Choice[]; noBack?: boolean }
  | {
      id: Id; kind: 'check'; skill: SkillId; dc: number; roller?: Roller;
      intro: Paragraph[]; art?: SceneArt; success: Outcome; failure: Outcome;
    }
  | {
      id: Id; kind: 'battle'; encounterId: Id; mapId: Id; intro?: Paragraph[]; art?: SceneArt;
      onWin: Outcome; onLoss?: Outcome;
      /** Ambush: `enemies` surprised (a won perception check) or `party` caught
       *  out (a failed one). The surprised side loses its first round. */
      surprise?: 'party' | 'enemies';
      /** Encounter rewards. Default (omitted) = full XP + treasure from the
       *  encounter. `false` = none (a scripted or trivial fight — gear is still
       *  read back). `{ bonusTier }` = full rewards plus a guaranteed extra drop
       *  of that rarity (a boss trophy). */
      loot?: false | { bonusTier?: 'common' | 'uncommon' | 'rare' };
    }
  | { id: Id; kind: 'explore'; map: ExploreMap }
  | { id: Id; kind: 'shop'; next: SceneRef; intro?: Paragraph[];
      /** Per-location stock (item ids). Absent = the default SHOP_STOCK. */
      stock?: Id[]; title?: string;
      /** The shopkeeper — rendered like a dialogue NPC so a shop reads as a
       *  conversation with someone, not a bare list. Defaults to a generic
       *  merchant archetype when absent. */
      npc?: NpcRef }
  | { id: Id; kind: 'rest'; variant: 'short' | 'long'; next: SceneRef; intro?: Paragraph[] }
  | { id: Id; kind: 'ending'; outcome: 'victory' | 'defeat'; text: Paragraph[]; art?: SceneArt };

export interface Module {
  id: Id;
  title: string;
  blurb: string;
  start: SceneRef;
  scenes: Record<Id, Scene>;
  /** Where a total party wipe lands (revived, half HP) instead of a hard game
   *  over — usually a safe hub like the town inn. A per-battle `onLoss`
   *  overrides it; absent both, a lost fight simply retries. */
  defeatScene?: SceneRef;
}
