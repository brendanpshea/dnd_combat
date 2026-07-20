# Implementation Plan: Adventure Mode (story, exploration, skills)

Turn the campaign from a ladder of battles into a playable **module**: block
text and NPC dialogue the party reacts to, explorable locations, real skill
checks, and combat as the centerpiece it already is. The end state is the
ability to author and ship a basic D&D module — an original, SRD-safe
adventure of roughly the shape of a classic starter module (village hub →
wilderness → dungeon → boss) — that plays start-to-finish on web and mobile.

The core bet, same as every other layer of this project: **a module is data
interpreted by a small pure runtime**, exactly as a battle is `(seed,
actions[])` interpreted by `step()`. Authoring a scene must never require an
engine edit; a module file should look like `monsters.ts`, not like React.

## 1. What already works with zero new code

The campaign layer already contains a working prototype of every mechanic
adventure mode needs — each currently scoped to the shop:

- **Skill checks with identity**: `partySkillCheck` / `bestAtSkill` /
  `skillBonus` (`src/campaign/campaign.ts:968–1040`) roll d20 + ability +
  proficiency off the **persisted campaign RNG** (`CampaignState.rng`), so
  story rolls are seeded and replayable like everything else. `SkillRoll`
  already carries who rolled (`by`), the natural, the DC, and Guidance —
  which is exactly what a dice-reveal UI wants to animate.
- **Skill proficiency plumbing**: class `skillProfs`, species grants
  (human extra proficiency), feature grants (`FEATURES[f].grantsSkill`),
  and trinket bonuses (Gloves of Thievery) all feed `skillBonus` already.
- **Consequences vocabulary**: the steal/haggle flows show the whole loop —
  a check, a branch, a reward (item), a cost (fine), and a persisted flag
  (`shopVisit`) so refresh can't retry. Adventure mode is this loop,
  generalized and made authorable.
- **A data-driven progression**: `STAGES` is `{ encounterId, mapId }[]`.
  The scene graph replaces the array index with a node id — the same
  "everything else is derived" philosophy.
- **A phase state machine**: `web/src/Campaign.tsx`'s `Phase` union
  (forge / shop / battle / loot / over / complete) is where scene phases
  slot in; `battleDone` already branches on story mode.
- **Presentation machinery**: portraits with `portraitId`, per-theme
  generated backdrops (`art.ts` + `MapTheme`), event-weighted pacing
  (`pacing.ts`), WebAudio SFX, condition badges, PWA/offline. All reusable
  for story scenes.
- **Choice points** (`ChoicePoint` + `grants` bags) — the mechanism for a
  forge-time background pick that grants skills (§4).
- **Testing culture**: deterministic replay + autoplay harnesses (arena,
  `--auto` campaign). Adventure mode gets the same: a module validator and
  a random-choice auto-player that fuzzes every module to completion.

## 2. Architecture: `src/adventure/`

A fourth layer beside `campaign/`, same one-directional rule
(`ui → adventure → campaign/engine → data`):

```
src/
  adventure/
    types.ts      # Module, Scene, Choice, Effect, Requirement, AdventureState
    runtime.ts    # pure interpreter: applyChoice(state, choiceId) -> { state, events }
    validate.ts   # module linter (run by a test over every shipped module)
  data/modules/
    classic.ts    # the existing 14-stage ladder wrapped in light narration
    <module>.ts   # the real module (§7)
```

### The runtime contract

Mirrors the engine's: pure, serializable, event-emitting.

```ts
interface AdventureState {
  campaign: CampaignState;      // gold, xp, party, rng — unchanged
  moduleId: Id;
  sceneId: Id;
  flags: Record<string, boolean | number>;   // the module's memory
  visited: Id[];                // scenes + explore-nodes seen (fog of war)
  journal: JournalEntry[];      // quests, clues, NPCs met
}

function legalChoices(state: AdventureState): Choice[];
function applyChoice(state: AdventureState, choiceId: Id): AdventureEvent[];
```

`AdventureEvent` (text shown, roll made, item gained, flag set, battle
started…) is the log/replay format, so the CLI renderer, the web renderer,
and tests all consume the same stream — the `GameEvent` pattern again.
Battles are *not* run inside the runtime: a `battle` scene emits
`{ type: 'startBattle', encounterId, mapId }`, the driver runs the existing
`Combat` loop, and reports `won | lost` back as a choice. The adventure
runtime stays synchronous, pure, and ignorant of the engine.

