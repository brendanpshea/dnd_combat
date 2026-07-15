# D&D 5.5e Grid Combat — Design & Specification

A grid-based tactical combat game using a simplified subset of the SRD 5.2.1
rules. The engine is headless, deterministic, and data-driven; the terminal
CLI, the web app, and the greedy AI all drive it through the same action API.

**Status: phases 1–8 implemented** — full hot-seat and vs-AI play, four
classes at levels 1–3 with one subclass each, six SRD monsters in four
encounters, five battle maps with terrain, inventory/equipment, a persistent
campaign (shop, loot, skill gambits), and a deployed web frontend
(https://brendanpshea.github.io/dnd_combat/). See §10 for the roadmap.

## 1. Core decisions

| Question | Decision |
| --- | --- |
| Interface | Terminal CLI (ASCII board), engine fully headless underneath |
| Rules depth | Faithful core; simplified edges (no cover, no readied actions, no components) |
| Grid | Square, 5 ft cells, Chebyshev distance (diagonal costs 5 ft) |
| Data | Data-driven: classes, weapons, armor, spells, monsters, maps are typed data |
| Initiative | Rolled: d20 + Dex mod, individual turns, teams interleaved. Ties: higher Dex, then seeded coin flip |
| RNG | Seedable and injected; every roll goes through it; `(seed, actions[])` replays exactly |
| Visibility | Full — both players see all HP, AC, slots, conditions |
| Death | 0 HP = dead and removed. No death saves (Undead Fortitude is the one exception mechanic) |
| Win | Last team with a living combatant wins |
| Board | 8×8, fixed starting positions on opposite ranks (player deployment is future work) |
| Concentration | Implemented, including the Con save (DC max(10, ⌊damage/2⌋)) when the concentrator takes damage |

## 2. Architecture

Three layers, strictly one-directional: `ui → engine → data` (data files may
call engine *helpers* inside spell/feature hooks, but never drive the loop).

```
src/
  data/            # content: no game loop logic
    classes.ts features.ts spells.ts weapons.ts armor.ts monsters.ts maps.ts
  engine/
    rng.ts dice.ts grid.ts types.ts events.ts
    rules/         attack.ts saves.ts movement.ts
    actions.ts     # Action vocabulary, isLegalAction, legalActions, step()
    turn.ts        # initiative, turn/round loop, action economy
    combat.ts      # setup + thin stateful Combat facade
  builder/         # class + species + level + gear -> Combatant
  ai/              # greedy.ts: (GameState, actorId) -> Action
  ui/cli/          # renderer.ts (board + English events), main.ts (menu loop)
```

### The engine contract

```ts
// The pure core — this is the real API:
function legalActions(state: GameState, actorId: Id): Action[];
function isLegalAction(state: GameState, actorId: Id, action: Action): boolean;
function step(state: GameState, action: Action): { state: GameState; events: GameEvent[] };
```

`step` never mutates its input; `GameState` is a plain serializable object.
Validation is **semantic** (`isLegalAction`), so multi-target spells don't
require enumerating every target combination — `legalActions` enumerates
playable menu entries with sensible default targets, and drivers may submit
customized targets which `step` re-validates.

Two rules keep the AI honest: the UI and AI can only do what the action API
offers, and everything observable is a `GameEvent` (the combat log and replay
format). The AI is a pure function over the same surface.

### Actions

```ts
type Action =
  | { kind: 'move'; to: Position }                 // engine picks the path
  | { kind: 'attack'; weaponId; targetId; offhand? }
  | { kind: 'castSpell'; spellId; slotLevel; targets: Target[] }
  | { kind: 'useFeature'; featureId }
  | { kind: 'dash' } | { kind: 'disengage' } | { kind: 'dodge' }
  | { kind: 'shakeAwake'; targetId }
  | { kind: 'endTurn' };
```

Spell targeting declarations drive both validation and UI prompts:
`creature` (n targets in range), `sphere2x2` (anchor cell), `cone15`
(direction), `emptyCell` (teleport destination), `self` (adjacent burst).

## 3. Rules model

**Abilities.** Fixed array `16, 16, 13, 12, 10, 8` arranged per class priority.
Modifier `⌊(score−10)/2⌋`. Proficiency `2 + ⌊(level−1)/4⌋`.

**Attack rolls.** d20 + ability mod + proficiency vs AC. Nat 20 always hits and
crits; Champion crits on 19 too (but a 19 must still beat AC). Crits double
damage *dice*, not modifiers. Helpless targets (Unconscious/Paralyzed) grant
advantage and auto-crit on melee hits. Bless adds 1d4 to attacks and saves.

**Advantage/disadvantage** are collected as named *sources* (vex, sap, pack
tactics, assassinate, guiding bolt, dodging, prone, blinded, long range, enemy
adjacent to shooter, metal armor vs Shocking Grasp…) and any-vs-any cancels to
a flat roll — the real 5e rule.

**Damage pipeline.** Roll dice → ability mod (off-hand: none) → flat bonuses
(Dueling) → extra dice (Sneak Attack, advantage riders) → immunity(0) /
resistance(½) / vulnerability(×2) → HP → Undead Fortitude → wake-the-unconscious
→ concentration save → death → win check.

**Action economy.** Action, bonus action, movement, one reaction (opportunity
attacks only). Multiattack: `attacksPerAction` banked as `attacksLeft` when the
Attack action is taken (composes with Action Surge). Off-hand attack requires
two light weapons. Dash/Disengage/Dodge implemented; Dodge imposes disadvantage
until the dodger's next turn. **Hide** is a DC 15 Dexterity (Stealth) action
available only when no living enemy has line of sight to the actor. On success,
the hidden creature cannot be directly targeted and has advantage on its next
attack; attacking or casting a spell ends Hide. At the start of an enemy's
turn, line of sight plus advantaged passive Perception ($15 +$ Wisdom modifier)
strictly greater than the stored Hide check reveals the creature to all enemies.
Area effects may still affect hidden creatures. Rogue Cunning Action and Goblin
Nimble Escape each provide a bonus-action Hide option.

**Movement.** Dijkstra over per-cell cost; pass through allies, not hostiles;
can't end on occupied cells. Leaving reach provokes an opportunity attack
(resolved mid-path; death interrupts movement). Pathing prefers equal-cost
routes around hazards. **Forced movement** (Thunderwave): push N cells along a
direction, stopping at walls/occupied/edge, no opportunity attacks, hazards
still trigger. Prone: automatic stand-up at turn start for half speed.

**Conditions.** Prone, Incapacitated, Unconscious (adv against, melee
auto-crit, ends on damage/shake-awake, 1-minute cap), Paralyzed (Hold Person:
no move/act, adv against, melee auto-crit, concentration-sustained, repeat
save at end of turns), Blinded, Poisoned, Frightened, plus transient markers:
vexed, sapped, guided (one attack), dodging, blessed, noReactions. Conditions
carry `sourceId`, optional `concentration` flag, `expiresAtRound`, and
`repeatSave` (Sleep escalates Incapacitated → Unconscious on a failed repeat).

**Saves.** d20 + mod + proficiency (class save list) + Bless d4.
Spell DC = 8 + proficiency + casting mod.

**Equipment & inventory.** Combatants have hands (`equipped.mainHand`,
`offHand` = weapon or shield, `armor`) and a carried `inventory` of item
stacks. **AC is derived** from equipment (`acOf`); monsters keep a flat
stat-block override. One **free interaction per turn**: attacking with a
stowed weapon auto-draws it into the main hand (stowing the old one).
Two-weapon fighting checks the actual hands; Dueling requires an empty or
shield off-hand. Consumables (`useItem` action): Potions of Healing (bonus
action, self or adjacent ally), Alchemist's Fire (thrown attack), and spell
scrolls (cast the spell without a slot — every spell is store-shelf-ready).
All item data carries `cost`/`rarity` for future stores and treasure drops;
thrown weapons are not consumed (abstract recovery). Default kits: everyone
carries a healing potion; the wizard/cleric get a scroll, the fighter
alchemist's fire and two javelins.

## 4. Classes (levels 1–3, one subclass each)

All classes: standard array by priority, standard gear, weapon masteries per
the 5.5e list. Level 1 details (AC/HP/features) are authoritative in
`src/data/classes.ts`; summary:

| | Fighter (Champion) | Cleric (Life) | Wizard (Evoker) | Rogue (Assassin) |
| --- | --- | --- | --- | --- |
| L1 | Second Wind ×2, Action Surge, Dueling +2, Sap mastery. AC 17, HP 13 | Sacred Flame, Cure Wounds, Bless, Disciple of Life. AC 18, HP 11 | Fire Bolt, Shocking Grasp, Magic Missile, Sleep, Burning Hands. AC 13, HP 7 | Sneak Attack 1d6, two shortswords + bow, Vex mastery. AC 15, HP 11 |
| L2 | — | +Guiding Bolt, 3 slots | +Thunderwave, 3 slots | Cunning Action (bonus Dash/Disengage) |
| L3 | Improved Critical (19–20) | Hold Person, Aid, Preserve Life (CD), slots 4/2 | Scorching Ray, Misty Step, Sculpt Spells, slots 4/2 | Assassinate, Sneak Attack 2d6 |

Notable simplifications: Action Surge granted at level 1 (5.5e says 2);
per-rest resources reset at combat start. Sleep is the real 5.5e two-stage version (Incapacitated →
Unconscious). Preserve Life auto-distributes to the most wounded allies
within 30 ft, capped at half max HP.

### Species (Human, Dwarf, Wood Elf, Orc)

Species are data composed over a class during character construction. Vision,
exploration, charms, and feats remain out of scope; the implemented traits all
matter in combat. Humans gain one Heroic Inspiration use (free action: next
attack has advantage) and a deterministic extra campaign skill proficiency per
class. Dwarves gain poison resistance and $+1$ maximum HP per
level. Wood Elves move 35 feet and are immune to Sleep. Orcs gain Adrenaline
Rush (bonus Dash, proficiency-bonus temporary HP, proficiency-bonus uses) and
Relentless Endurance (drop to 1 HP once per encounter). Temporary HP absorbs
damage before HP and does not stack.

## 5. Monsters & encounters

SRD 5.2.1 stat blocks, simplified; attack bonuses *derive* from abilities +
proficiency and match the printed numbers.

| Monster | Signature mechanics |
| --- | --- |
| Goblin Warrior (AC 15, 10) | Nimble Escape (bonus disengage), +1d4 damage on advantage |
| Goblin Boss (AC 17, 21) | Multiattack ×2 |
| Skeleton (AC 14, 13) | Vulnerable bludgeoning, immune poison |
| Wolf (AC 12, 11, spd 40) | Pack Tactics, bite knocks prone |
| Zombie (AC 8, 15) | Undead Fortitude (Con save vs dropping to 0; radiant/crit bypass) |
| Ogre (AC 11, 68, CR 2) | Big greatclub numbers; the level-3 boss fight |
| Bandit / Bandit Captain | Plain humanoids; captain has Multiattack ×3 |
| Dire Wolf (AC 14, 22, spd 50) | Pack Tactics + prone bite (bigger wolf) |
| Ghoul (AC 12, 22) | Claws paralyze on failed Con save (save-ends); immune poison |
| Giant Spider (AC 14, 26) | Bite deals bonus poison damage + poisons on failed save |
| Acolyte (AC 10, 9) | Caster — reuses the cleric spells (Sacred Flame, Cure Wounds, Bless) |
| Kobold (AC 12, 5) | Pack Tactics swarm, dagger + sling |
| Scout (AC 13, 16) | Multiattack ×2, longbow — ranged skirmisher |
| Orc (AC 13, 15) | Greataxe + Adrenaline Rush (reuses the Orc *species* feature) |
| Brown Bear (AC 11, 34) | Multiattack ×2 (bite + claws) beast bruiser |
| Cult Fanatic (AC 13, 33) | Caster boss with Hold Person + Bless; dagger ×2 |
| Animated Armor (AC 18, 33) | Construct, immune poison/psychic, slam ×2 |

Two weapon riders added for these: `onHitSave` (a save-ends condition on hit —
ghoul paralysis, spider poison; repeats via the same end-of-turn machinery as
Sleep) and `extraDamage` (secondary damage of another type). Both are generic
data hooks, no per-monster engine code. The `poisoned` and `paralyzed`
conditions — previously defined but uninflicted — are now live.

Encounters (`--encounter`): goblins (L1), wolves (L1), undead (L2), ogre (L3),
bandits (L2, camp), spiders (L2, nest), crypt (L3, acolyte + ghouls + skeletons),
kobolds (L1, warren), raiders (L2, orcs + scouts), wilds (L2, bear + wolves),
cult (L3, fanatic + acolyte + ghouls + animated armor). Monsters are always
AI-run.

## 6. Grid, terrain, maps

- Distance: Chebyshev × 5 ft. Melee reach 1 cell. Ranged: beyond normal range
  = disadvantage; beyond long = illegal; adjacent enemy = disadvantage.
- LoS: supercover line trace, blocked by walls.
- Terrain: `open`, `difficult` (double cost), `wall` (blocks move + LoS),
  `hazard` (1d4 fire per cell entered — also on forced movement).
- Maps are ASCII data (`src/data/maps.ts`): `.` `#` `~` `^`, top rank first.
  Five ship: open, ruins, marsh, firepit, corridor. Spawn ranks stay walkable.

**AoE templates.** Sphere 5-ft = a chosen 2×2 block. Cone 15-ft = fixed 6-cell
wedge in one of 8 directions (orthogonal 1/2/3; mirrored diagonal). Templates
are data.

## 7. AI

Two policies behind one signature, selectable as difficulty in both UIs
(`--ai easy|normal|hard` in the CLI, a dropdown in the web setup).

**`ai/greedy.ts`** (the original): hand-written expected-value formulas per
spell/feature. Strong on current content — it is hand-tuned to exactly this
content — but every new spell needs a new formula; it does not generalize.

**`ai/simulated.ts` + `ai/evaluate.ts`**: scores actions by actually running
them through the pure `step()` on sampled RNG streams and evaluating outcomes
with a *generic* state evaluator. Contains **no content ids** (a test greps
the source against every spell/feature/item id) — new content is valued
through its simulated consequences, automatically.

- `evaluate(state, team)`: unit worth (HP, level, kit damage proxy) scaled by
  HP fraction; condition weights by mechanical effect; option value for slots,
  feature uses, and consumables (priced from item cost); hazard penalty;
  engagement band (melee kits want adjacency, ranged a middle distance) and
  an incoming-threat term. Positional terms are POV-asymmetric — distance is
  mutual, so symmetric weights would cancel out of `mine − theirs` and leave
  movement gradient-free.
- Search: small beam over this turn's action sequence; per-action expected
  deltas (averaged over samples) accumulate into path scores, which stops
  beam-max from chasing lucky-sample fantasy lines. Presets: easy
  (1 sample/beam 2/depth 1), normal (3/3/2), hard (5/5/3). Two "obvious"
  improvements — common random numbers across candidates, and a re-sampling
  refinement pass — were both tried and *measurably weakened* arena play;
  they are documented in code comments so nobody re-adds them on instinct.
- Sample seeds derive from the state's RNG but are *not* the game's actual
  stream — the AI estimates expectations, never peeks at the real next roll.
  Decisions are deterministic; replays stay exact.

**Difficulty mapping follows measured strength, not architecture:**
Easy = sim-easy (~13% vs greedy), Normal = sim-normal (~35%), Hard = greedy.
When arena runs show the sim AI overtaking greedy (richer content, better
evaluator, tuned weights), Hard swaps to the sim hard preset — the criterion
is empirical, not aesthetic.

**Arena** (`npm run arena [games] [preset]`, `src/ai/arena.ts`): pits
policies over seeded mirror matches with side-swapping — the empirical tool
for any AI change; a CI-friendly regression floor lives in the test suite.

Known limits: single-turn horizon (no enemy-reply search), no wall/LoS
valuation, never upcasts, evaluator weights hand-set (auto-tuning them
against arena win rate is an open, well-tooled follow-up).

## 7b. Campaign layer

`src/campaign/` is the meta-game the combat engine knows nothing about: a
`CampaignState` (gold, stage index, per-character inventory + equipment)
persists across battles as JSON. The ladder is data (`STAGES`): encounter,
party level, map, and a weighted **loot table** per stage (gold range +
N item draws; the ogre's table can drop +1 weapons and half plate). Loot
rolls use the battle's final RNG state, so seeded campaigns are reproducible
end-to-end. Between battles the shop buys/sells (half price back) from
`SHOP_STOCK` — consumables, weapons (incl. +1 longsword/shortsword with
attack/damage bonus support in the engine), and armor gated by per-class
**armor proficiencies** (fighter/cleric all, rogue light, wizard none).
The equip screen moves gear between hands/armor/inventory (two-handers
clear the off-hand; shields need a free main hand), and items can be
passed between characters. **Shop skills** (once each per visit, rolled by
the party's best at each skill via per-class `skillProfs`): stealing needs
Stealth AND Sleight of Hand vs DC 13 — success grabs a random stock item,
getting caught costs a 50g fine and ends all shenanigans for the visit;
haggling offers Persuasion (DC 15, −20%, safe), Intimidation (DC 15, −25%
or +25% on failure), or Deception (DC 13, ±15%). Skill checks roll off a
persisted campaign RNG state, so seeded runs stay reproducible. Before a battle the campaign builds
Combatants via the builder's gear overrides; after a victory it reads
surviving inventory back (spent consumables stay spent, weapon swaps
persist), adds loot, and advances. Fallen characters recover on victory —
only a full wipe ends the campaign. Entry point: `npm run campaign`
(`--auto` = AI-played, `--new` = fresh start).

## 8. CLI

`npm start` — flags: `--seed n`, `--map id`, `--level 1|2|3`,
`--encounter id`, `--p1 ai`, `--p2 ai`. Menus are generated from
`legalActions()`; the move flood and many-celled spells (Misty Step) collapse
into "pick a cell" prompts. Every `GameEvent` renders as an English log line.

## 8b. Web UI

`web/` is a React + Vite app importing the engine directly (no engine
changes were needed — the browser is just another driver of
`legalActions`/`step`). No external art: CSS board, emoji tokens, an
authored SVG icon, WebAudio-synthesized sound effects.

- **Interaction:** legal actions are painted onto the board — tinted cells
  for moves (tokens slide via a transform-positioned token layer), red/green
  rings for attackable/healable targets. Target taps always open a confirm
  chooser. Area spells enter pick-a-cell mode; multi-target spells (Magic
  Missile, Bless) accumulate taps. The grouping layer
  (`web/src/actionGroups.ts`) is unit-tested against the live engine.
- **Feedback:** damage floats colored by damage type, hit shake, skull death
  fade, condition tags; synthesized SFX per damage type with a persisted
  mute; AI turns paced by action kind with a 1×/2× speed toggle.
- **Campaign:** full parity with the CLI (shop, equip, give, haggle, steal,
  loot) as forms; saves in localStorage. Once-per-visit shop flags persist in
  the save so a page refresh can't retry a theft.
- **PWA:** manifest + service worker (network-first navigation, cache-first
  hashed assets) — installable on phones, works offline.
- **Deployment:** GitHub Actions builds on every push to `main` (gated on
  the test suite) and deploys `dist-web/` to GitHub Pages.

## 9. Testing

140 vitest tests: deterministic replay of full battles, rules-level unit
tests (advantage cancellation, crit math, OA triggers, condition lifecycles,
resistances, multiattack banking), AI completion across seeds/maps/encounters,
stat-block fidelity checks against the SRD's printed attack bonuses, campaign
state/loot/skill-check coverage, and web action-grouping tests. CI runs the
suite before every deploy.

## 10. Roadmap

Done: ✅ foundation → ✅ weapons combat → ✅ classes/spells/CLI → ✅ greedy AI
→ ✅ terrain/maps → ✅ monsters/encounters → ✅ levels 2–3 + subclasses
→ ✅ inventory/equipment → ✅ campaign + shop + random loot + shop skills
→ ✅ web UI (battle, campaign, effects/sound, PWA, Pages deploy).

Next candidates, roughly in fun-per-effort order:
1. **More classes** (Barbarian, Ranger…) — mostly data now.
2. **Levels 4–5** (ASIs, Extra Attack, 3rd-level spells — Fireball wants a
   bigger sphere template).
3. **Longer/branching campaign** (more stages, choice of route, revival
   costs; the stage ladder is already data).
4. **Deployment phase** (players place their four units).
5. **Smarter AI** (one-ply lookahead via the pure `step`, terrain valuation,
   focus fire).
6. **Bigger/asymmetric maps, more encounters.**

## 11. Deliberately out of scope

Cover, reactions beyond opportunity attacks, readied actions, death saves,
spell components, rituals, rests as a play loop, multiclassing, exhaustion,
mounts, elevation, lighting/vision, hiding/stealth.
