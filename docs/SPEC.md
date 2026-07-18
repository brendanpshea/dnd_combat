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
| Death | Monsters: 0 HP = dead and removed. **Player characters: 0 HP = unconscious**, still on the board, revived by any healing. No death saves |
| Win | Last team still *standing* wins — a party whose members are all down has lost (they are alive, but out) |
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

**Species may grant spells** two ways. `SpeciesData.spellsByLevel` grants
*cantrips* (free to cast; a wood elf knows True Strike). `SpeciesData.innateSpells`
grants *levelled* spells cast with **no slot, a fixed number of times per
encounter** (`{ spellId, atLevel, uses }`). This is the mechanism that lets a
non-caster cast at all: a fighter has zero slots, so slot-gated casting could
only ever have been a caster's perk. It's a third casting path in
`spellAvailable`, gated by `Combatant.innateSpells` (the mirror of `featureUses`)
rather than a slot, and it casts at `slotLevel 0` so it spends the innate use
instead of a slot. Per-encounter needs no reset logic — every battle rebuilds
the party, so a fresh pool is automatic. The AI values the pool as option value,
like feature uses and slots, so it saves the cast for a worthwhile cluster.

**Dragonborn** is the second user, and the innate path's *damage* shape: fire
resistance (`resistances`) plus a **Breath Weapon** — a cone, Dex save for half,
twice a fight, enemies only (a dragonborn aims its own breath, so no friendly
fire to confuse a player or the AI). It needed no new mechanism; it's a data
entry plus one spell, and the AI values it through simulated damage.

**Abyssal Tiefling** is the third: poison resistance, a free **Poison Spray**
cantrip (Con save, short range — 10 ft, 2 cells), and an innate **Ray of
Sickness** from 3rd. Ray of Sickness is deliberately the odd one out among the
species spells so far: it's a spell *attack roll* first, and only a hit gets a
Con save against the `poisoned` rider — two stages, mirroring the real spell,
built entirely from existing pieces (`spellAttack` for the roll, `repeatSave` on
the condition for the end-of-turn check-to-clear, the same mechanism Sleep and
Hold Person already use). It's also the first spell to ever apply `poisoned` —
the condition existed from day one (disadvantage on the bearer's own attacks)
but had no caster before this.

**Gnome** is the fourth, and the first to need mechanism beyond "another
innate spell": **Gnomish Cunning** (advantage on Int/Wis/Cha saves —
`FeatureData.saveAdvantage`, read by `savingThrow`, the same shape a second
species wanting a narrower version — a halfling's Brave, say, scoped to fear
only — reuses for free), a free **Minor Illusion** cantrip, and 2 uses of
**Animal Friendship** from 1st (not gated to 3rd like the other species'
innate spells — a gnome can talk its way past a wolf pack from level 1).

Animal Friendship needed a way to say "beast, not humanoid": `Combatant
.creatureType` (`humanoid | beast | undead | giant | construct | fiend |
dragon`), tagged on every monster stat block and read by a new
`SpellTargeting.creatureType` filter in `validTarget` — so `legalActions`
simply never offers it against a goblin, the same as Cure Wounds never
appearing in the tray at full HP. A failed Wisdom save doesn't damage the
beast, it removes it from the fight entirely (`charmAway`, sharing `kill()`'s
bookkeeping — clears the cell, breaks concentration, checks the winner — but
emitting `charmedAway` rather than `died`, since it wandered off rather than
dying). Measured: against the Spider Nest (all beasts), a 3-gnome party's win
rate goes 50% → 83% and downs-per-game 1.8 → 0.7, casting Animal Friendship
~4×/game — the design's intended hard counter to a fight built entirely of its
one weakness, not a subtle bonus.

