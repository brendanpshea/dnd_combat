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
import type { MapTheme } from '../data/maps.js';

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
  | { kind: 'visited'; scene: SceneRef }
  | { kind: 'companion'; companion: Id }                       // travelling with the party
  | { kind: 'noCompanion'; companion: Id };

/** A state mutation a choice/outcome applies. Deliberately tiny vocabulary. */
export type Effect =
  | { kind: 'setFlag'; flag: string; value?: boolean | number } // default true / +1 if number omitted
  | { kind: 'clearFlag'; flag: string }
  | { kind: 'gold'; amount: number }                            // signed
  | { kind: 'addItem'; itemId: Id; qty?: number }               // to the shared stash
  | { kind: 'removeItem'; itemId: Id; qty?: number }            // from the party (first holder)
  | { kind: 'xp'; amount: number }                              // party XP (levelForXp math)
  | { kind: 'xpToLevel'; level: number }                       // top XP up to the start of `level` (no-op if already past)
  | { kind: 'heal'; amount: number | 'full' }                  // spread across the party
  | { kind: 'journal'; entry: JournalEntry }
  | { kind: 'joinParty'; companion: Id }                        // an NPC comes along (Module.companions)
  | { kind: 'leaveParty'; companion: Id };

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

/** One way to tackle a challenge scene: a named line of attack the party can
 *  choose, rolled against its own skill/DC. Several approaches on one obstacle
 *  is how a non-combat node offers a *choice* ("pick your tool") instead of a
 *  single forced check. */
export interface Approach {
  id: Id;
  label: string;
  /** A one-line subtitle: what this line of attack actually is ("Force the
   *  hinges", "Sweet-talk the guard") — the texture that makes the pick a
   *  decision, not just a skill name. */
  hint?: string;
  skill: SkillId;
  dc: number;
  roller?: Roller;
  requires?: Requirement[];
  /** Hide entirely when blocked (default: show greyed with reason). */
  hideWhenBlocked?: boolean;
  /** Where a success lands. Defaults to the challenge's shared `success`. */
  success?: Outcome;
  /** A failure's beat. In `single` mode this routes away (defaults to the
   *  challenge's shared `failure`). In `perApproach` mode its `to` is ignored —
   *  only its text/effects show, as the flavour before the party tries another
   *  way. */
  failure?: Outcome;
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
  /**
   * Purely visual roads on a *free-roam* map (a town): drawn like trail edges
   * so the stops read as one connected place — the overworld look — but with
   * no gating whatsoever; every marker stays tappable. A traversal map's
   * `paths` already draw, so it never needs these. Undirected.
   */
  roads?: Array<[Id, Id]>;
  /** Where the party starts: required on a traversal map (with `paths`), and
   *  on any map it's where the party pawn stands on first arrival. */
  entry?: Id[];
}

// --- Dungeons ---------------------------------------------------------------

/**
 * A dungeon is a graph: rooms, and the links between them. Nothing here says
 * where anything goes on screen — `layoutDungeon` works that out — so a
 * dungeon can be written by hand, generated from a seed, or checked by a test
 * without anyone drawing it. See src/adventure/dungeon.ts.
 */
export interface Dungeon {
  title: string;
  /** The look of the place, and of the boards its `@room` fights are fought on. */
  theme: MapTheme;
  art?: SceneArt;
  /** Where the party stands on walking in (and on coming back from outside). */
  entry: Id;
  /**
   * How far the light goes: every step spends a link's `length` of it, and a
   * search spends 1. When it runs out the party is sent to `out`. Walking back
   * in from outside lights a fresh one. Absent = the place is lit.
   */
  torch?: { length: number; out: SceneRef };
  /** Present = the party may rest here (see CampRule). */
  camp?: CampRule;
  rooms: DungeonRoom[];
  links: DungeonLink[];
}

export type RoomSize = 'small' | 'medium' | 'large';

