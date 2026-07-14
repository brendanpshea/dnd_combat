# D&D 5.5e Grid Combat — Specification (v1)

A grid-based tactical combat simulator using a simplified subset of the SRD 5.2.1
rules. v1 is hot-seat human vs. human in a terminal. The engine is written so
that AI players, monsters, species, levels, equipment, and terrain can be added
without restructuring it.

## 1. Decisions locked for v1

| Question | Decision |
| --- | --- |
| Interface | Terminal CLI (ASCII board), engine fully headless underneath |
| Rules depth | Faithful core; simplified edges (no cover, no readied actions, no components) |
| Grid | Square, 5 ft cells, Chebyshev distance (diagonal costs 5 ft) |
| Data | Data-driven: classes, weapons, armor, spells, species are typed data, not code |
| Initiative | Rolled: d20 + Dex mod, individual turns, teams interleaved. Ties: higher Dex, then seeded coin flip (keeps replays deterministic) |
| RNG | Seedable and injected; every roll goes through it |
| Visibility | Full — both players see all HP, AC, slots, conditions |
| Death | 0 HP = dead and removed. No death saves, no dying/stabilizing in v1 |
| Win | Last team with a living character wins |
| Board | 8×8, fixed starting positions on opposite ranks (player-chosen deployment is a later feature) |
| Concentration | Implemented, including the Con save when the concentrator takes damage |

## 2. Architecture

Three layers, strictly one-directional: `ui → engine → data`. The engine never
imports the UI; the data never imports the engine.

```
src/
  data/            # pure content. no logic.
    classes/       fighter.ts wizard.ts cleric.ts rogue.ts
    species/       human.ts
    weapons.ts     armor.ts
    spells/        cure-wounds.ts magic-missile.ts ...
    index.ts       # registries: SPELLS, WEAPONS, CLASSES, ... keyed by id
  engine/
    rng.ts         # seeded RNG + dice
    dice.ts
    grid.ts        # positions, distance, line of sight, occupancy, terrain
    types.ts       # Combatant, GameState, Action, GameEvent, ...
    state.ts       # immutable-ish state + reducers
    rules/         attack.ts saves.ts damage.ts conditions.ts movement.ts
    actions.ts     # legal-action enumeration + execution
    turn.ts        # initiative, turn/round loop, action economy
    combat.ts      # top-level Combat facade
  ui/
    cli/           renderer.ts prompts.ts main.ts
  ai/              # (phase 4) consumes the same Action API as the CLI
  builder/         # character construction from class+species+level+gear
test/
```

### The engine contract

The engine exposes exactly this to any driver — CLI, AI, or a future web UI:

```ts
// The pure core — this is the real API:
function legalActions(state: GameState, actorId: Id): Action[];
function step(state: GameState, action: Action): { state: GameState; events: GameEvent[] };

// Thin stateful convenience wrapper over the pure core, used by the CLI:
interface Combat {
  state: GameState;                          // full, readable
  legalActions(actorId: Id): Action[];
  apply(action: Action): GameEvent[];        // delegates to step(), stores new state
  isOver(): boolean;
  winner(): TeamId | null;
}
```

`step` never mutates its input — it returns a new state. That makes lookahead
AI trivial (try an action on a copy for free), and makes replay/undo a matter of
keeping old states around. `GameState` should be a plain serializable object
(structural sharing via spread is fine; no classes) so copying is cheap.

Two rules make the AI phase cheap: **the UI can only do what `legalActions`
offers**, and **everything observable is a `GameEvent`**. An AI is then just a
function `(GameState, Action[]) => Action`, and the CLI is a function that
renders events and picks from the same list. No AI-only backdoors into the state.

### Actions are data

```ts
type Action =
  | { kind: 'move';        to: Position }        // engine computes a legal path
  | { kind: 'attack';      weaponId: Id; targetId: Id }
  | { kind: 'castSpell';   spellId: Id; slotLevel: number; targets: Target[] }
  | { kind: 'useFeature';  featureId: Id; targets?: Target[] }   // Second Wind, Action Surge
  | { kind: 'dash' | 'disengage' | 'dodge' }
  | { kind: 'shakeAwake';  targetId: Id }        // action: wake an adjacent Unconscious ally
  | { kind: 'endTurn' };
```

