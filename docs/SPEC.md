# D&D 5.5e Grid Combat — Design & Specification

A grid-based tactical combat game using a simplified subset of the SRD 5.2.1
rules. The engine is headless, deterministic, and data-driven; the terminal CLI
and the greedy AI both drive it through the same action API.

**Status: phases 1–5c implemented** — full hot-seat and vs-AI play, four
classes at levels 1–3 with one subclass each, six SRD monsters in four
encounters, five battle maps with terrain. See §10 for the roadmap.

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
until the dodger's next turn.

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
humans have no mechanical species traits yet; per-rest resources reset at
combat start. Sleep is the real 5.5e two-stage version (Incapacitated →
Unconscious). Preserve Life auto-distributes to the most wounded allies
within 30 ft, capped at half max HP.

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

Encounters (`--encounter`): goblins (L1), wolves (L1), undead (L2), ogre (L3).
Monsters are always AI-run.

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

`ai/greedy.ts` scores every legal action by expected value and plays the best
until nothing beats ending the turn (threshold 0.5):

- Attacks/attack spells: hit or save-fail probability × average damage, kill
  bonus when EV can finish the target.
- Heals scale with urgency; Bless/Aid front-loaded to early rounds; Sleep and
  Burning Hands count actual template occupants with friendly-fire penalties
  (waived by Sculpt Spells); Hold Person weighted by target beefiness.
- Movement: melee classes close distance; casters kite to the 3–8 cell band;
  leaving melee without Disengage is penalized (so they Disengage/Misty Step
  first). Monsters charge if their kit is pure melee, else kite.
- Leveled spells carry a small slot-preservation cost.

Known limits (by design, for now): no lookahead, no terrain valuation (won't
deliberately hide behind walls), no focus-fire memory, never upcasts.

## 8. CLI

`npm start` — flags: `--seed n`, `--map id`, `--level 1|2|3`,
`--encounter id`, `--p1 ai`, `--p2 ai`. Menus are generated from
`legalActions()`; the move flood and many-celled spells (Misty Step) collapse
into "pick a cell" prompts. Every `GameEvent` renders as an English log line.

## 9. Testing

104+ vitest tests: deterministic replay of full battles, rules-level unit
tests (advantage cancellation, crit math, OA triggers, condition lifecycles,
resistances, multiattack banking), AI completion across seeds/maps/encounters,
and stat-block fidelity checks against the SRD's printed attack bonuses.

## 10. Roadmap

Done: ✅ foundation → ✅ weapons combat → ✅ classes/spells/CLI → ✅ greedy AI
→ ✅ terrain/maps → ✅ monsters/encounters → ✅ levels 2–3 + subclasses.

Next candidates, roughly in fun-per-effort order:
1. **More classes** (Barbarian, Ranger…) — mostly data now.
2. **Species with real traits** (darkvision needs no vision system if we skip
   light; breath weapons reuse cone templates).
3. **Levels 4–5** (ASIs, Extra Attack, 3rd-level spells — Fireball wants a
   bigger sphere template).
4. **Deployment phase** (players place their four units).
5. **Smarter AI** (one-ply lookahead via the pure `step`, terrain valuation,
   focus fire).
6. **Bigger/asymmetric maps, more encounters, loot/equipment variation.**

## 11. Deliberately out of scope

Cover, reactions beyond opportunity attacks, readied actions, death saves,
spell components, rituals, rests as a play loop, multiclassing, exhaustion,
mounts, elevation, lighting/vision, hiding/stealth.