export interface DungeonRoom {
  id: Id;
  name: string;
  /** How big it is drawn, and how deep its `@room` battle board is. */
  size?: RoomSize;
  /** The room's one piece of prose, shown the first time the party walks in. */
  firstVisit?: Paragraph[];
  /** A battle scene sprung on walking in, every time, until it is won. */
  fight?: SceneRef;
  /** A scene that plays on walking in (a conversation, a find): once, or on
   *  every entry until `until` holds. After the fight, if there is one. */
  event?: { scene: SceneRef; until?: Requirement[] };
  /** What Search turns up here: a scene entered once, after any secret doors. */
  search?: SceneRef;
  /** A way out of the dungeon from this room. */
  exit?: { to: SceneRef; label?: string };
  /** What the dungeon is for. The checks prove it can be reached from the
   *  entry with what the dungeon itself hands out. */
  goal?: true;
  /** Pin the room to a layout cell; unpinned rooms are placed around it. */
  at?: [col: number, row: number];
}

export interface DungeonLink {
  a: Id;
  b: Id;
  /** Torch spent walking it (default 1). */
  length?: number;
  door?: DungeonDoor;
}

export interface DungeonDoor {
  /** Shut until these hold. Once walked through, it stays open. */
  locked?: Requirement[];
  /** Why it is shut, shown when the party tries it ("Barred from inside"). */
  note?: string;
  /** A locked door can be forced instead: one try, and its key still works. */
  force?: { skill: SkillId; dc: number };
  /** Unseen until found: by passive Perception on arrival, or by Search. */
  secret?: { dc: number };
  /** Only from `a` to `b` (a drop, a door that locks behind you). */
  oneWay?: true;
  /** Something waits in the dark along it: rolled once, the first time through. */
  ambush?: { chance: number; battle: SceneRef };
}

/** A battle scene's `mapId` that means "a board drawn for the room the party
 *  is standing in", generated from the dungeon's theme and the room's size. */
export const ROOM_MAP_REF = '@room';

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
      /**
       * Talking them down, offered on the fight's intro beside Fight, Sneak up
       * and Fall back. Opt-in because a fight avoided needs its own story: the
       * onWin text assumes a battle happened. One try per fight; a failure
       * (unless it routes elsewhere) leaves the fight still to be had.
       */
      parley?: {
        skill?: SkillId; dc: number; roller?: Roller;
        /** The button: "Offer them the toll". Defaults to "Parley". */
        label?: string;
        success: Outcome;
        failure?: Outcome;
      };
      /** No falling back or retreating from this one (a fight the story
       *  cannot let you walk away from). Sneaking up is still allowed. */
      noFlee?: boolean;
    }
  | {
      id: Id; kind: 'challenge'; intro: Paragraph[]; art?: SceneArt;
      /** The lines of attack on offer — the player picks how to try. */
      approaches: Approach[];
      /** `single` (default): the first approach attempted resolves the whole
       *  challenge, win or lose — one obstacle, one shot. `perApproach`: each
       *  approach may be tried once; a failed one is spent but another may be
       *  tried, and the challenge only fails once every approach is exhausted. */
      retry?: 'single' | 'perApproach';
      /** Shared landing spots for an approach that doesn't name its own. */
      success: Outcome; failure: Outcome;
      /** Suppress the implicit "leave to the hub" — a forced obstacle. */
      noBack?: boolean;
    }
  | { id: Id; kind: 'explore'; map: ExploreMap }
  | { id: Id; kind: 'dungeon'; dungeon: Dungeon }
  | { id: Id; kind: 'shop'; next: SceneRef; intro?: Paragraph[];
      /** Per-location stock (item ids). Absent = the default SHOP_STOCK. */
      stock?: Id[]; title?: string;
      /** The shopkeeper — rendered like a dialogue NPC so a shop reads as a
       *  conversation with someone, not a bare list. Defaults to a generic
       *  merchant archetype when absent. */
      npc?: NpcRef }
  | { id: Id; kind: 'rest'; variant: 'short' | 'long'; next: SceneRef; intro?: Paragraph[] }
  | {
      id: Id; kind: 'ending'; outcome: 'victory' | 'defeat'; text: Paragraph[]; art?: SceneArt;
      /**
       * Ending slides: a line each about what became of the people and places
       * the player touched, shown after `text` when its requirements hold
       * ("Mira sets an extra cup at the end of the bar…" if the scout died).
       * The ending reads the run back, so choices visibly mattered.
       */
      slides?: Array<{ if: Requirement[]; text: Paragraph }>;
    };