### Scene vocabulary (deliberately small)

```ts
type Scene =
  | { kind: 'story';    text: Paragraph[]; art?: SceneArt; next: Choice[] }
  | { kind: 'dialogue'; npc: NpcRef; lines: Paragraph[]; next: Choice[] }
  | { kind: 'check';    skill: SkillId; dc: number; roller: 'chosen' | 'best' | 'group';
                        intro: Paragraph[]; success: Outcome; failure: Outcome }
  | { kind: 'battle';   encounterId: Id; mapId: Id; intro?: Paragraph[];
                        onWin: Outcome; onLoss?: Outcome }   // default loss = story-mode retry
  | { kind: 'explore';  map: ExploreMap; }                   // §5
  | { kind: 'shop';     next: SceneRef }                     // existing shop, embedded
  | { kind: 'rest';     variant: 'short' | 'long'; next: SceneRef };

interface Choice {
  label: string;
  to: SceneRef;
  effects?: Effect[];                      // setFlag, gold±, addItem, xp, heal, journal
  requires?: Requirement[];                // flag, item, gold, classInParty, speciesInParty
  check?: { skill: SkillId; dc: number };  // inline skill-gated choice: "[Persuasion DC 12] Talk him down"
  hideWhenBlocked?: boolean;               // default: show greyed with the reason (teach the system)
}
```

Two vocabulary rules keep the interpreter honest:

1. **Anything fancy is a new scene, not a new effect opcode.** Effects stay
   at "set a flag, move gold/items/xp/hp, write the journal." A puzzle door
   is a `check` scene; a moral dilemma is a `dialogue` with flag-gated
   choices; a chase is a series of `check`s. If a module wants something the
   vocabulary can't express, the answer is one new *scene kind*, reviewed
   like an engine change — never a script hook.
2. **Modules never contain functions.** Plain data end to end (unlike
   `spells.ts`), so modules stay JSON-serializable — which keeps replays,
   the validator, and a future external module format all trivial.

### Validation (`validate.ts`, enforced by a test)

Every `SceneRef` resolves; every scene reachable from `start`; every
`encounterId`/`mapId`/`itemId`/`skill` exists; every flag read is somewhere
written; DCs within sane bounds; at least one path reaches an `ending`
scene with no unwinnable dead ends (a scene with zero satisfiable choices).
This is the module author's compiler.

## 3. Determinism, saves, and defeat

- **All story rolls thread `campaign.rng`** exactly as steal/haggle do
  today. A saved `(moduleId, seed, choices[])` replays a whole adventure —
  battles included, since battle seeds derive from campaign rng + scene id
  (fixing, in passing, the known story-mode-retry-replays-identical-dice
  wart by folding a per-scene attempt counter into the seed).
- **Save format**: `AdventureState` serializes beside the existing campaign
  save with a `version` field; a legacy save (no adventure state) loads as
  the classic ladder module at the equivalent stage — nobody's run is lost.
  This follows the existing migration pattern (missing `xp` back-fill).
- **Defeat**: `storyMode` already answers this — retry the battle scene.
  Normal mode keeps permadeath: the module ends at a `defeat` epilogue.
- **Non-combat XP**: `check` and `dialogue` outcomes may carry an `xp`
  effect (small, ~25–50 XP a beat) through the existing `levelForXp` math —
  talking past a fight shouldn't cost the party its level curve.

## 4. Skills: from 6 to 18, and from "party best" to "who steps up"

Today `SkillId` covers the six shop skills. Adventure mode needs the PHB
list — add the remaining twelve to `SKILL_ABILITY` (athletics/str;
acrobatics/dex; arcana, history, investigation, nature, religion/int;
animal-handling, insight, medicine, survival/wis; performance/cha).
`skillBonus` needs zero changes — it's already generic over the record.

- **Who rolls**: keep `bestAtSkill` for group-facing checks, add
  `characterSkillCheck(c, charIdx, skill, dc)` for `roller: 'chosen'`
  scenes — the party picks who steps forward (portrait row → tap). This is
  the spotlight mechanic that makes a 4-hero party feel like four people,
  and it's ~10 lines on top of what exists.