`legalActions` enumerates one `move` per reachable **destination**, not per path
— paths would explode combinatorially. The engine picks a shortest legal path
(fewest opportunity attacks as tiebreaker) and reports it in the `Moved` event.

Serializable, replayable, loggable. A recorded `(seed, Action[])` pair fully
reproduces a battle — which is what makes tests and later AI self-play work.

### Events

Every state change emits an event: `AttackRolled`, `DamageDealt`, `Healed`,
`SavingThrow`, `ConditionApplied`, `ConditionRemoved`, `ConcentrationBroken`,
`Moved`, `OpportunityAttack`, `Died`, `TurnStarted`, `RoundStarted`, `CombatEnded`.
The CLI's entire job is to turn these into English. This is also the combat log,
and later the replay format.

## 3. Core rules model

**Ability scores.** Array `16, 16, 13, 12, 10, 8`, arranged per class (below).
Modifier = `floor((score - 10) / 2)`.

**Proficiency bonus** = `2 + floor((level - 1) / 4)` — so +2 at level 1. Levels
are supported by the formula from day one even though v1 ships level 1.

**AC** = armor base + Dex mod (capped by armor type) + shield + bonuses.
Light: full Dex. Medium: Dex capped at +2. Heavy: no Dex.

**Attack roll** = d20 + ability mod + proficiency (if proficient) vs. target AC.
Nat 20 always hits and doubles the damage *dice* (not the modifiers). Nat 1
always misses.

**Advantage/disadvantage.** Roll 2d20 take high/low. They cancel to a flat roll
regardless of count — 5e's actual rule. This is modeled as a set of *sources* on
the roll so Vex, Sap, and Dodge compose correctly.

**Saving throws** = d20 + ability mod + proficiency (if the class saves in that
ability). Spell save DC = `8 + proficiency + spellcasting mod` (13 at level 1
for a 16 in the casting stat).

**Damage** rolls dice, applies the ability mod once, applies fighting-style and
other flat bonuses, then resistances/vulnerabilities (structure exists for
monsters even though no v1 character has any).

**Action economy per turn.** One action, one bonus action, movement up to speed
(30 ft = 6 cells for all v1 characters), one reaction (refreshed at the start of
your turn). Free object interaction is not modeled.

**Opportunity attacks.** Leaving a hostile creature's reach without Disengaging
provokes one melee attack, consuming that creature's reaction. This is the one
reaction v1 implements.

**Conditions implemented in v1:** Prone, Incapacitated, Blinded, Poisoned,
Frightened, Unconscious (used by Sleep: attacks against have advantage,
adjacent hits auto-crit, ends on damage or shake-awake), plus the transient
markers for Vex and Sap. Each is data: what it does to attack rolls
against you, your attack rolls, your movement, and your actions.

**Concentration.** A caster holds at most one concentration effect. Taking damage
forces a Con save at `DC max(10, floor(damage / 2))`; failure ends the effect.
Casting a second concentration spell ends the first. Death ends it.

## 4. The four classes (level 1)

Stat arrays are the fixed `16,16,13,12,10,8`, arranged for the class. All are
Human (v1 species: +1 to all abilities is *not* 5.5e — 5.5e humans get an Origin
Feat, Skillful, and Resourceful; v1 grants the feat-equivalent as a no-op stub
and applies no ability bonuses, keeping the array clean).

### Fighter — Strength
`STR 16, CON 16, DEX 13, WIS 12, INT 10, CHA 8`
- **Gear:** Longsword (1d8 slashing), Shield, Scale Mail (AC 14 + Dex cap 2 + 2 shield = **AC 17**), Javelin (1d6 piercing, thrown 30/120).
- **HP:** 10 + 3 (Con) = **13**. Saves: Str, Con.
- **Fighting Style — Dueling:** +2 damage when wielding a single one-handed melee weapon and no other weapon. Applies to the longsword here.
- **Second Wind** (bonus action, 2 uses/rest): heal `1d10 + level`.
- **Action Surge** (free, 1 use/rest): gain one additional action this turn.
- **Weapon Mastery — Sap** (Longsword): on hit, target has **disadvantage on its next attack roll** before the start of your next turn.