/**
 * An NPC who can travel with the party — the Gold Box guide, prisoner or
 * sellsword. A stat block rather than a character sheet: they fight beside
 * the party, run by the AI, and are not the player's to level or equip.
 * `joinParty` / `leaveParty` effects bring them in and send them off.
 */
export interface CompanionDef {
  id: Id;
  name: string;
  /** The stat block they fight with (a MONSTERS id: 'scout', 'guard', 'priest'…). */
  monsterId: Id;
  portraitId?: Id;
  emoji?: string;
  /** One line for the party screen: who they are and why they are here. */
  blurb: string;
}

export interface Module {
  id: Id;
  title: string;
  blurb: string;
  /** Location-art id for the module's landing/hero card (a `loc-*` from
   *  adventure-art.ts). Absent = the menu falls back to a themed glyph card. */
  cover?: Id;
  start: SceneRef;
  scenes: Record<Id, Scene>;
  /** The module's home base — a safe explore hub with a shop/inn (Thornwick's
   *  square, the war-camp). Once the party has discovered it, they may fast-
   *  travel back to it (and out to any other location they've been) from any
   *  location's map, so a supply run isn't a long walk back through the wild.
   *  Must name an `explore` scene; absent = no fast travel. */
  town?: Id;
  /** Where a total party wipe lands (revived, half HP) instead of a hard game
   *  over — usually a safe hub like the town inn. A per-battle `onLoss`
   *  overrides it; absent both, a lost fight simply retries. */
  defeatScene?: SceneRef;
  /** The next module in a campaign arc. A victory ending offers "continue the
   *  company": the same CampaignState — party, XP, gold, gear — walks into the
   *  sequel's opening scene (startAdventure with the carried campaign). Must
   *  name a registered module; a test enforces the link resolves. */
  sequel?: Id;
  /** The level band this module is written for, shown on its menu card and the
   *  continue button ("The Sunken Barrows · levels 3–4"). Purely informative —
   *  nothing gates on it. */
  levelBand?: { from: number; to: number };
  /**
   * Choices this chapter hands on to the rest of the campaign: flags that,
   * when the company carries into the sequel, arrive there named after this
   * module — `carries: ['saved-scout']` on the Hollow Road is read in a later
   * chapter as `{ kind: 'flag', flag: 'hollow-road:saved-scout' }`. They pass
   * down the whole chain, and exist only if this company played this chapter:
   * a cold start has none, so a scene that reads one needs a version without.
   */
  carries?: string[];
  /** The NPCs who may join the party in this module, by id. */
  companions?: Record<Id, CompanionDef>;
  /**
   * The chapter's clock. A chapter starts on day 1, and every long rest (at a
   * camp, or a long `rest` scene) ends a day. Each dawn here plays on the
   * morning its `day` begins: its text is shown, and its effects apply. That
   * is how time presses: a dawn sets a flag ('captives-moved'), and scenes
   * read the flag like any other, so a party that camps too often finds a
   * door shut or a fight harder. A camp interrupted by a fight is not a night
   * slept, so it does not end the day. Days ascending, each 2 or later.
   */
  dawns?: Dawn[];
}

/** A morning that matters on a chapter's clock (Module.dawns). */
export interface Dawn {
  day: number;
  text: Paragraph[];
  effects?: Effect[];
}