- **Group checks** (`roller: 'group'`): everyone rolls, half must pass —
  the 5e rule, and the right shape for "the party sneaks past."
- **Proficiency spread**: classes carry 1–2 skills today. Add a
  forge-time **background pick** via the existing `ChoicePoint` machinery —
  extend the `grants` bag with `skillProfs: SkillId[]` (one new fold line in
  the builder, beside feature ids and masteries). Six or so backgrounds
  (Acolyte, Criminal, Sage, Soldier, Folk Hero, Guide), each granting two
  skills — enough that a party of four covers most of the list and the
  chooser matters.
- **Guidance**: scope the existing auto-+1d4 to once per scene (it is the
  cleric's out-of-combat identity; unlimited was fine for one shop, but a
  module is fifty checks long).

## 5. Exploration: illustrated node maps, not a second grid engine

**Recommendation: a location is one generated illustration with authored
points of interest on top** — a node graph, not free-roam.

```ts
interface ExploreMap {
  art: SceneArt;                     // one generated backdrop (theme pipeline)
  nodes: Array<{
    id: Id; x: number; y: number;    // percent coords on the art
    label: string; icon: SvgIconId;  // door, npc, chest, danger, exit…
    scene: SceneRef;                 // tapping = entering that scene
    requires?: Requirement[];        // locked door: flag/item-gated
    hidden?: { skill: SkillId; dc: number };  // secrets: passive check on arrival
  }>;
  edges?: Array<[Id, Id, { encounterChance?: number }]>;  // wandering monsters, rng-threaded
}
```

Why nodes win over a grid crawl for this project:

- **Mobile-first**: five fat tap targets on a painting beat 64 small cells
  for exploration (combat keeps the grid, where the cells earn their cost).
- **The art path is already built**: one image per location through the
  exact `MapTheme` backdrop pipeline, plus an authored SVG icon set for
  markers — no new asset machinery, and asset count stays bounded (a module
  is ~4–6 locations, not 40 rooms).
- **No new engine**: no exploration-mode pathfinding, vision, or
  party-formation questions. Fog of war is `visited`; secret doors are a
  `hidden` node revealed by the party's best passive Perception (which
  `passivePerceptionWithAdvantage` already computes); danger is an
  `encounterChance` on an edge, rolled on the campaign rng.
- It still *feels* like exploring: unvisited nodes render as fog-dimmed
  question marks, the party token slides along edges, secrets pop with a
  perception toast, and a dungeon is 2–3 linked maps (floor per map).

*Considered and deferred*: reusing the combat `Board` for grid room-crawls.
It's seductive (movement/LoS exist) but drags in real questions — 4-token
party movement out of initiative, door/vision states, per-room authoring
load — for ambiance the node map delivers at a tenth the cost. Revisit only
if a shipped module feels like a slideshow.

## 6. Presentation: the fun budget

The runtime is a week of work; the *game feel* is where the effort should
go. Three set pieces carry it:

1. **The story panel** — letterboxed scene art up top, module text typed in
   with the `pacing.ts` beat approach (tap to complete, never gate on the
   animation), NPC portrait + name-plate for dialogue, choices as full-width
   cards with skill chips (`🎲 Persuasion DC 12`) and lock reasons on
   gated options. Portrait-orientation-first layout; it should feel like a
   visual novel beat between fights, not a settings form.
2. **The dice moment** — every visible check gets the same ritual: roller's
   portrait, a CSS-3D d20 tumble, the natural landing, then bonus chips
   counting on (+3 DEX, +2 prof, +1d4 Guidance), a DC bar, and a
   success/failure stamp with sound. One component
   (`web/src/DiceCheck.tsx`), fed entirely by the existing `SkillRoll`
   shape, reused verbatim in shop, scenes, and exploration. Nat 20s and
   nat 1s get confetti/thud. This single component is most of "modern,
   game-like, fun."
3. **The map screen** — pan/zoom SVG over the location art, pulsing node
   markers, party token sliding along edges, fog on the unvisited, a
   perception shimmer when a secret reveals.

Supporting cast: a **journal drawer** (quests + clues + NPCs met, written
by `journal` effects — doubles as the "what was I doing?" mobile
re-entry point), scene-transition wipes, per-theme ambient audio beds via
the existing WebAudio synth, and a light haptic (`navigator.vibrate`) on
dice landings where supported. Art direction stays the current pipeline:
generated paintings for scenes/locations/portraits (`art/prompts.md`
grows a scenes section), authored SVG for all iconography.

