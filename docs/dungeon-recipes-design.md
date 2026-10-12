# Dungeon recipes: set pieces, factions, and authored stories over generated places

Status: **design, not built.** Follows `delve-spec.ts` (#358).

## 1. What this is for

`generateSpecDelve` makes a dungeon that is *provably winnable*: the validator
proves reach, keys, torch and layout. What it does not make is a place that is
*about* something. Every room's fight is drawn independently, a key is always a
flag dropped by whoever stood in the key room, and the only hand-made content is
the `require` list (one room, one fight, one find).

This design adds two layers and one bridge:

- **Set pieces**: hand-made fragments (a cluster of rooms, with their own
  links, scenes, NPCs and logic) that the generator places under a contract.
  This is the Dungeon Crawl Stone Soup vault, the Spelunky chunk and the Brogue
  machine. It is where hand-made quality comes from.
- **Inhabitants**: a floor is held by one or two factions with a leader, a lair
  and an attitude. Fights, names, parley and some set pieces are drawn from
  who lives there, not from the level alone.
- **The bridge**: a *recipe* that a written module can embed as a scene, with
  flags flowing in (the story so far) and out (what happened down there). The
  same recipe format serves the dev delve card, so generated and authored
  content are one system with different amounts pinned.

Out of scope here (later designs): alarm/reinforcement pressure, new lock
kinds beyond what set pieces bring, reward choice and run modifiers, and tying
room features to the battle board (today `@room` reads only theme and size; see
`ROOM_MAP_REF` in types.ts).

## 2. Principles

1. **The output is still an ordinary `Module`.** Nothing downstream learns
   about recipes. Runtime, saves, UI and validator see scenes, dungeons and
   battles, as they do now. This is the property that made `delve-spec`
   cheap, and it is non-negotiable.
2. **The validator stays the acceptance test.** A set piece states what it
   needs; the generator places it; the validator proves the result. Contract
   violations that no candidate could satisfy are refused up front
   (`checkSpec` style), and the rest reroll.
3. **Deterministic in (seed, recipe).** A saved run rebuilds from its id. A
   recipe embedded in a written module rebuilds from the module plus a seed
   held in the save.
4. **A continuum, not a mode switch.** Fully authored (every room pinned) and
   fully generated (no pieces) are the two ends of one format. An author pins
   as much as they care about.
5. **Prove what we claim.** Every layer gets tests that bite (planted bugs),
   and any difficulty claim is a measurement, not a calibration in disguise.

## 3. The recipe

A recipe is `DelveSpec` grown up. `DelveSpec` keeps working: it converts to a
recipe with no pieces and no inhabitants, and existing `delve2-` ids rebuild
unchanged (pinned by golden hashes, as the classic ids are).

```ts
interface DelveRecipe {
  id: string;                      // stable, for ids and saves: 'kobold-warren'
  title?: string | string[];       // fixed, or a pool to draw from
  theme: SpecTheme;
  level: number | 'party';         // 'party': the level the party arrives at
  rest?: RestPolicy;

  floors: FloorRecipe[];           // 1..3; one entry per floor

  /** Where the place came from (see §6). Drawn if omitted. */
  history?: HistoryRef | 'random';

  /** Flags the recipe reads from the story (§7). Declared so the
   *  validator can prove every branch is built for both values. */
  reads?: string[];
  /** Flags it hands back, under the embedding module's names (§7). */
  writes?: string[];
}

interface FloorRecipe {
  shape?: DelveShape;
  rooms?: number;                  // or size
  size?: 'small' | 'medium' | 'large';
  fights?: 'authored' | 'generated' | 'inhabitants';
  inhabitants?: InhabitantRef[];   // §5; 'inhabitants' fights draw from these
  pieces?: PiecePlacement[];       // §4
  goal?: PiecePlacement;           // the floor's goal, as a piece (a boss lair)
}

interface PiecePlacement {
  piece: Id | Piece;               // a library piece by id, or inline
  chance?: number;                 // optional pieces: 0..1, default 1
  where?: RoomPlace;               // as today: goal|main|side|beforeLock|afterLock
  when?: Requirement[];            // only built if these hold at generation (§7)
  bind?: Record<string, string>;   // fill the piece's parameters (§4.3)
}
```

`require: RequiredRoom[]` becomes sugar for single-room pieces, so the dev
card's JSON field keeps working.

## 4. Set pieces

### 4.1 Shape of a piece

A piece is a small dungeon fragment with **ports**: the places it can be
joined to the rest of the floor.

```ts
interface Piece {
  id: Id;
  themes?: SpecTheme[];            // where it fits; omitted = any
  levels?: [number, number];       // party levels it is written for
  tags?: string[];                 // 'lair', 'shrine', 'prisoner', 'vault' …

  rooms: PieceRoom[];              // DungeonRoom minus id clashes: ids are local
  links: DungeonLink[];            // internal, by local id
  ports: Port[];                   // where it joins the floor
  scenes: Record<Id, Scene>;       // local ids; prefixed on placement

  /** What it needs from the floor and what it hands to it. */
  needs?: PieceNeed[];
  gives?: PieceGive[];

  params?: Record<string, ParamSpec>;  // §4.3
}

interface Port {
  room: Id;                        // local room the corridor arrives at
  door?: DungeonDoor;              // the piece's own door: locked, secret, one-way
  role?: 'entry' | 'exit' | 'any'; // a piece with an entry and an exit is a passage
}

type PieceNeed =
  | { kind: 'before'; flag: string }     // must be reachable before this lock
  | { kind: 'after'; flag: string }      // only reachable past it
  | { kind: 'depth'; atLeast: number }   // this many rooms from the entrance
  | { kind: 'faction'; tag: string }     // a floor faction with this tag exists
  | { kind: 'room'; size?: RoomSize; rest?: RoomRest };

type PieceGive =
  | { kind: 'key'; flag: string }        // this piece can BE the key for a lock
  | { kind: 'rest' }                     // counts as a safe room for the policy
  | { kind: 'shortcut' };                // offers a one-way link back
```

### 4.2 Placement

Placement is a step between wiring (`wire`) and contents.

1. Pieces are sorted most-constrained first: goal, then pieces with `after`,
   `before` or `depth` needs, then the rest.
2. Each piece claims slots: one generated room per piece room, chosen from
   rooms whose region satisfies its needs and whose grid degree leaves room for
   its ports (the hub lesson: four sides per room). Internal links replace or
   extend the generated ones; the port joins the claimed cluster to the
   graph.
3. A piece that `gives: key` may be chosen as the key for the floor's lock;
   then the generic key room is not built. This is how a lock becomes "the
   warden carries it" or "the drained cistern" without a new lock mechanism.
4. Failure to place is a `Reroll`. Needs that no candidate could meet (a
   `depth` deeper than the floor, two goal pieces) are refused by the
   preflight, as `checkSpec` does now.

Local ids are prefixed on placement (`f2-p0-cell`), so two copies of a piece,
or the same piece on two floors, never collide. Scenes inside a piece refer to
local ids; placement rewrites `SceneRef`s, `fight`, `search`, `event` and
`battle` references. This rewrite is the riskiest code in the design and gets
the strongest tests (§9).

### 4.3 Parameters

A piece can leave holes for the recipe or the floor to fill:

```ts
type ParamSpec =
  | { kind: 'encounter'; role: 'room' | 'boss' | 'guard'; brief?: EncounterBrief }
  | { kind: 'npc' }                // an NpcRef from the module, or a generated one
  | { kind: 'item'; tier?: 'common' | 'uncommon' | 'rare' }
  | { kind: 'text'; pool: string[] };
```

A piece's scenes use `{{param}}` in encounter ids, NPC refs, item ids and
prose. Unfilled `encounter` params draw from the floor's inhabitants (§5) or
the budget, which is what lets one "guarded shrine" piece work in a kobold
warren and a crypt.

### 4.4 The starter library

A first library, each one chosen because it exercises a contract feature:

| Piece | Exercises |
|---|---|
| Prisoner's cell (rescue an NPC) | `npc` param, `writes` flag, event scene |
| Guarded shrine (rest, if you clear it) | `gives: rest`, a fight gating a safe room |
| Flooded passage + valve room | two-room piece, internal lock, `gives: shortcut` |
| Warden's quarters | `gives: key`, a named boss holding it |
| Faction lair (the leader) | `needs: faction`, goal-capable |
| Collapsed bridge (one-way) | port with a one-way door |
| Trapped treasury | secret port, `item` param |
| Rival party | parley-first battle, `npc` param |

## 5. Inhabitants

```ts
interface Faction {
  id: Id;
  name: string | string[];         // 'The Red Hand', or a pool
  tags: string[];                  // 'kobold', 'undead', 'cult', 'beast'
  members: Id[];                   // the monster ids it fields, cheapest first
  leader?: Id[];                   // boss-capable members
  parley?: { skill?: SkillId; dc: number; label?: string } | false;
  roomNames?: string[];            // 'Kennels', 'Trap Workshop'
  attitude?: 'hostile' | 'wary' | 'open';
}
```

A floor names one or two factions, or draws them from the theme. With
`fights: 'inhabitants'`, room fights are generated to the budget, *restricted
to the faction's members*. `generateEncounter` today chooses its own one or
two creature types and takes no pool, so this needs a new option
(`members?: Id[]`) that replaces the roster it draws from — a small change,
but one that must leave every existing call's output identical. The goal fight draws a `leader`. With two
factions, territory is split along the main path (the first faction holds the
stretch before the lock), and the border gets a "they fight each other" piece
when one exists.

What this buys immediately:

- Coherence: the warren is kobolds, their pets and their shaman, not a draw
  from the level table.
- Parley that means something: a faction's `parley` applies to all its fights,
  and a flag (`f1:red-hand-truce`) set by talking to the leader turns the rest
  of its rooms' fights into passage. The runtime already supports this: a
  room's `fight` battle can carry `parley`, and requirements can gate fights.
- Carl-style floor bosses: the leader is a named boss with a `bonusTier` drop.

Faction definitions live in `src/data/factions.ts`, written by hand. They are
data, like encounters, and get a test that every member exists and every
faction can field a fight at each level it claims.

## 6. History

A history is a short chain of eras, each with a pool of words, room names and
props:

```
builders  →  what went wrong  →  who holds it now
dwarves      flooded              lizardfolk (a faction)
monks        plague               undead
```

The draw sets the title ("The Drowned Abbey of the Grey Brothers"), seeds room
names from the builders' pool, lets set pieces tagged with an era appear, and
supplies first-visit lines ("Chisel marks, dwarven, under the silt"). The
history's last era *is* the inhabitants, so §5 and §6 are one draw.

This is mostly tables and a little grammar. It is cheap, and it is what stops
generated prose from feeling random.

## 7. The bridge to authored modules

### 7.1 A recipe as a scene

```ts
| { id: Id; kind: 'delve'; recipe: Id | DelveRecipe;
    onWin: Outcome;               // where the story continues
    onLeave?: Outcome;            // walked out without finishing
    imports?: Record<string, string>;  // story flag → recipe flag
    exports?: Record<string, string>;  // recipe flag → story flag
  }
```

`kind: 'delve'` is expanded **at module load**, not at runtime: a pre-pass
replaces it with the generated scenes (prefixed by the delve scene's id), so
the runtime never sees a new scene kind. The seed comes from the save
(`state.delveSeeds[sceneId]`, drawn when the scene is first reached), so two
players of the same written module get different dungeons, and one player's
save always gets the same one.

That leaves a chicken-and-egg problem: load-time expansion needs the seed,
and the seed lives in the save. The answer is to expand lazily on first entry
and cache the result in memory, rebuilding from (module, sceneId, seed) on
load. **This is the single biggest open technical question** (§10.1).

### 7.2 Flags in

`when` on a placement, and `Requirement`s inside piece scenes, read the
imported flags. Two kinds of read:

- **Generation-time** (`PiecePlacement.when`): decides whether a piece is
  built at all. If the party freed the scout, the prisoner's cell is not
  placed. These are evaluated once, when the delve is generated, and the
  values are folded into the seed so a rebuild is identical.
- **Play-time** (requirements in scenes): ordinary flags, read as they are
  today. The kobolds parley if `story:met-the-chieftain`.

The validator must prove the delve works for **every combination of the
generation-time flags it declares in `reads`**. That is 2^n candidates, so
`reads` is capped (4 at first) and the proof runs per combination.

### 7.3 Flags out

`exports` renames recipe flags into the story's namespace as the party leaves
(by `onWin`, `onLeave`, or a defeat). Inside the recipe, flags are namespaced
by the delve scene, as `carries` already does for chapters, so a recipe can
be dropped into any module without clashing.

### 7.4 Pinning authored content

An author can pin at three grains:

1. **A piece**: "the prisoner's cell, with Mara in it, after the lock on floor
   2". This is `PiecePlacement` with `bind: { npc: 'mara' }`.
2. **A room position**: a piece room with `at: [col, row]`, which `layoutDungeon`
   already honours.
3. **A whole floor**: a `FloorRecipe` whose `pieces` cover every room, so the
   generator only lays it out and proves it. That end of the continuum is a
   hand-written dungeon, with the recipe machinery doing nothing but
   validation.

### 7.5 NPCs

Pieces with an `npc` param bind to the module's `npcs`/`cast` when embedded, so
the cast check ("no name before its introduction") keeps working: the piece's
scene is an introduction. On the dev card, with no module, an `npc` param
draws a generated NPC (name pool + a role), which needs a small `NpcDef`
generator.

## 8. Tooling

A recipe nobody can preview is a recipe nobody can write. A dev page,
`?dev=recipes`, takes a recipe (from the library or pasted JSON) and shows,
for 30 seeds:

- the laid-out map per floor, rooms coloured by piece and faction
- validator output, reroll count, and preflight errors
- the fights per room (encounter, adjusted XP, share of even)
- for `reads`, a toggle per flag combination

It reuses `layoutDungeon` and the existing dungeon map component. It is
dev-only, like the delve card.

## 9. Tests, by layer

Each with a planted-bug check before merge.

- **Compatibility**: classic and `delve2-` golden hashes unchanged; a
  `DelveSpec` converted to a recipe builds the same module.
- **Placement**: every library piece placed on 100 seeds × every shape passes
  validation; needs hold (an `after` piece is unreachable without the key; a
  `before` piece is reachable without it); rerolls stay rare.
- **Id rewriting**: two copies of one piece on one floor, and one piece on
  every floor, produce no dangling or shared scene refs (the validator's
  unresolved-reference check, plus a direct test that every prefixed id
  resolves).
- **Key pieces**: a `gives: key` piece replaces the key room, and removing it
  makes the goal unreachable.
- **Inhabitants**: every room fight on an inhabitants floor uses only faction
  members; the goal draws a leader; a truce flag lets the party walk through.
- **Bridge**: an authored test module embedding a recipe plays to victory
  headless for every `reads` combination; exports arrive under the story's
  names; a save mid-delve reloads to the identical dungeon.
- **Difficulty**: whole-delve win rates measured with the runner plus the
  combat simulator, before inhabitant budgets are called balanced.

## 10. Open questions

1. **Expansion timing** (§7.1). Lazy expansion with a seed from the save is
   the plan, but it touches module loading, the validator (which today proves
   a static module) and the reachability search. A first spike should settle
   it before anything else is built on it.
2. **Piece authoring format.** TypeScript objects (typed, refactorable, the
   current convention for modules) or JSON (pasteable into the card and the
   preview page)? Proposal: TypeScript for the library, JSON accepted at the
   edges, one schema check for both.
3. **How far `inhabitants` fights replace `authored`.** Faction pools are
   generated fights restricted to a list; they inherit the budget calibration
   but not its measurement. Default stays `authored` until §9's difficulty
   measurement is done.
4. **Validator cost.** 2^reads combinations × floors × rerolls. At 4 reads and
   3 floors this is fine on today's numbers (~10 ms a candidate); measure
   before raising the cap.

## 11. Build order

Each step ships on its own and is useful alone.

1. **Pieces, without the bridge.** `Piece`, placement, id rewriting, a starter
   library of four (cell, shrine, warden's key, valve passage), recipe format
   with `DelveSpec` as sugar. Dev card and preview page take recipes.
2. **Factions and history.** `factions.ts`, `fights: 'inhabitants'`, the
   history draw and its prose; faction-tagged pieces (lair, rival party).
3. **The spike, then the bridge.** Settle §10.1, then `kind: 'delve'` scenes,
   imports/exports, `reads` proofs, NPC binding, and one written module that
   uses it end to end.
4. **Measure.** Whole-delve win rates per shape, depth and inhabitants, and
   adjust the budget shares from measurement rather than from the authored
   pools.

## 12. Step 1 as built

What shipped, and where it departed from the design above:

- **Pieces are TypeScript functions** (`src/adventure/delve-pieces.ts`), built
  through a context that names every room, scene and flag for them. This
  removes §4.2's id-rewriting pass, which was the riskiest code in the design.
  A spec still names pieces by id, so it stays JSON and saved runs rebuild.
- **One port per piece, and pieces add rooms** rather than claiming generated
  ones. Multi-port pieces (passages) and slot-claiming wait for a piece that
  needs them.
- **No goal pieces yet.** A goal is still a `RequiredRoom` with
  `where: 'goal'`. Lair pieces arrive with factions (step 2).
- **`DelveSpec.pieces`**, not a separate `DelveRecipe` type. The recipe grows
  out of the spec when floors need different settings.
- **`afterLock` without a room past the lock.** On a classic floor the lock is
  often the goal's own door. The piece then hangs off a room before the lock,
  behind a second door that takes the same key. The preview page caught this:
  3.4 rerolls a delve before the fix, 0.3 after.
- **`ELITE_SHARE` (0.45 of even) is a midpoint, not a measurement.** It is the
  warden's budget.
- **A validator gap found on the way.** A room reachable only through the
  last floor's goal can never be entered, because winning that fight ends the
  delve, and the validator does not flag it. Placement never anchors a piece
  on the goal (tested), but the check belongs in the validator.

## 13. Step 2 as built

- **Ten factions** (`src/data/factions.ts`), each with members, leaders, room
  names, signs and, for those that talk, a parley. Every theme has at least two
  holders at every level from 1 to 5 (tested).
- **`fights: 'inhabitants'`.** Every fight on the floor is drawn from its holders:
  rooms, the key, ambushes, broken nights and set pieces. The goal is a leader
  with an escort, built to the boss budget. Two holders split a floor at the
  lock.
- **`generateEncounter({ members })`.** A faction is drawn as ONE pool, not by
  creature type. By type, gnolls at 1st level are a lone gnoll and a lone hyena,
  neither type qualifies, and the faction silently fielded strangers in every
  fight. Calls without `members` run the old code path unchanged.
- **Leader fallback.** Below the level any leader can be fielded at, the
  faction's biggest member that fits leads instead, so the goal is still
  *them*.
- **Parley pays XP, unlike §5's sketch.** The house rule (validator,
  `avoidedFightXP`) is that every way past a fight pays the fight's XP. A
  talked-down fight pays it, plus any key, but no gold or loot. A talk-down in a
  dungeon room now also clears the room; before this it sprang again on the
  next visit (runtime fix, tested). The goal's leader never parleys.
- **No truce flag yet.** Each fight is talked down on its own. Making one talk
  open a faction's whole territory needs fights that a flag can stand down,
  which the runtime does not have.
- **History** (`delve-history.ts`): builders, then calamity, then holders. It
  supplies the title, the start scene's story, the menu blurb, and traces in a
  third of the quiet rooms. Drawn with `inhabitants` or `history: true`; a
  plain spec rolls exactly as before (hash-pinned).
- **Goal pieces.** `lair` (guard post, then leader's hall) replaces the
  generated goal. Corridors that led to the old goal now lead to the lair's
  door, locks included, and the old goal is never built. **`rivals`** is
  another company that splits the take or fights for it.

## 14. Step 3 as built: the spike's answer, and the bridge

**The spike (§10.1).** A seed in the module id was rejected: the menu,
completion, sequels and save slots all match modules by id and would each
have had to learn to strip it. Instead:

- `Module.delves` names generated dungeons by the scene id the story links to.
- A run's **roll** (`AdventureState.delveRoll`: a seed, plus the story flags
  the delves read) is made once and kept in the save.
- `liveModule(module, state)` expands the module from its roll into ordinary
  scenes, cached per module and roll. The runtime, saves and UI never see
  anything new. A save made inside the dungeon reloads to the same dungeon,
  because `parseAdventure` checks it against the live module.
- `validateLive` is the proof. The written module alone cannot pass
  `validateModule` (its story links to scenes only a roll builds), so this
  validates the expansions for several seeds, under every combination of the
  flags the delves read. Reads are capped at 4.

**The splice** (`expandDelve`):

- The delve's door becomes the story's scene. Everything else lives under
  `<scene>/`: scene ids, scene references and flags.
- A delve's `reads` keep their story names, so its scenes may require them.
- `exports` rename generated flags to story flags.
- The delve's victory and giving-up are not scenes of their own: every route to
  them leads straight to the story's `onWin` / `onLeave`, carrying the story's
  effects. A wipe inside lands outside the delve.

**Two bugs the validator caught on the first expansion:**

- `structuredClone` keeps object sharing, and the generator shares effect
  objects between a fight and its parley. The rewrite renamed one key flag
  twice (`cellar/cellar/delve-key-2`), so floor 2 could never be opened. Now
  cloned through JSON (tested).
- A "you gave up" page between the delve and the story's ending was a dead end.
  It is removed by the rerouting above.

**What the snapshot means.** Flags are read when the roll is made: at the start
of the run, so they are what earlier chapters carried in. "If you freed the
captives in chapter one, the cellar has a shrine" works (tested). A flag set
earlier in the *same* chapter cannot change what is generated; it can only be
read in play. Rolling lazily, at the delve's door, would lift that, but it
needs the runtime to know a roll is due.

**Not yet:**

- A delve module in the shipped registry. The registry-wide tests (reach,
  ledger, XP traces, module map) read raw scenes, and would each need to read
  `liveModule` instances. The demo, *Beneath Hollowmere*
  (`src/data/modules/delve-story.ts`), lives on the dev delve card instead.
- `level: 'party'`: a delve's level is fixed by its author.
- Export names are the generator's (`f2-p1-freed`). They are predictable from
  the spec, but an author has to know the scheme.

## 15. Step 4: whole delves, measured

**The harness.** `scripts/delve-sim.ts` plays whole delves. Every fight is the
real engine with the greedy AI on both sides, on the board the game draws for
that room. HP, slots and items carry from fight to fight. The player is
careful, not clever:

- explores every reachable room before the goal, and searches everything;
- rests when below 70% HP or 50% of its spell slots, walking back to a quiet
  room first and to a safe room for a night;
- tops up before the boss;
- walks back in after a wipe, up to three wipes;
- never parleys or sneaks.

It runs at about 0.3 s a delve. `test/delve-calibration.test.ts` is the
nightly tripwire.

**What it found, in order:**

1. **Parties lose to attrition, not to strength.** Fresh parties win 100% of
   room-sized fights and 90–100% of boss-sized ones at every level. Inside a
   delve, level-3 to level-5 parties lost room fights 15–25% of the time.
2. **A safe room on the goal's doorstep can never be slept in.** Resting is
   refused beside a fight still to be had, and the goal's fight is had last. 74
   of 200 classic delves, and about 8% of spec delves, had one. The party
   could not sleep before the boss or after a wipe. It is moved one room back
   without another roll, so only those delves changed (verified one by one).
   Level-3 clears went from 40% to 63% on this alone.
3. **One boss share does not fit every level.** At a flat 0.65 the first-try
   boss win was 97% at level 1 and 62–63% at levels 3–4. Swept per level, then
   confirmed on fresh seeds: `boss: [0.8, 0.65, 0.55, 0.55, 0.6]`. That gives
   75–93% first-try boss wins in every level and mode, and 78–98% of delves
   cleared.
4. **Elite is right at 0.45**, now measured. It wins 83–95%, between rooms
   (~97%) and bosses. At 0.35 it is no harder than a room.
5. **Factions ran out of fight at high level.** Kobolds at level 5 could not
   spend a tenth of a room budget (boss fights at 0.23 of even, 100% won).
   Factions gained a stronger leader tier; a faction must fill 60% of a room
   fight to hold a level; leaders are chosen for their share of the fight.
   Two crashes and leaks came with it, both fixed and tested: an escort
   asked to spend almost nothing crashed the generator, or fell back to
   strangers (a kobold beside a giant ape).

**Authored fights are the open problem.** Delves drawing from the written
encounters clear only ~60% of the time at every level. Their bosses are
erratic: fresh-party wins range from 0% to 100% with no relation to XP.
`kennel-hyenas` at 0.62 of even wins 0%; `corpse-lights` at 1.52 wins 100%.
They were written for particular story moments, not as interchangeable
bosses. The classic delve (the card's default) still uses them; switching its
default to generated fights is the obvious fix, but it changes what "New
delve" gives, so it is not done here.

**Limits of the measurement:**

- One player model, greedy AI for the party, and one-floor delves for the
  tuning (multi-floor delves inherit the per-level table).
- Above level 5 is unmeasured.
- 40 delves a cell is about ±7 points.