Minor Illusion is the heaviest single addition: a shimmering, walkable false
wall. `Cell` gains an `illusion?: { sourceId, expiresAtRound }` field —
deliberately *not* a `TerrainId`, since an illusion sits on top of whatever
the cell already is rather than replacing it, so nothing has to remember what
to revert to when it pops. It blocks `hasLineOfSight` exactly like a wall,
but movement cost is untouched (keyed off `terrain`, which the illusion never
touches), and any creature that walks through it — either side — pops it
(`popIllusion`, wired into `executeMove` and `pushCreature`); it also expires
on its own a few rounds later (`expireIllusions`, swept once per round in
`endTurn`). It is the one spell in the game that touches no combatant at all,
so it earns nothing from the evaluator's per-unit scoring directly — what it
gets for free is that every existing caller of `hasLineOfSight` (the threat
term, "can I see an enemy," `canHide`) treats the screen as real, so blocking
a shot or opening a Hide happens through machinery that already existed, not
a bespoke weight. Measured consequence, honestly: the AI barely casts it in a
truly desperate fight (a solo rogue vs 3 goblins, 0 casts in 20 games — no
slack for anything but attacking), but does reach for it in an ordinary party
fight (13 casts across 20 games) — it is not dead weight, it is just not
something the generic evaluator is taught to *seek out*, the same trade-off
made for every other AI behaviour in this project (tune the evaluator, never
script the behaviour).

**Halfling** is the fifth, and deliberately a pure survival species — two
traits, no spell, nothing offensive. **Lucky** rerolls a natural 1 on any d20
test and must use the new roll; five call sites do the actual rolling (weapon
attacks, spell attacks, thrown items, saving throws, the Hide check), so it's
one shared helper (`applyLucky`, in `engine/rules/luck.ts` rather than
`dice.ts` — `dice.ts` is deliberately state-shape-agnostic, no `Combatant`
awareness) wrapped around each `D20Roll`. Unlimited, not a resource pool —
that's the halfling species trait's actual shape (2014 and 2024 alike); the
capped 3/rest version is a separate feat, a different thing. **Naturally
Stealthy** is a reframe: RAW lets a halfling hide behind a larger ally, which
needs a size system this game doesn't have (the same gap that ruled out
Halfling Nimbleness entirely), so it grants Stealth proficiency instead —
which turned up a real, if small, gap on the way in: `stealthBonus` (the Hide
roll) read only `cls.skillProfs`, never the generic `grantsSkill` that
`passivePerceptionWithAdvantage` already used for the elf's Keen Senses. Two
lines closed it, and now a species trait can improve a creature's *own* Hide
check, not just how well it spots others'. **Brave (advantage vs Frightened)
is deliberately not included**: `frightened` has existed in `ConditionId`
since day one and nothing has ever applied it, so shipping Brave today would
be exactly the "Speak with Animals is useless" trap the gnome's Animal
Friendship was built to avoid.

Because species never meet in the mirror arena (both sides are human), a
dedicated harness measures them where it matters — `npm run species` runs a
party of each species against themed level-3 encounters, reporting *heroes
downed per game* (the balance signal, which keeps headroom even when every party
wins) and how often the signature ability fired. It confirmed the Dragonborn
tracks the human baseline while breathing ~2x/fight (used, not warping), and
that a defensive trait shows a defensive delta (the dwarf takes ~0.8 fewer downs
against poison-dealing spiders). It also demonstrated its own noise floor: a
first 12-games/cell read had the tiefling doing *worse* than human against the
undead encounter, which a 30-game rerun flipped the other way (poison resistance
against ghouls helps, as it should) — a reminder to size the sample to the claim,
same lesson as the arena's win-rate noise.

The first innate user is the elf's **Faerie Fire** at 3rd: a 2×2 Dexterity-save area,
concentration, that leaves foes `outlined` (the *condition* is named for its
effect, not the spell — `guided` not `guiding-bolt` — so `src/ai/` never learns
a content id). Outlined creatures are attacked with advantage until the light
fades, and can't hide (an already-hidden one is revealed). This is the intended
counter to the rogue's Hide.

