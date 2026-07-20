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
  kind: 'quest' | 'clue' | 'npc';
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
}

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
  icon: string;                 // SvgIconId / emoji, resolved by the UI
  scene: SceneRef;              // tapping enters this scene
  requires?: Requirement[];     // locked door / gated route
  /** A secret: revealed only if the party's passive Perception ≥ dc on arrival. */
  hidden?: { dc: number };
}

export interface ExploreMap {
  art: SceneArt;
  title: string;
  nodes: ExploreNode[];
  /** Optional wandering-monster edges, rolled on the campaign rng when travelled. */
  edges?: Array<{ from: Id; to: Id; encounterChance?: number; encounterId?: Id; mapId?: Id }>;
}

export type Scene =
  | { id: Id; kind: 'story'; text: Paragraph[]; art?: SceneArt; next: Choice[] }
  | { id: Id; kind: 'dialogue'; npc: NpcRef; lines: Paragraph[]; art?: SceneArt; next: Choice[] }
  | {
      id: Id; kind: 'check'; skill: SkillId; dc: number; roller?: Roller;
      intro: Paragraph[]; art?: SceneArt; success: Outcome; failure: Outcome;
    }
  | {
      id: Id; kind: 'battle'; encounterId: Id; mapId: Id; intro?: Paragraph[]; art?: SceneArt;
      onWin: Outcome; onLoss?: Outcome;
    }
  | { id: Id; kind: 'explore'; map: ExploreMap }
  | { id: Id; kind: 'shop'; next: SceneRef; intro?: Paragraph[] }
  | { id: Id; kind: 'rest'; variant: 'short' | 'long'; next: SceneRef; intro?: Paragraph[] }
  | { id: Id; kind: 'ending'; outcome: 'victory' | 'defeat'; text: Paragraph[]; art?: SceneArt };

export interface Module {
  id: Id;
  title: string;
  blurb: string;
  start: SceneRef;
  scenes: Record<Id, Scene>;
}