### Cleric — Wisdom (Life Domain)
`WIS 16, CON 16, STR 13, DEX 12, CHA 10, INT 8`
- **Gear:** Mace (1d6 bludgeoning), Shield, Chain Mail (AC 16, no Dex, + 2 shield = **AC 18**).
- **HP:** 8 + 3 = **11**. Saves: Wis, Cha. Spell DC 13, spell attack +5.
- **Sacred Flame** (cantrip): target makes a Dex save or takes `1d8` radiant. No attack roll, ignores cover.
- **Spell slots:** 2 × level 1.
  - **Cure Wounds:** heal `2d8 + WIS`, touch (adjacent).
  - **Bless** (concentration, up to 3 targets within 30 ft): targets add `1d4` to attack rolls and saving throws.
- **Disciple of Life:** whenever a level-1+ spell restores HP, it restores an extra `2 + spell level` HP. Cure Wounds therefore heals `2d8 + 3 + 3`.

### Wizard — Intelligence
`INT 16, DEX 16, CON 13, WIS 12, CHA 10, STR 8`
- **Gear:** Robe (no armor: AC 10 + 3 Dex = **AC 13**), Quarterstaff (1d6 bludgeoning).
- **HP:** 6 + 1 = **7**. Saves: Int, Wis. Spell DC 13, spell attack +5. Fragile by design.
- **Shocking Grasp** (cantrip): melee spell attack, `1d8` lightning; on hit the target **can't take reactions** until the start of its next turn (so it can't make opportunity attacks — the wizard's escape tool). Advantage against targets wearing metal armor.
- **Fire Bolt** (cantrip): ranged spell attack, 120 ft, `1d10` fire.
- **Spell slots:** 2 × level 1.
  - **Magic Missile:** three darts, `1d4 + 1` force each, auto-hit, distributed freely among visible targets.
  - **Sleep** (5.5e version, no concentration): each creature in a 5-ft-radius sphere makes a **Wis save or is Incapacitated** until the end of its next turn, at which point it repeats the save — on that second failure it falls **Unconscious for 1 minute**. Unconscious ends early if the creature takes damage or an adjacent creature uses its action to shake it awake. Unconscious grants adjacent attackers advantage and auto-crits on hit, so a slept target is in mortal danger.
  - **Burning Hands:** 15-ft cone, Dex save, `3d6` fire, half on success.

### Rogue — Dexterity
`DEX 16, CON 16, INT 13, WIS 12, CHA 10, STR 8`
- **Gear:** two Shortswords (1d6 piercing, finesse, light), Studded Leather (AC 12 + 3 Dex = **AC 15**), Shortbow (1d6 piercing, 80/320).
- **HP:** 8 + 3 = **11**. Saves: Dex, Int.
- **Sneak Attack** (once per turn): `+1d6` when you hit with a finesse or ranged weapon and either you had advantage, or **an ally is adjacent to the target** and you don't have disadvantage.
- **Two-Weapon Fighting:** with a light weapon in each hand, a bonus-action off-hand attack (no ability mod on the damage).
- **Weapon Mastery — Vex** (Shortsword, Shortbow): on hit, you have **advantage on your next attack roll against that target** before the end of your next turn.

## 5. Data schemas

The point of these is that a goblin, a level-3 fighter, and a greataxe are all
*data edits*, never engine edits.

```ts
interface WeaponData {
  id: Id; name: string;
  damage: DiceExpr;                 // '1d8'
  damageType: DamageType;
  properties: WeaponProperty[];     // finesse | light | thrown | two-handed | versatile
  range?: { normal: number; long: number };  // absent = melee, reach 5
  mastery?: MasteryId;              // 'sap' | 'vex' | ...
}

interface SpellData {
  id: Id; name: string; level: number;       // 0 = cantrip
  castingTime: 'action' | 'bonus' | 'reaction';
  range: number;                              // ft; 0 = self/touch
  targeting: SingleTarget | Area | MultiTarget;
  concentration: boolean;
  resolve: 'attack' | 'save' | 'auto';
  save?: { ability: Ability; onSuccess: 'half' | 'none' };
  effects: SpellEffect[];                     // damage | heal | condition | buff
  scaling?: (slotLevel: number) => ...        // upcasting, ready for level 3+
}

interface ClassData {
  id: Id; name: string;
  hitDie: number;
  savingThrows: [Ability, Ability];
  statPriority: Ability[];             // how 16,16,13,12,10,8 gets assigned
  spellcasting?: { ability: Ability; slotsByLevel: number[][] };
  featuresByLevel: Record<number, FeatureData[]>;   // level 2+ is a data edit
  startingEquipment: Id[];
}

interface FeatureData {
  id: Id; name: string;
  trigger: 'action' | 'bonus' | 'reaction' | 'passive' | 'onHit' | 'free';
  uses?: { count: number; per: 'turn' | 'encounter' | 'shortRest' | 'longRest' };
  apply(ctx: FeatureContext): GameEvent[];
}
```