**True Strike** is a weapon attack, not another damage cantrip: it swings what's
in your hand using the caster's *best mental ability* (`AttackContext
.abilityOverride`). This needs no per-class rule to stay balanced — a fighter's
mental stats are 12/10/8, so it's strictly worse than his +3 Strength and he'll
never cast it, while a wizard finally gets to hit something with a weapon.

It reaches **wherever the weapon reaches** — a staff jabs, a crossbow shoots
across the board — via a `weaponAttack` targeting kind rather than a range on
the spell. A static range could only ever have been melee *or* ranged, and the
same spell has to be both; declaring "whatever this weapon can hit" hands the
question to `canAttackWith`, so line of sight, long range and every other attack
rule stay in the one place that owns them. True Strike guides **any weapon you can attack with**, drawn or stowed
(`attackableWeapons`), not just what's in hand — so the *pack is a ranged slot*.
The elf **cleric** keeps mace + shield (AC 18) and True-Strikes the crossbow it
carries in its pack, firing across the board without giving up the shield; the
elf **wizard** carries two daggers (finesse, thrown). The castSpell action names
the weapon, and `legalActions` offers True Strike once per reachable weapon —
because adjacent, a mace has no disadvantage while a crossbow does (enemy next to
the shooter), so the reach-vs-disadvantage call belongs to the player, not to a
default. Cast without a choice (the tray's browse path), it picks the hardest-
hitting weapon that reaches.

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
→ concentration save → death *or downing* → win check.

**Downed heroes** (`unconsciousAtZero`, set by the builder — the engine must not
know what a "character" is). A downed creature is `alive` with `hp === 0`, and
that pair is the entire state: `isDown()`. It is unconscious and prone, keeps its
square, and any healing brings it back — every heal routes through
`applyHealing`, the one place HP goes up, so a potion revives exactly as Cure
Wounds does. Damage can't finish it off (it is already at 0), so the stake is
losing its sword until someone reaches it, not losing it for good.

Sleep needs no special case: "damage wakes you unless you're at 0" is one rule,
and healing only revives from 0, so healing a *sleeping* ally doesn't wake it.

**A downed creature is not a combatant**, and this is load-bearing rather than
cosmetic. It can't be attacked, targeted by hostile spells, shaken awake, or
counted as an enemy for reach, cover or approach; it doesn't block a path (you
step over a body — but can't stop on it); and it takes no turn, having nothing
to do with one. Each of those was found the hard way:
- attackable → an AI scoring "can I kill this?" reads a 0 HP body as a
  guaranteed kill and every enemy beats on it forever; no battle ever ended;
- blocking → two bodies sealed a corridor and the last enemy became unreachable;
- counted as an enemy → a hero standing over a body thinks it's engaged, so it
  has no gradient toward the enemy still fighting and paces on the spot.

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
Passive Perception counts *proficiency* (a wood elf's Keen Senses), which it did
not before — perception was a stat nobody could be good at, so every creature in
the game spotted a hidden rogue equally well. A feature grants the skill
(`FeatureData.grantsSkill`) and both consumers read that one fact: the engine for
spotting, the campaign for who rolls a check.
Area effects may still affect hidden creatures. Rogue Cunning Action and Goblin
Nimble Escape each provide a bonus-action Hide option.

**Movement.** Dijkstra over per-cell cost; pass through allies, not hostiles;
can't end on occupied cells. Leaving reach provokes an opportunity attack
(resolved mid-path; death interrupts movement). **Among routes of equal length,
pathing takes the safe one** — fewest opportunity attacks provoked, fewest
hazards crossed (`StepDanger`). It never buys safety with movement: a longer way
round can strand a unit short of its target, a worse problem than the one it
solves. This matters because a `move` action names a *destination, not a route*
— the engine picks the walk — so this tiebreak is the only say anyone gets,
player or AI. (For a long time this paragraph described a preference that was
not implemented: hazards cost exactly what open ground costs, so the router
walked people through the fire pit whenever the distance tied.) **Forced movement** (Thunderwave): push N cells along a
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

## 4. Classes (levels 1–5, one subclass each)

All classes: standard array by priority, standard gear, weapon masteries per
the 5.5e list. Level 1 details (AC/HP/features) are authoritative in
`src/data/classes.ts`; summary:

| | Fighter (Champion) | Cleric (Life) | Wizard (Evoker) | Rogue (Assassin) |
| --- | --- | --- | --- | --- |
| L1 | Second Wind ×2, Action Surge, Dueling +2, Sap + Slow (javelin) mastery. AC 17, HP 13 | Sacred Flame, Cure Wounds, Bless, Disciple of Life. AC 18, HP 11 | Fire Bolt, Shocking Grasp, Magic Missile, Sleep, Burning Hands. AC 13, HP 7 | Sneak Attack 1d6, two shortswords + bow, Vex mastery. AC 15, HP 11 |
| L2 | — | +Guiding Bolt, Turn Undead (CD), 3 slots | +Thunderwave, 3 slots | Cunning Action (bonus Dash/Disengage) |
| L3 | Improved Critical (19–20) | Hold Person, Aid, Preserve Life (CD), slots 4/2 | Scorching Ray, Misty Step, Sculpt Spells, slots 4/2 | Assassinate, Sneak Attack 2d6 |
| L4 | Ability Score Increase | Ability Score Increase | Ability Score Increase | Ability Score Increase |
| L5 | **Extra Attack** (2 attacks) | **Mass Healing Word**, slots 4/3/2 | **Fireball**, slots 4/3/2 | **Uncanny Dodge**, Sneak Attack 3d6 |

Notable simplifications: Action Surge granted at level 1 (5.5e says 2);
per-rest resources reset at combat start. Sleep is the real 5.5e two-stage version (Incapacitated →
Unconscious). Preserve Life auto-distributes to the most wounded allies
within 30 ft, capped at half max HP.

**Levels 4–5.** No feats yet: the level-4 ASI is a deterministic +2 to the
class's primary stat (capped at 20), applied in the builder. Level 5 is the
power spike — Extra Attack (`attacksPerAction: 2`), full casters' first
3rd-level slot, proficiency bonus rising to +3, and each caster's signature
3rd-level spell. **Fireball** is an 8d6 fire blast on a 5×5 template (Dex save
for half), honouring the Evoker's Sculpt Spells exactly as Burning Hands does.
**Mass Healing Word** is a bonus-action multi-ally heal. **Uncanny Dodge**
halves the first hit against the rogue each round; damage cantrips (Fire Bolt,
Sacred Flame, Shocking Grasp, Poison Spray) gain a second die at level 5 via a
shared `cantripDice` helper. New boss-tier monsters — Knight, Minotaur, Ettin —
front the three L4–5 ladder stages (Knightly Order, Labyrinth Terror, and the
Giant's Stronghold finale).

**Expanded spellbook.** Beyond the core kit, the casters share a wider list
(also seeded onto NPC caster stat blocks): Healing Word and Mass Healing Word
(bonus-action heals), Command (Wis save → grovel: prone + lose a turn, the
`commanded` condition), Suggestion (Wis save → leave the fight via `charmAway`),
Web (Dex save → `restrained`, save-ends, concentration), Fear (cone, Wis save →
`frightened`, which now imposes disadvantage on attacks), Lightning Bolt (a
`line15` bolt, Dex save for half, ignores cover), Spiritual Weapon (a bonus-
action force attack that re-attacks free each turn while it lasts), Spiritual
Guardians (a 15-ft radiant aura resolved in `startTurn`, held by concentration),
and Shield (a reaction the engine **autocasts** for a defender when +5 AC would
turn a hit into a miss, and which blocks Magic Missile outright). Guidance is
out-of-combat only: a party cleric adds +1d4 to shop skill checks.

**Turn Undead** is the base Channel Divinity every cleric gets at level 2
(separate from Life Domain's Preserve Life at 3). RAW turns — forces to flee —
every undead within 30 ft that fails a Wisdom save; with no "must flee" AI, a
turned undead is instead removed from the fight (`charmAway`, the same
not-a-death exit Animal Friendship uses), scoped by the `creatureType: 'undead'`
tag. One use per encounter.

**Fighting styles** beyond Dueling exist as reusable passive features —
Defense (+1 AC while armored), Archery (+2 ranged attack rolls), Great Weapon
Fighting (reroll 1s/2s on two-handed weapon damage), and Two-Weapon Fighting
(off-hand adds its ability modifier). A Fighter now *chooses* its style at
creation through the generic choice-point system (below); Dueling is the
default. RAW Protection is omitted — it needs a reaction outside opportunity
attacks, which the engine doesn't model yet.

**Build choice points.** A class or species may declare `choices`: a build
decision (`ChoicePoint`) with an `atLevel` gate, a `default`, and options that
each carry a `grants` bag (feature ids, spell ids, weapon masteries,
resistances). At construction the builder folds the picked option's grants —
or the default's, for beginners, legacy saves and skirmishes — exactly as it
folds species traits. Fighter's Fighting Style is the first user; subclasses and
draconic ancestry are the same shape, so a new choice is data plus a forge
disclosure, never new builder code. In the campaign forge, applicable choice
points render under a collapsed **Advanced** control per party member; the pick
persists on `PartyCharacter.choices` and clears when the slot's class changes.

**Weapon masteries** now cover six of the eight 2024 masteries: Sap and Vex
(as before), plus Slow (−10 ft to speed until the target's next turn), Push
(shove 10 ft straight back on a hit), Topple (Con save or fall prone), and
Graze (a miss still deals the attacker's ability modifier in damage). Weapons
carry their RAW mastery in data; a mastery only fires for a wielder whose class
trains that weapon (`weaponMasteries`). Cleave and Nick are deferred — they
need multi-target and off-hand action-economy changes the current single-target
attack resolution doesn't support.

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
  an incoming-threat term.
- **Every positional term must be POV-asymmetric or it cancels.** Distance and
  sight are *mutual*, so a symmetric weight vanishes from `mine − theirs` and
  leaves movement gradient-free. This has now bitten twice: an evenly-weighted
  line-of-sight penalty made the 1.2 a shooter gains by stepping into a
  sightline exactly cancel the 1.2 its target gains by being seen, so two
  shooters behind opposite walls both scored standing still as optimal and the
  game never ended.
- **A band you can't shoot from is not a band**: with no sightline — including
  when every enemy is *hidden*, and so untargetable — a unit closes, because
  closing is how you find one. "Sees" therefore means *can act on*, not merely
  a clear geometric line.
- **Skip verbs (Dodge/Disengage/Dash/Hide) pay a flat toll** (`ACTION_COST`),
  and defensive conditions are weighted below what one real attack swings.
  Both encode one rule: *prefer acting against the enemy*. These verbs' payoff
  is a state the evaluator prices directly, while an attack's payoff is a
  sampled roll that might miss — so without a toll the safe non-action wins
  every close call and a unit dodges instead of swinging, round after round.
  Valuing `hidden` richly (0.14) was worst: the AI hoarded the state rather
  than cashing it in for the attack that made it worth having, and two hidden,
  mutually untargetable units deadlocked a game permanently. Measured: dodge
  ~2% of decisions, disengage ~0%.
- **Melee vs ranged is decided by a damage comparison over the unit's whole
  kit** (`damageProfile`: best melee output vs best ranged, with a caster's
  cantrips counting as ranged), not by what it happens to be holding. An
  earlier version asked "is a melee weapon equipped?" — true of *every*
  character, since a wizard carries a staff, so the 7-HP wizard charged into
  melee and died in ~2 turns, and a fighter flipped to "ranged" the moment
  auto-swap put a thrown javelin in its hand. Fixing this alone moved the sim
  from 36% to ~54% against greedy.

  A follow-up refinement — counting touch cantrips as melee output, giving ties
  to range, and charging the "too close" half of the band only to units whose
  offense adjacency actually blunts — read as +2% over 50 games and **−9% over
  80**. It was reverted. Every claim in this file about a weight is a *measured*
  claim; see the noise note under Arena before adding another.
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
Easy = sim-easy (~28% vs greedy), Normal = sim-normal (~52%), Hard = greedy.

**The ladder really has two rungs, not three.** Measured against greedy over 160
games: sim-easy 28.1%, sim-normal 51.9%, sim-hard 54.4%. Easy is genuinely
easier; normal, hard and greedy are all within noise of each other and of 50%.
Someone choosing Hard today gets, in effect, the Normal opponent.

sim-hard at 54.4% ± 4.0 is only ~1.1 SE above even, so it has *not* convincingly
overtaken greedy and Hard stays greedy for now — the swap criterion below is
empirical, and "tied" is not "overtaken". (An earlier note here recorded sim-hard
at ~45% and concluded it was behind; that read was 40 games, ±7.9, and predated
the hide/pathing/deadlock fixes. It was noise.)

Closing the top of the ladder is not a tuning job. Both cheap levers are spent:
more search plateaus past 5 samples (table below), and focus-fire targeting is
already implemented twice over — the evaluator's `0.35` alive-bonus means
killing one 20 HP enemy scores 40 where splitting the same damage scores 26, and
greedy carries an explicit `killBonus`. What is left is either a better
evaluator (three attempts have measured *worse*), cross-unit coordination (a
real gap — "I soften, you finish" — but a large build), or buying difficulty
outside the AI entirely: more or better enemies on Hard, which is honest, cheap,
and the usual answer in shipped games.

**What the knobs are actually worth** (160 games each, vs greedy):

| samples | beam | depth | mc | win rate |
| --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 3 | 28.7% |
| 2 | 1 | 1 | 2 | 40.0% |
| 3 | 1 | 1 | 3 | 46.3% |
| 3 | 2 | 1 | 3 | 46.3% |
| 3 | 3 | 2 | 5 | 51.9% ← normal |
| 5 | 5 | 3 | 7 | 54.4% ← hard |
| 8 | 5 | 3 | 7 | 41.3% |
| 12 | 5 | 3 | 7 | 48.1% |

`samples` dominates the climb: 1 → 3 is worth **+17.6 points**, more than
everything else combined, and 1 → 5 gets from 28.7% to 54.4%. Depth is second
and real (+5.6 to depth 2). `beam` cannot be read from rows 3-4 and those two
rows prove nothing: **at `depth: 1` the beam is never extended**, so
`chooseActionSim` returns the top-scoring first action whatever the width — beam
is inert by construction below depth 2. (An earlier draft of this file concluded
from exactly that pair that "beam does nothing". It was measuring a no-op.)

**Past 5 samples the curve stops climbing** — 8 lands at 41.3%, a drop of 2.3 SE
that is probably real rather than noise, and 12 recovers only to 48.1%. So
thinking harder is not a lever any more: this AI is at its ceiling, and the
remaining error is in *what* it values, not in how precisely it measures it.
(Worth a look if anyone revisits: `pathScore` accumulates `meanV - node.stateV`,
an average over N samples minus a single-draw baseline, since the beam continues
from the sample-0 state. That mismatch is a plausible suspect for why sharper
estimates stop paying, and would explain the same shape as the two other
"obvious" improvements above that measured *worse*.)

The awkward consequence is that **easy is easy because it is blind** — one
sample, so it imagines each action once and its estimates are noise. That is a
bad way to be weak: noisy estimates don't read as "beginner", they read as
"broken". A kobold that walks into a lethal opportunity attack looks like a bug,
which is what it looked like in real play. Hence the lethality veto: being
analytic, it protects the 1-sample preset without buying strength (easy 28.7% →
28.1%) — the alternative, raising samples, would have made Story mode ~18 points
*harder*, which is precisely backwards for the mode aimed at younger players.

**Two tools, and they answer different questions.** Use both; neither
substitutes for the other.

**Probe** (`npx tsx scripts/probe.ts`) — tactical set-pieces with an obvious
right answer, printing what the AI actually did. Runs in ~4s, deterministic,
and tells you *why* something changed. This is the loop to iterate in.
Judge the whole turn, never the first action: "attack then step aside" and
"step aside then attack" spend the same resources and score identically, so
which comes first is decided by sampling noise — a first-action assertion
tests a coin flip, as one test in this repo did until it started failing for
no behavioural reason.

**Arena** (`npm run arena [games] [preset]`, `src/ai/arena.ts`): seeded mirror
matches with side-swapping — the authority on *strength*, and the gate before
any AI change lands. Games are independent, so seeds are dealt across one
process per core (`--serial` to debug in-process). 160 games run in ~30s.

Keeping it that way is a feature, not vanity: a slow gate is a gate people skip,
and skipping it is how the -9% batch above nearly landed. The AI spends its time
in `step` and the grid search, not in clever evaluation, so that's where the
speed is. Three fixes took a 160-game read from 119s to 32s with *bit-identical*
results (85/160 before and after — the proof they changed nothing):
`step` deep-copies with a hand-rolled clone instead of `structuredClone` (the
state is plain data by spec, and a test enforces it); `reachable` looks costs up
in a flat array instead of building an 'x,y' string per neighbour; and the
evaluator memoises dice averages and caches each unit's damage profile, which
its O(n²) threat term otherwise recomputes from scratch.

Mind the noise. A win rate off N games carries a standard error of about
`sqrt(0.25/N)` — ±7 points at 50 games, ±5.6 at 80 — and the CLI prints it.
Two readings inside ~2 SE of each other are *the same reading*. A tuning batch
in this repo measured 50% and 52% on 50-game runs and was one commit away from
landing as an improvement; on 80 games, paired against baseline on identical
seeds, it was 45% against 55% — a 10-point regression. Re-measure on more
games, paired on the same seeds, before believing the prettier number.

Actions carry a small cost (`MOVE_COST`, and a larger one for the skip verbs)
so they must justify themselves: without it, a zero-value move ties with
ending the turn and wins the sort, and units shuffle between equivalent cells
until their movement runs out. Shooters take a penalty for having no line of
sight to anyone, which stops them idling behind a wall at their "preferred"
distance — melee kits are exempt, or the term pins them to a sniping spot
they can't use.

Known limits: single-turn horizon (no enemy-reply search), cover/terrain
otherwise unvalued, never upcasts, evaluator weights hand-set (auto-tuning
them against arena win rate is an open, well-tooled follow-up).

## 7b. Campaign layer

`src/campaign/` is the meta-game the combat engine knows nothing about: a
`CampaignState` (gold, **XP**, stage index, and per-character name, class,
species, portrait, inventory, and equipment) persists across battles as JSON.
New web campaigns start in a **party forge**. Players name each adventurer,
select species and an authored portrait, and assign the four class roles. The
campaign deliberately keeps one Fighter, Wizard, Cleric, and Rogue: selecting
an occupied role swaps the two members' class roles and standard starting kits
while preserving their name, species, and portrait. Confirming the forge sets
`partyReady`; legacy saves default this flag to ready and gain class-name and
class-portrait defaults during parsing. The selected portrait is passed through
the builder as `Combatant.portraitId`, so the party card preview and board token
share the same art identity. The ladder is data (`STAGES`) —
just `{ encounterId, mapId }`, ordered easy → hard over 11 stages; everything
else is *derived*. **Party level comes from accumulated XP** (`levelForXp`,
5e thresholds 300/900, capped at content level 3), not from the stage, so the
party levels up gradually mid-run and can be under-level for a hard fight (the
UI warns). Each monster carries an SRD **XP value** (`MONSTER_XP`); a victory
awards `encounterXP / partySize` (per-character pacing). **Treasure is
generated from encounter XP** (`treasureFor`): gold ≈ XP/2 with variance, and
the number of item rolls and the rarity ceiling both scale with XP (a rarity-
tiered pool, no per-stage authoring); the finale forces one guaranteed rare
drop. Loot and XP use the battle's final RNG state, so seeded campaigns are
reproducible end-to-end. Old saves migrate: a missing `xp` is back-filled from
the ladder so nobody de-levels. Between battles the shop buys/sells
(half price back) from
`SHOP_STOCK` — consumables, weapons (incl. +1 longsword/shortsword with
attack/damage bonus support in the engine), and armor gated by per-class
**armor proficiencies** (fighter/cleric all, rogue light, wizard none).
Remaining HP persists from a victorious battle into the next store visit. For
testing, the store provides unrestricted rests: a **short rest** restores half
of each hero's maximum HP, and a **long rest** fully restores HP. Other
encounter resources still begin full when a combatant is rebuilt.
Healing potions, the Scroll of Cure Wounds, and the cleric's **Cure Wounds**
use the same store target flow: choose the source, then a party member. Item
sources stay in the Pack; curated store-usable spells appear in a separate
Spells row. Item sources are consumed; Cure Wounds does not spend an
encounter-only spell slot.
**Find Familiar** summons an owl from the wizard's store Spells row. The owl
persists through unconsciousness and rests without occupying a grid cell; it
grants advantage on the wizard's first melee or spell attack roll each round,
then its token marker dims until the next round.
**Mage Armor** is a wizard self-cast in the store and combat. While unarmored,
it sets AC to $13 + \text{Dexterity modifier}$ (and still allows a shield); it
persists between battles but ends at the next long rest.
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
surviving inventory and HP back (spent consumables stay spent, weapon swaps
persist), adds loot, and advances. Only a full wipe ends the campaign. Entry
point: `npm run campaign`
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
  loot) as forms; new web campaigns begin with the party forge (name, species,
  unique class-role swaps, and portrait selection), whose selected portrait
  drives the battlefield token. Saves in localStorage include that identity.
  Once-per-visit shop flags persist in the save so a page refresh can't retry a
  theft.
- **PWA:** manifest + service worker (network-first navigation, cache-first
  hashed assets) — installable on phones, works offline.
- **Deployment:** GitHub Actions builds on every push to `main` (gated on
  the test suite) and deploys `dist-web/` to GitHub Pages.

## 9. Testing

182 vitest tests: deterministic replay of full battles, rules-level unit
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