**CLI**: gets a minimal text renderer for scenes (numbered choices, plain
skill rolls) — not for players, but because a headless driver is what makes
the auto-player and replay tests honest, exactly like `--auto` battles.

## 7. The module (the deliverable that proves it)

An original ~2-hour adventure, structure borrowed from the classic starter
shape, content SRD-safe (WotC module text can't ship in this repo):

- **Act 1 — the village** (hub): arrival `story`, tavern `dialogue` (rumors
  behind Insight/Persuasion), a market `shop`, a small trouble that
  tutorializes checks, and the hook battle.
- **Act 2 — the trail** (explore, wilderness): tracking via Survival,
  a shortcut behind Athletics, an avoidable ambush (Perception decides who
  surprises whom → two different `battle` intros), a wounded NPC (Medicine,
  and a flag the finale remembers).
- **Act 3 — the hideout** (explore ×2, dungeon): sneak-or-fight fork
  (group Stealth past the watch post, or a straight fight), a secret-door
  cache (Investigation), a parley option with the lieutenant (Persuasion /
  Intimidation, gated on an Act-2 flag), boss battle on a themed map, and
  an epilogue `story` that reads 3–4 flags back so choices visibly mattered.

Budget: ~25 scenes, 3 explore maps, 6–8 battles (2 avoidable, 1 optional),
3 speaking NPCs, ~12 flags. **Pacing rule of thumb: a battle no more than
3–4 scenes away**, honoring "combat stays the focus." Existing monsters and
maps cover the fights — zero new stat blocks required, though 1–2 themed
maps would help the finale land.

Also shipped: `classic.ts`, the current 14-stage ladder expressed as a
trivial module (one intro line per stage). It's the migration target for
legacy saves *and* the proof the runtime subsumes what exists.

## 8. Milestones (each independently shippable)

| | Milestone | Contents | New surface |
| --- | --- | --- | --- |
| M0 | **Skill foundation** | 18 skills, `characterSkillCheck`, group checks, backgrounds via choice points, Guidance scoping, save version field | ~data + 2 small functions |
| M1 | **Scene runtime** | `adventure/` types + runtime + validator; story/dialogue/check/battle scenes; web story panel + `DiceCheck`; CLI renderer; `classic.ts` wrapping the ladder; auto-player test | the core build |
| M2 | **Exploration** | `explore` scenes, map screen, fog/secrets/wandering edges, journal drawer | second-biggest UI piece |
| M3 | **Juice pass** | scene art per theme, ambient audio, transitions, haptics, mobile audit (tap targets, portrait layout, safe areas), nat-20/1 celebrations | polish, parallelizable with M4 |
| M4 | **The module** | Act 1–3 authored + tuned; module-complete achievement; epilogue flag payoffs | data + playtesting |

Acceptance for "done": a new player on a phone plays the module start to
finish offline; at least two fights can be avoided or altered by
choices; a seeded run replays identically; every shipped module passes the
validator; the auto-player completes 100 seeded runs without a dead end.

## 9. Risks and open questions

- **Effect-vocabulary creep** is the failure mode of every scene system.
  Mitigation is rule 1 of §2 plus the validator; treat new opcodes like
  engine PRs.
- **Authoring drag**: 25 scenes of good prose is real work independent of
  code. Start writing the module at M1 (it will drive vocabulary gaps out
  early, the same way the gnome drove `creatureType`).
- **Where does the shop live now?** As scenes — which finally gives shops
  location flavor (village prices ≠ dungeon peddler) via a per-scene stock
  override. Small, but decide at M1 so `shopVisit` keys generalize.
- **TS data vs JSON modules**: start TS (type-checked authoring, repo
  precedent). Because modules are function-free plain data (§2 rule 2),
  a JSON loader for external authors later is a parser, not a redesign.
- **Deliberately out of scope**, extending SPEC §11: free-roam/grid
  exploration, timed events, faction/reputation systems, romance-style
  dialogue memory beyond flags, procedural quests, voice/LLM-generated
  text at runtime. Each is a fine future; none is needed to run a module.