`FeatureData.apply` is the one place code lives inside data, and it's deliberate:
a feature is a small hook, not a branch in the engine. There is no `if (class ===
'fighter')` anywhere in `src/engine`. Consequence: content is "data-driven" at
the TypeScript-module level, not pure JSON — adding a monster means adding a TS
file, not a JSON file. If pure-JSON modding is ever wanted, features would need
an effect-description DSL; not planned.

## 6. Grid and terrain

`Grid` owns cells; each cell carries `{ terrain: TerrainId; occupantId?: Id }`.
v1 ships a single terrain (`open`), but the type exists and movement/LoS already
route through it, so `difficult` (2× cost), `wall` (blocks movement and LoS), and
`hazard` (damage on entry) drop in as data later.

- Distance: Chebyshev (`max(|dx|, |dy|)`) × 5 ft.
- Movement: BFS pathing over per-cell cost; you cannot end in an occupied cell,
  and you cannot pass through hostile creatures.
- Line of sight: Bresenham cell trace; blocked by `wall` terrain. No cover rules.
- Reach: melee = adjacent (Chebyshev 1). Ranged: within `normal` is fine;
  `normal..long` is disadvantage; beyond `long` is illegal. Ranged attacks made
  while an enemy is adjacent to you have disadvantage.

**AoE templates.** Areas are precomputed cell templates, not geometric
intersections — simpler to implement, and players can see exactly what a spell
covers.
- **Sphere, 5-ft radius** (Sleep): a 2×2 block of cells; the caster picks any
  2×2 block whose nearest cell is within spell range. Larger spheres later:
  radius r ft → a square of side `2r/5` cells.
- **Cone, 15 ft** (Burning Hands): originates from the caster's cell in one of
  8 directions. Orthogonal: 1 cell at range 1, 2 at range 2, 3 at range 3
  (6 cells). Diagonal: the mirrored 6-cell wedge along the diagonal. Templates
  are data (`src/data/templates.ts`), so new shapes are data edits.

## 7. CLI

```
      a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 8 |   |   | W2|   | C2|   |   |   |     Team 2  (red)
 7 |   | F2|   |   |   | R2|   |   |
 6 |   |   |   |   |   |   |   |   |
 ...
 2 |   | F1|   |   |   | R1|   |   |
 1 |   |   | W1|   | C1|   |   |   |     Team 1  (blue)

Round 2 — Fighter (Team 1)   HP 13/13  AC 17  Speed 30  [Action] [Bonus] [Move 30]

  1) Move                            5) Second Wind (bonus, 2 left)
  2) Attack — Longsword              6) Action Surge (1 left)
  3) Attack — Javelin (thrown)       7) Dodge / Dash / Disengage
  4) ...                             8) End turn
```

Menu options are generated straight from `legalActions()`, so an illegal option
is literally unrepresentable. Every event prints a line:
`Fighter attacks Wizard(T2) with Longsword: 18 vs AC 13 — hit for 9 slashing.
Wizard has disadvantage on its next attack (Sap).`

## 8. Build order

1. **Foundation** — RNG, dice, grid, types, state. Tests for distance, pathing, advantage-cancellation, seeded reproducibility.
2. **Core combat** — initiative, turn loop, move/attack/damage/death, opportunity attacks, win check. Playable with weapons only.
3. **Classes** — spells, features, conditions, concentration, all four classes complete. **This is the v1 milestone: full hot-seat game.**
4. **AI** — `(GameState, Action[]) => Action`. Start greedy (score each legal action: expected damage, kill potential, positioning, self-preservation), then improve. No engine changes required.
5. **Growth** — monsters, species, levels 2+, more equipment, terrain, larger/asymmetric maps.

## 9. Deliberately out of scope for v1

Cover, reactions beyond opportunity attacks, readied actions, death saves, spell
components, rituals, short/long rests as a play loop (per-rest uses just reset at
combat start), multiclassing, exhaustion, flanking, elevation, mounts.
